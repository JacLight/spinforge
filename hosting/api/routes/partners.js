/**
 * SpinForge - Third-party partner token exchange
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Mounted at /_partners/* (public-ish — no admin/customer auth, gated
 * instead by X-Partner-Key which identifies the calling partner).
 *
 * Exchange flow (/_partners/exchange):
 *   1. Partner's backend calls us with:
 *        X-Partner-Key: sfpk_...              (identifies the partner)
 *        body: { token: "<partner-customer-token>" }
 *   2. We look the partner up in Redis, pull their validationUrl.
 *   3. We call their validationUrl with the customer's token as a
 *      Bearer Authorization header. Partners configure this endpoint to
 *      look up the token in their own system and return the customer
 *      identity and any metadata we should know about.
 *   4. On 2xx, we ensure a SpinForge customer record exists for that
 *      identity and mint a short-lived sfc_ customer token — the same
 *      token format the normal customer dashboard uses — so the caller
 *      can manage sites via /_api/customer/*.
 *   5. We return { token, customerId, expiresAt } to the partner.
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const redisClient = require('../utils/redis');
const PartnerService = require('../services/PartnerService');
const CustomerTokenService = require('../services/CustomerTokenService');
const logger = require('../utils/logger');

const partnerService = new PartnerService(redisClient, { logger });
const customerTokenService = new CustomerTokenService(redisClient);

/**
 * Decode a JWT WITHOUT verifying its signature — we use the claims only
 * for identity extraction, not trust. The partner's validation endpoint is
 * the thing that actually vouches for the token. Returns the claims
 * object or null if the token isn't a JWT at all.
 */
function decodeClaims(token) {
  try {
    return jwt.decode(token) || null;
  } catch (_) {
    return null;
  }
}

/**
 * Pull a stable external customer id out of: the validation response body
 * first (partners who explicitly return one), then the JWT claims (which
 * is how appmint-style endpoints work — the response is a dev_environment
 * record, not a user record, so identity has to come from the bearer JWT).
 *
 * Returns {externalCustomerId, email, name} or {externalCustomerId: null}.
 */
function extractIdentity(responseBody, claims) {
  const r = responseBody && typeof responseBody === 'object' ? responseBody : {};
  const c = claims && typeof claims === 'object' ? claims : {};
  const cdata = c.data && typeof c.data === 'object' ? c.data : {};

  // Priority order:
  //   1. Explicit response-body fields (partner chose to tell us)
  //   2. JWT top-level id / sub / email
  //   3. JWT nested data.email / data.username (appmint shape)
  const externalCustomerId =
    r.customerId ||
    r.customer_id ||
    r.externalCustomerId ||
    r.id ||
    r.sub ||
    r.user_id ||
    c._id ||
    c.id ||
    c.sub ||
    c.user_id ||
    cdata.email ||
    cdata.username ||
    null;

  const email = r.email || cdata.email || c.email || null;
  const name =
    r.name ||
    r.fullName ||
    cdata.name ||
    cdata.fullName ||
    cdata.username ||
    email ||
    null;

  return { externalCustomerId, email, name };
}

// ─── Partner key gate ─────────────────────────────────────────────────
// Every /_partners/* call must present a valid X-Partner-Key.
router.use(async (req, res, next) => {
  const key = req.headers['x-partner-key'];
  if (!key) {
    return res.status(401).json({
      error: 'Missing X-Partner-Key',
      hint: 'Send the sfpk_ key issued when the partner was registered.',
    });
  }

  try {
    const partner = await partnerService.validateApiKey(key);
    if (!partner) {
      return res.status(401).json({ error: 'Invalid partner key' });
    }
    req.partner = partner;
    next();
  } catch (err) {
    logger.error('partner auth error:', err);
    res.status(500).json({ error: 'Partner authentication failed' });
  }
});

// ─── Small helper to ensure a SpinForge customer exists ──────────────
// Partners usually provide their own stable customer id. We namespace it
// by partner id so two different partners can use the same id without
// colliding. First time we see a partner-customer, we create the record;
// subsequent calls reuse it.
async function ensureSpinForgeCustomer({ partnerId, externalCustomerId, email, name, metadata }) {
  if (!externalCustomerId) {
    throw new Error('Validation response did not include a customerId');
  }

  const customerId = `partner_${partnerId}_${externalCustomerId}`;
  const key = `customer:${customerId}`;

  const existing = await redisClient.get(key);
  if (existing) {
    // Touch updatedAt so admins can see recent partner activity.
    try {
      const cust = JSON.parse(existing);
      cust.updatedAt = new Date().toISOString();
      await redisClient.set(key, JSON.stringify(cust));
    } catch (_) {}
    return customerId;
  }

  const now = new Date().toISOString();
  const customer = {
    id: customerId,
    name: name || `Partner customer ${externalCustomerId}`,
    email: email || null,
    createdAt: now,
    updatedAt: now,
    isActive: true,
    metadata: {
      source: 'partner',
      partnerId,
      externalCustomerId,
      ...(metadata || {}),
    },
    limits: {},
  };

  await Promise.all([
    redisClient.set(key, JSON.stringify(customer)),
    redisClient.sAdd('customers', customerId),
  ]);
  return customerId;
}

