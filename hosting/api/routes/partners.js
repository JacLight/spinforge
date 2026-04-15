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

// Pull identity out of the partner's validation response. Accepts a few
// common shapes so new partners don't have to reshape their existing
// endpoints:
//   { customerId, email, name }                               ← preferred
//   { id, email, name }
//   { user, firstName, lastName }                             ← appengine shape
//   { data: { email, name } } / nested variations
function extractIdentity(body) {
  const b = body && typeof body === 'object' ? body : {};
  const d = b.data && typeof b.data === 'object' ? b.data : {};

  const email = b.user || b.email || d.email || null;
  const firstName = b.firstName || d.firstName || '';
  const lastName = b.lastName || d.lastName || '';
  const name =
    (firstName || lastName)
      ? `${firstName} ${lastName}`.trim()
      : b.name || b.fullName || d.name || d.fullName || email || null;

  const externalCustomerId =
    b.customerId || b.customer_id || b.externalCustomerId ||
    b.id || b.sub || b.user_id ||
    email ||
    d.id || d.sub || d.username || null;

  return { externalCustomerId: externalCustomerId ? String(externalCustomerId) : null, email, name };
}

// ─── POST /_partners/auth ────────────────────────────────────────────
router.post('/auth', async (req, res) => {
  const partner = req.partner;
  const { token: customerToken, payload, headers: requestHeaders } = req.body || {};

  if (!customerToken || typeof customerToken !== 'string') {
    return res.status(400).json({ error: 'Request body must include a "token" string' });
  }

  // Merge rules for headers going OUT to the partner's validation URL:
  //   1. SpinForge-controlled headers (Auth, Accept, Content-Type, UA) —
  //      never overridable, avoids partners smuggling in a different auth.
  //   2. partner.validationHeaders — static, set at partner registration
  //      (e.g. a service-to-service secret the partner requires every time).
  //   3. req.body.headers — per-request dynamic headers from the partner's
  //      backend (e.g. `orgid: demo` which differs by customer).
  //
  // Per-request wins over static (partner's backend is closer to the user's
  // context than the registration-time config). SpinForge-controlled always
  // wins last.
  const outboundHeaders = {
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
      url: partner.validationUrl,
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

  if (!allow) {
    return res.status(403).json({
      error: 'Partner did not allow this customer',
      reason: body.reason || body.error || null,
      partnerStatus: partnerResponse.status,
    });
  }

  const { externalCustomerId, email, name } = extractIdentity(body);
  if (!externalCustomerId) {
    return res.status(502).json({
      error: 'Partner allowed the customer but returned no usable identity',
      hint: 'Response must include customerId / id / email / user.',
    });
  }

  let spinforgeCustomerId;
  try {
    spinforgeCustomerId = await ensureSpinForgeCustomer({
      partnerId: partner.id,
      externalCustomerId,
      email,
      name,
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

  logger.info(
    `[partners/auth] partner=${partner.id} customer=${spinforgeCustomerId} allowed`
  );

  res.json({
    success: true,
    token: issued.token,
    customerId: spinforgeCustomerId,
    expiresAt: issued.expiresAt,
    partner: { id: partner.id, name: partner.name },
  });
});

// Partner ping — useful for setup / health monitoring on the partner side.
router.get('/health', (req, res) => {
  res.json({ ok: true, partner: { id: req.partner.id, name: req.partner.name } });
});

module.exports = router;
