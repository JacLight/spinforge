/**
 * SpinForge - Third-party partner auth
 * Copyright (c) 2025 Jacob Ajiboye
 * Licensed under the MIT License
 *
 * Mounted at /_partners/* (public-ish — gated by X-Partner-Key which
 * identifies the calling partner, not by admin/customer auth).
 *
 * There is exactly ONE thing this router does: exchange a partner-issued
 * customer token for a SpinForge customer session. Everything downstream
 * (create sites, list sites, delete sites, tail logs) goes through the
 * normal /_api/customer/* surface using that session token.
 *
 * Flow (/_partners/auth):
 *
 *   partner backend → POST /_partners/auth
 *                      X-Partner-Key: sfpk_...
 *                      body: { token: <customer's partner token> }
 *                            │
 *                            ▼
 *   spinforge     → POST {partner.validationUrl}
 *                    Authorization: Bearer <customer's partner token>
 *                            │
 *                            ▼
 *   partner       → any 2xx response, must include a stable customer
 *                    id. We accept a few common shapes (see below).
 *                            │
 *                            ▼
 *   spinforge     → upsert customer:partner_<partnerId>_<externalId>
 *                    mint sfc_ customer token valid for partner.tokenTtlSeconds
 *                    return { token, customerId, expiresAt }
 *
 * Customers never see this route. It's called server-to-server from the
 * partner's backend whenever they need a fresh SpinForge session for one
 * of their users.
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

// ─── Partner key gate ─────────────────────────────────────────────────
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

// ─── Customer provisioning helper ────────────────────────────────────
// Partner-owned customers are namespaced so two partners can use the
// same external id without collision. First call creates the record,
// subsequent calls reuse it and touch updatedAt.
async function ensureSpinForgeCustomer({ partnerId, externalCustomerId, email, name, metadata }) {
  if (!externalCustomerId) {
    throw new Error('Partner did not return a customer id');
  }
  const customerId = `partner_${partnerId}_${externalCustomerId}`;
  const key = `customer:${customerId}`;

  const existing = await redisClient.get(key);
  if (existing) {
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
    metadata: { source: 'partner', partnerId, externalCustomerId, ...(metadata || {}) },
    limits: {},
  };
  await Promise.all([
    redisClient.set(key, JSON.stringify(customer)),
    redisClient.sAdd('customers', customerId),
  ]);
  return customerId;
}

// Pull account identity out of the partner's validation response. The
// account (org) is the thing that owns hosting; users inside the account
// share the same SpinForge customer.
//
//   orgId:  orgId > org_id > data.orgId > name
//   email:  email > user > data.email        (account registration email)
//   name:   fullName > firstName+lastName > displayName > email
//
// orgId is required — partners must either set an explicit orgId or use
// the `name` slot (as appengine does). A partner with no org model needs
// to expose one before they can integrate.
function extractIdentity(body) {
  const b = body && typeof body === 'object' ? body : {};
  const d = b.data && typeof b.data === 'object' ? b.data : {};

  const email = b.email || b.user || d.email || null;

  const orgId =
    b.orgId || b.org_id || d.orgId || d.org_id ||
    b.name || d.name ||
    null;

  const firstName = b.firstName || d.firstName || '';
  const lastName = b.lastName || d.lastName || '';
  // Display name for the account. Prefer an explicit human label
  // (displayName/fullName/first+last), otherwise use the orgId itself —
  // which for appengine-shaped partners IS the account's human label.
  const displayName =
    b.displayName || b.fullName || d.displayName || d.fullName ||
    ((firstName || lastName) ? `${firstName} ${lastName}`.trim() : null) ||
    (orgId ? String(orgId) : null) ||
    email ||
    null;

  return {
    orgId: orgId ? String(orgId) : null,
    email,
    name: displayName,
  };
}

// ─── POST /_partners/auth ────────────────────────────────────────────
router.post('/auth', async (req, res) => {
  const partner = req.partner;
  const {
    token: customerToken,
    payload,
    headers: requestHeaders,
    params,          // flat string map substituted into partner.validationUrl
  } = req.body || {};

  if (!customerToken || typeof customerToken !== 'string') {
    return res.status(400).json({ error: 'Request body must include a "token" string' });
  }

  // URL templating: fill :paramName placeholders in the partner's
  // validationUrl. Values are looked up in this order, first wins:
  //   1. Top-level scalar fields on the request body (appmint flattens
  //      `projectName` next to `token` — this path makes that work).
  //   2. An explicit `params` object (for partners who prefer to nest).
  //   3. Auto-derived claims from the JWT (handled further below).
  const topLevelScalars = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    if (k === 'token' || k === 'headers' || k === 'payload' || k === 'params') continue;
    if (v == null) continue;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') topLevelScalars[k] = String(v);
  }
  const urlTemplateVars = { ...topLevelScalars, ...(params || {}) };

  // Best-effort auto-extract: if the token is a JWT whose `pk` claim is
  // shaped "<orgid>|<datatype>" (the appengine convention), surface that
  // orgid so we can forward it as a header without the partner having to
  // thread it through the auth body. Signature is NOT verified — the
  // partner's validation URL is the source of trust.
  const autoHeaders = {};
  try {
    const claims = jwt.decode(customerToken);
    const pk = claims && (claims.pk || claims.data?.pk);
    if (typeof pk === 'string' && pk.includes('|')) {
      const orgid = pk.split('|')[0];
      autoHeaders.orgid = orgid;
      if (urlTemplateVars.orgid === undefined) urlTemplateVars.orgid = orgid;
    }
  } catch (_) { /* not a JWT, skip */ }

  // Substitute :paramName placeholders in the validation URL. Uses
  // Express-style REST params — e.g. `.../get-spinforge/:devEnvName`
  // gets the `devEnvName` value from the request body's `params`.
  // Missing variables are an integration bug on the caller's side —
  // fail fast with a 400 that names the missing param.
  const PARAM_RE = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const tmplVars = Array.from(String(partner.validationUrl || '').matchAll(PARAM_RE))
    .map((m) => m[1]);
  const missing = tmplVars.filter((v) => urlTemplateVars[v] == null || urlTemplateVars[v] === '');
  if (missing.length > 0) {
    return res.status(400).json({
      error: 'Missing required URL params for partner validation URL',
      missingParams: missing,
      hint: `Include them under "params" in the request body, e.g. { "params": { "${missing[0]}": "..." } }`,
      validationUrl: partner.validationUrl,
    });
  }
  const resolvedUrl = String(partner.validationUrl || '').replace(
    PARAM_RE,
    (_, k) => encodeURIComponent(String(urlTemplateVars[k]))
  );

  // Merge rules for headers going OUT to the partner's validation URL:
  //   1. Auto-extracted from token claims (e.g. orgid from JWT.pk).
  //   2. partner.validationHeaders — static, set at partner registration
  //      (service-to-service secret, etc.).
  //   3. req.body.headers — per-request dynamic headers from the partner's
  //      backend (highest precedence — they know the user's context best).
  //   4. SpinForge-controlled (Auth, Accept, Content-Type, UA) — locked
  //      down so partners can't smuggle in a different auth.
  const outboundHeaders = {
    ...autoHeaders,
    ...(partner.validationHeaders || {}),
    ...(requestHeaders && typeof requestHeaders === 'object' ? requestHeaders : {}),
    Authorization: `Bearer ${customerToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'SpinForge-Partner-Auth/1.0',
  };

  let partnerResponse;
  try {
    const method = (partner.validationMethod || 'POST').toUpperCase();
    partnerResponse = await axios({
      method,
      url: resolvedUrl,
      timeout: Number(partner.verifyTimeoutMs) || 5000,
      headers: outboundHeaders,
      ...(method === 'POST' || method === 'PUT' || method === 'PATCH'
        ? { data: payload || {} }
        : {}),
      validateStatus: (s) => s < 500,
    });
  } catch (err) {
    logger.warn(`[partners/auth] partner=${partner.id} verify call failed: ${err.message}`);
    return res.status(502).json({
      error: 'Could not reach partner validation endpoint',
      details: err.message,
    });
  }

  const body = partnerResponse.data || {};
  const ok = partnerResponse.status >= 200 && partnerResponse.status < 300;
  const allow = ok && body.allow !== false;

  // Always log the partner's response on reject so operators can tell
  // whether the partner said "no" or the partner's endpoint is broken.
  if (!allow) {
    const bodyPreview =
      typeof body === 'string' ? body.slice(0, 500)
      : JSON.stringify(body).slice(0, 500);
    logger.warn(
      `[partners/auth] partner=${partner.id} REJECTED status=${partnerResponse.status} body=${bodyPreview}`
    );
    return res.status(403).json({
      error: 'Partner did not allow this customer',
      reason: body.reason || body.error || body.message || null,
      partnerStatus: partnerResponse.status,
      // Forward the partner's body verbatim so the caller can see exactly
      // what the partner said. Keep it size-capped to avoid echoing huge
      // pages in our error response.
      partnerBody: typeof body === 'string' ? body.slice(0, 1000) : body,
    });
  }

  const { orgId, email, name } = extractIdentity(body);

  // The SpinForge customer represents the *account* on the partner side,
  // never the logged-in user. Individual users within the account share
  // the same sfc_ token and see the same set of sites.
  if (!orgId) {
    return res.status(502).json({
      error: 'Partner allowed the customer but returned no orgId',
      hint: 'Validation response must include an orgId (or use the `name` field as the org slug).',
    });
  }

  let spinforgeCustomerId;
  try {
    spinforgeCustomerId = await ensureSpinForgeCustomer({
      partnerId: partner.id,
      externalCustomerId: orgId,
      email,
      name,
      metadata: { orgId },
    });
  } catch (err) {
    logger.error('[partners/auth] failed to provision customer:', err);
    return res.status(500).json({ error: err.message });
  }

  let issued;
  try {
    const ttlSeconds = Number(partner.tokenTtlSeconds || 3600);
    const expiryIso = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    issued = await customerTokenService.createToken({
      customerId: spinforgeCustomerId,
      userEmail: email || `partner-${partner.id}`,
      name: `partner:${partner.name}:${crypto.randomBytes(3).toString('hex')}`,
      expiry: expiryIso,
    });
  } catch (err) {
    logger.error('[partners/auth] failed to issue customer token:', err);
    return res.status(500).json({ error: err.message });
  }

  // Optional one-shot site upsert. If the caller included a `site` object
  // (or just a `projectName` — in which case we synthesize a default
  // site record), we create-or-update the site immediately using the
  // session we just minted. Saves the partner the /auth → /sites
  // two-step on every deploy. ssl_enabled is forced true regardless.
  //
  // The primary domain is ALWAYS auto-generated as
  // `{projectName}-{orgId}.spinforge.dev`. Partners never supply it —
  // that keeps the public namespace under our control and means the
  // same projectName under two orgs doesn't collide.
  let siteResult = null;
  const projectName = urlTemplateVars.projectName || req.body.projectName || null;
  const siteInput = (req.body.site && typeof req.body.site === 'object')
    ? req.body.site
    : (projectName ? {} : null);

  if (siteInput && projectName) {
    // Naming convention: `<orgid>-<projectName>.spinforge.dev` for partner
    // hosting so sites group visually by account in DNS. Direct SpinForge
    // customers (no partner) get the simpler `<productName>.spinforge.dev`
    // which happens on the /_api/customer/sites path, not here.
    const autoDomain = `${slugify(orgId)}-${slugify(projectName)}.spinforge.dev`;
    try {
      siteResult = await upsertPartnerSite({
        customerId: spinforgeCustomerId,
        input: { type: 'static', ...siteInput, domain: autoDomain },
      });
    } catch (err) {
      logger.error('[partners/auth] site upsert failed:', err.message);
      siteResult = { error: err.message };
    }
  }

  logger.info(
    `[partners/auth] partner=${partner.id} customer=${spinforgeCustomerId} orgId=${orgId} url=${resolvedUrl} status=${partnerResponse.status}`
  );

  res.json({
    success: true,
    token: issued.token,
    customerId: spinforgeCustomerId,
    expiresAt: issued.expiresAt,
    partner: { id: partner.id, name: partner.name },
    ...(siteResult ? { site: siteResult } : {}),
  });
});

// Shared upsert used by /_partners/auth and (later) any dashboard code
// that wants to reconcile a partner's site from a single payload. Handles
// the full lifecycle: create if new, update fields + aliases if existing,
// register indexes, fire auto-cert. Never returns 5xx to the caller —
// on failure it throws a plain Error.
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function upsertPartnerSite({ customerId, input }) {
  const domain = String(input.domain || '').trim().toLowerCase();
  if (!domain) throw new Error('site.domain is required');

  const NomadService = require('../services/NomadService');
  const nomad = new NomadService();
  const sitesIndex = require('../utils/sites-index');
  const autoCert = require('../utils/auto-cert');

  const existingRaw = await redisClient.get(`site:${domain}`);
  const existing = existingRaw ? JSON.parse(existingRaw) : null;

  if (existing && existing.customerId !== customerId) {
    throw new Error(`Domain ${domain} is already owned by a different customer`);
  }

  const now = new Date().toISOString();
  const site = {
    ...(existing || {}),
    ...input,
    domain,
    customerId,
    enabled: input.enabled !== false,
    ssl_enabled: true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  // Schedule container/node workloads on Nomad.
  if (site.type === 'container' || site.type === 'node') {
    const configChanged =
      !existing ||
      JSON.stringify(existing.containerConfig) !== JSON.stringify(site.containerConfig);
    if (configChanged) {
      site.orchestrator = 'nomad';
      const deployed = await nomad.deploySite(site);
      site.nomadJobId = deployed.jobId;
      site.nomadEvalId = deployed.evalId;
    }
  }

  await redisClient.set(`site:${domain}`, JSON.stringify(site));
  await sitesIndex.registerSite(domain, customerId);

  // Reconcile aliases — full desired set each call, we diff.
  const oldAliases = Array.isArray(existing?.aliases) ? existing.aliases : [];
  const newAliases = Array.isArray(site.aliases) ? site.aliases : [];
  const newSet = new Set(newAliases.map((a) => String(a).trim()).filter(Boolean));
  for (const a of oldAliases) {
    if (!newSet.has(String(a).trim())) {
      await redisClient.del(`alias:${String(a).trim()}`);
    }
  }
  for (const a of newSet) {
    await redisClient.set(`alias:${a}`, domain);
    autoCert.maybeAutoIssueCert({ ...site, domain: a });
  }
  autoCert.maybeAutoIssueCert(site);

  return { created: !existing, domain, aliases: Array.from(newSet) };
}

// Partner ping — useful for setup / health monitoring on the partner side.
router.get('/health', (req, res) => {
  res.json({ ok: true, partner: { id: req.partner.id, name: req.partner.name } });
});

// Helpful response for someone who hits /_partners/auth with the wrong
// method (most often a GET from a browser address bar). Express's default
// 404 here is a bare "Cannot GET" HTML page that confuses people debugging
// the integration — point them at the right shape instead.
router.all('/auth', (req, res) => {
  res.status(405).json({
    error: 'Method Not Allowed',
    expected: 'POST application/json',
    body: {
      token: '<your customer\'s auth token>',
      headers: '{ optional per-request headers forwarded to your validation URL }',
      payload: '{ optional JSON body forwarded to your validation URL }',
    },
    requiredHeaders: { 'X-Partner-Key': 'sfpk_...' },
    docsHint: 'See /_partners/health to verify your partner key, then POST here.',
  });
});

module.exports = router;