// Extract the org id from a JWT's `pk` field, which in appmint-style JWTs
// has the shape "<orgid>|<datatype>" (e.g. "localhost|user"). Falls back
// to null if the token isn't shaped that way.
function extractOrgId(claims) {
  const pk = claims && (claims.pk || claims.data?.pk);
  if (typeof pk === 'string' && pk.includes('|')) return pk.split('|')[0];
  return null;
}

// Slug-safe version of a string for domain generation.
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Given a partner's validation response, find the dev_environment record
 * with the requested project name. Supports both the flat shape
 *   { data: [{name: "..."}] }
 * and the nested shape where the name lives under .data.name:
 *   { data: [{name: "x", data: {name: "x"}}] }
 * Returns the matching record or null.
 */
function findProject(responseBody, projectName) {
  const list = Array.isArray(responseBody?.data)
    ? responseBody.data
    : Array.isArray(responseBody)
    ? responseBody
    : [];
  if (!projectName) return null;
  const target = String(projectName).toLowerCase();
  return (
    list.find(
      (r) =>
        r?.name?.toLowerCase() === target ||
        r?.data?.name?.toLowerCase() === target
    ) || null
  );
}

/**
 * Decide which hostname to use for the site. Rules:
 *   1. If the caller passed a `domain` AND it matches one of the env's
 *      configured hostnames (productionUrl, devUrl, previewUrl, or any
 *      entry in domains[]), honor it.
 *   2. Otherwise fall back to the default pattern
 *      `{orgid}-{envName}.spinforge.dev`, which is stable and owned by us.
 */
function resolveHost({ requestedDomain, env, orgId }) {
  const envData = env?.data || {};
  const envName = envData.name || env?.name || '';
  const candidates = new Set(
    [
      envData.productionUrl,
      envData.devUrl,
      envData.previewUrl,
      ...(Array.isArray(envData.domains) ? envData.domains : []),
    ]
      .filter(Boolean)
      .map((d) => String(d).toLowerCase())
  );

  const defaultHost =
    orgId && envName
      ? `${slugify(orgId)}-${slugify(envName)}.spinforge.dev`
      : null;

  if (requestedDomain) {
    const rd = String(requestedDomain).toLowerCase();
    if (candidates.has(rd)) {
      return { host: rd, usedDefault: false };
    }
  }

  return { host: defaultHost, usedDefault: true };
}

// ─── POST /_partners/exchange ────────────────────────────────────────
//
// Request body:
//   {
//     "token":       "<customer's bearer token from the partner>",   // required
//     "projectName": "event-map",                                    // required
//     "domain":      "custom.example.com"                            // optional
//   }
//
// Flow:
//   1. Decode (not verify) the JWT claims for identity + orgid.
//   2. Call partner.validationUrl with Authorization: Bearer <token>
//      plus any extra headers configured on the partner record
//      (e.g. orgid for appmint). Partner returns a list of dev_env records.
//   3. Find the requested project in the list — 403 if not found.
//   4. Resolve the final hostname: honour caller's `domain` when it
//      matches a configured hostname, otherwise fall back to
//      `{orgid}-{projectName}.spinforge.dev`.
//   5. Provision a SpinForge customer (namespaced by partner+orgid+user)
//      and issue a short-lived sfc_ token that works against the
//      existing /_api/customer/* endpoints.
router.post('/exchange', async (req, res) => {
  const partner = req.partner;
  const { token: customerToken, projectName, domain: requestedDomain, payload } = req.body || {};

  if (!customerToken || typeof customerToken !== 'string') {
    return res.status(400).json({ error: 'Request body must include a "token" string' });
  }
  if (!projectName || typeof projectName !== 'string') {
    return res.status(400).json({
      error: 'Request body must include a "projectName" — the env/site the customer wants to host',
    });
  }

  // Decode JWT claims for identity + orgid. Signature is NOT verified —
  // the partner's validationUrl is the source of trust.
  const claims = decodeClaims(customerToken) || {};
  const orgIdFromJwt = extractOrgId(claims);

  // Call the partner's validation endpoint using the customer's token.
  let partnerResponse;
  try {
    const method = (partner.validationMethod || 'POST').toUpperCase();
    const extraHeaders = partner.validationHeaders || {};
    const axiosConfig = {
      method,
      url: partner.validationUrl,
      timeout: 10_000,
      headers: {
        Authorization: `Bearer ${customerToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'SpinForge-Partner-Exchange/1.0',
        ...extraHeaders,
      },
      ...(method === 'POST' || method === 'PUT' || method === 'PATCH'
        ? { data: payload || {} }
        : {}),
      // Accept any 2xx/3xx; we handle 4xx/5xx explicitly below.
      validateStatus: (s) => s < 500,
    };
    partnerResponse = await axios(axiosConfig);
  } catch (err) {
    logger.warn(`[partners/exchange] partner ${partner.id} validation call failed: ${err.message}`);
    return res.status(502).json({
      error: 'Could not reach partner validation endpoint',
      details: err.message,
    });
  }

  if (partnerResponse.status < 200 || partnerResponse.status >= 300) {
    logger.info(
      `[partners/exchange] partner ${partner.id} rejected token with ${partnerResponse.status}`
    );
    return res.status(401).json({
      error: 'Partner rejected the supplied token',
      status: partnerResponse.status,
      details:
        typeof partnerResponse.data === 'string'
          ? partnerResponse.data.slice(0, 500)
          : partnerResponse.data,
    });
  }

  const responseBody = partnerResponse.data || {};

  // Verify the customer actually owns the requested project.
  const env = findProject(responseBody, projectName);
  if (!env) {
    const availableNames = (Array.isArray(responseBody.data) ? responseBody.data : [])
      .map((r) => r?.name || r?.data?.name)
      .filter(Boolean);
    return res.status(403).json({
      error: `Project "${projectName}" not found in the customer's environments`,
      available: availableNames,
    });
  }

  // Pull identity out of JWT claims and/or env record.
  const cdata = claims.data && typeof claims.data === 'object' ? claims.data : {};
  const externalCustomerId =
    claims._id || claims.id || cdata.email || cdata.username || null;
  const email = cdata.email || claims.email || null;
  const name = cdata.name || cdata.fullName || cdata.username || email || null;

  if (!externalCustomerId) {
    return res.status(502).json({
      error: 'Could not derive a stable customer id from the token',
      hint: 'Token must carry _id, id, data.email, or data.username in its claims.',
    });
  }

  // Honour orgid from the env record's `pk` first (most authoritative),
  // then fall back to the JWT's pk.
  const envPk = env?.pk || '';
  const orgIdFromEnv = typeof envPk === 'string' && envPk.includes('|') ? envPk.split('|')[0] : null;
  const orgId = orgIdFromEnv || orgIdFromJwt || 'default';

  // Resolve the final hostname
  const { host, usedDefault } = resolveHost({
    requestedDomain,
    env,
    orgId,
  });
  if (!host) {
    return res.status(500).json({
      error: 'Could not resolve a hostname for this project',
      hint: 'Project is missing a name; default host template needs {orgid}-{name}.spinforge.dev',
    });
  }

  // Create or reuse the SpinForge customer record
  let spinforgeCustomerId;
  try {
    spinforgeCustomerId = await ensureSpinForgeCustomer({
      partnerId: partner.id,
      externalCustomerId: `${orgId}:${externalCustomerId}`,
      email,
      name,
      metadata: { orgId, projectName, env: env._id || null },
    });
  } catch (err) {
    logger.error('[partners/exchange] failed to provision customer:', err);
    return res.status(500).json({ error: err.message });
  }

  // Mint a short-lived customer API token
  let issued;
  try {
    const ttlSeconds = Number(partner.tokenTtlSeconds || 3600);
    const expiryIso = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    issued = await customerTokenService.createToken({
      customerId: spinforgeCustomerId,
      userEmail: email || `partner-${partner.id}`,
      name: `partner:${partner.name}:${projectName}:${crypto.randomBytes(3).toString('hex')}`,
      expiry: expiryIso,
    });
  } catch (err) {
    logger.error('[partners/exchange] failed to issue customer token:', err);
    return res.status(500).json({ error: err.message });
  }

  logger.info(
    `[partners/exchange] partner=${partner.id} orgid=${orgId} project=${projectName} host=${host} customer=${spinforgeCustomerId}`
  );

  res.json({
    success: true,
    token: issued.token,
    customerId: spinforgeCustomerId,
    expiresAt: issued.expiresAt,
    host,
    projectName,
    orgId,
    usedDefaultHost: usedDefault,
    partner: { id: partner.id, name: partner.name },
    env: {
      id: env._id || null,
      name: env?.data?.name || env?.name,
      productionUrl: env?.data?.productionUrl || null,
      devUrl: env?.data?.devUrl || null,
      previewUrl: env?.data?.previewUrl || null,
      domains: env?.data?.domains || [],
    },
  });
});

// Simple health check so partners can ping us without consuming a token
router.get('/health', (req, res) => {
  res.json({ ok: true, partner: { id: req.partner.id, name: req.partner.name } });
});

module.exports = router;
