/**
 * Vault / OpenBao admin surface.
 *
 * Two orthogonal surfaces live here:
 *
 *   /platform/*  — secret/platform/<key>  (AWS, admin-JWT, grafana …)
 *                  Read/write by admin UI. Changes double-write to the
 *                  Nomad Variable for the dependent job so the Nomad
 *                  template re-renders and the consumer restarts.
 *
 *   /customers/:customerId/*
 *                — secret/customer/<customerId>/<key>  (per-tenant)
 *                  Admin UI CRUD + bootstrap endpoint that mints the
 *                  periodic token used by the customer's deployed
 *                  containers.
 *
 * All mutations publish an audit event via the shared EventStream so
 * they show up in the events feed alongside deploys, invites, etc.
 *
 * Auth: already gated by authenticateAdmin at the /api mount.
 */

const express = require('express');
const axios = require('axios');

const router = express.Router();

const VAULT_PUBLIC_ADDR = process.env.VAULT_PUBLIC_ADDR || 'https://vault.spinforge.dev';

// Map from platform-secret key → Nomad Variable path + item mapping.
// When the admin UI writes secret/platform/aws, we want hosting/api's
// template to see the new values without a manual redeploy. Nomad's
// template agent picks up Variable mutations automatically (change_mode
// = restart on the template stanza).
const PLATFORM_NOMAD_MIRRORS = {
  aws: {
    path: 'nomad/jobs/api',
    map: {
      access_key_id: 'AWS_ACCESS_KEY_ID',
      secret_access_key: 'AWS_SECRET_ACCESS_KEY',
      region: 'AWS_REGION',
      mail_from: 'MAIL_FROM',
    },
  },
  'admin-jwt': {
    // Both api + building-api need this — mirror to both jobs.
    paths: ['nomad/jobs/api', 'nomad/jobs/building-api'],
    map: { secret: 'ADMIN_TOKEN_SECRET' },
  },
};

async function auditEvent(req, kind, target, context) {
  try {
    if (req.app.locals.events) {
      await req.app.locals.events.publish(kind, target, { context });
    }
  } catch (_) {
    // Audit failures never block the primary action — they're best-effort.
  }
}

function bad(message, status = 400) {
  return Object.assign(new Error(message), { status, expose: true });
}

// Update a Nomad Variable in-place. Uses Nomad's HTTP API directly —
// the building-api task already has NOMAD_ADDR in its env.
async function mirrorToNomadVar(path, patch) {
  const base = process.env.NOMAD_ADDR || 'http://127.0.0.1:4646';
  const getRes = await axios.get(`${base}/v1/var/${path}`, {
    validateStatus: (s) => s < 500,
  });
  const existing = getRes.status === 200 ? (getRes.data?.Items || {}) : {};
  const items = { ...existing, ...patch };
  const put = await axios.put(
    `${base}/v1/var/${path}`,
    { Path: path, Items: items },
    { validateStatus: (s) => s < 500 },
  );
  if (put.status >= 400) {
    throw new Error(`nomad var put ${path} failed (${put.status}): ${JSON.stringify(put.data)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Platform secrets
// ═══════════════════════════════════════════════════════════════════════

// GET /api/vault/platform → { keys: [...] }
router.get('/platform', async (req, res, next) => {
  try {
    const keys = await req.app.locals.vault.listPlatformKeys();
    res.json({ keys });
  } catch (err) { next(err); }
});

// GET /api/vault/platform/:key → { key, data, metadata }
router.get('/platform/:key', async (req, res, next) => {
  try {
    const out = await req.app.locals.vault.readPlatformSecret(req.params.key);
    if (!out) return res.status(404).json({ error: 'secret_not_found', key: req.params.key });
    res.json({ key: req.params.key, ...out });
  } catch (err) { next(err); }
});

// PUT /api/vault/platform/:key  body { data: {k: v, ...} }
router.put('/platform/:key', async (req, res, next) => {
  try {
    const data = req.body?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw bad('body.data must be an object');
    }
    const out = await req.app.locals.vault.writePlatformSecret(req.params.key, data);

    // Mirror to Nomad Variables so the running job sees the new values.
    const mirror = PLATFORM_NOMAD_MIRRORS[req.params.key];
    if (mirror) {
      const patch = {};
      for (const [vaultField, nomadField] of Object.entries(mirror.map)) {
        if (data[vaultField] !== undefined) patch[nomadField] = String(data[vaultField]);
      }
      const paths = mirror.paths || (mirror.path ? [mirror.path] : []);
      for (const p of paths) {
        try { await mirrorToNomadVar(p, patch); }
        catch (err) { req.app.locals.logger?.warn?.(`[vault] nomad mirror ${p} failed: ${err.message}`); }
      }
    }

    await auditEvent(req, 'platform.secret.updated', req.params.key, {
      key: req.params.key,
      fields: Object.keys(data),
      version: out.version,
      actor: req.adminActor || 'admin',
    });
    res.json({ ok: true, ...out });
  } catch (err) { next(err); }
});

// DELETE /api/vault/platform/:key — destroys ALL versions (metadata wipe).
router.delete('/platform/:key', async (req, res, next) => {
  try {
    await req.app.locals.vault.deletePlatformSecret(req.params.key);
    await auditEvent(req, 'platform.secret.deleted', req.params.key, {
      key: req.params.key,
      actor: req.adminActor || 'admin',
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════
// Customer-scoped secrets
// ═══════════════════════════════════════════════════════════════════════

// POST /api/vault/customers/:customerId/bootstrap
// Mints (or returns cached) periodic token scoped to
// secret/customer/<id>/*. Admin/deploy path calls this before launching
// a customer container so the container env can carry VAULT_TOKEN.
router.post('/customers/:customerId/bootstrap', async (req, res, next) => {
  try {
    const customerId = req.params.customerId;
    if (!/^[a-zA-Z0-9_\-]{1,64}$/.test(customerId)) {
      throw bad('customerId must be 1-64 chars [a-zA-Z0-9_-]');
    }
    const rotate = req.query.rotate === 'true';
    const redis = req.app.locals.redis;
    const cacheKey = `customer:${customerId}:vault_token`;

    let token;
    let accessor;
    let policyName;
    let leaseDurationSec;
    let reused = false;

    if (!rotate) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          token = parsed.token;
          accessor = parsed.accessor;
          policyName = parsed.policyName;
          leaseDurationSec = parsed.leaseDurationSec;
          reused = true;
        } catch (_) { /* fall through to mint */ }
      }
    }

    if (!token) {
      const minted = await req.app.locals.vault.mintCustomerToken(customerId, {
        ttlSeconds: 168 * 3600,
      });
      token = minted.token;
      accessor = minted.accessor;
      policyName = minted.policyName;
      leaseDurationSec = minted.leaseDurationSec;
      await redis.set(
        cacheKey,
        JSON.stringify({ token, accessor, policyName, leaseDurationSec, mintedAt: Date.now() }),
      );
      await auditEvent(req, rotate ? 'customer.vault.rotated' : 'customer.vault.bootstrapped', customerId, {
        customerId, accessor, policyName, actor: req.adminActor || 'admin',
      });
    }

    res.json({
      customerId,
      reused,
      vaultAddr: VAULT_PUBLIC_ADDR,
      token,
      accessor,
      policyName,
      leaseDurationSec,
      paths: {
        self: `secret/customer/${customerId}/`,
        data: `secret/data/customer/${customerId}/<key>`,
        metadata: `secret/metadata/customer/${customerId}/<key>`,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/vault/customers/:customerId → list keys
router.get('/customers/:customerId', async (req, res, next) => {
  try {
    const keys = await req.app.locals.vault.listCustomerKeys(req.params.customerId);
    res.json({ customerId: req.params.customerId, keys });
  } catch (err) { next(err); }
});

// GET /api/vault/customers/:customerId/token → cached bootstrap token,
// if any. No mint side-effect.
router.get('/customers/:customerId/token', async (req, res, next) => {
  try {
    const cached = await req.app.locals.redis.get(`customer:${req.params.customerId}:vault_token`);
    if (!cached) return res.status(404).json({ error: 'customer_token_not_bootstrapped' });
    const parsed = JSON.parse(cached);
    res.json({
      customerId: req.params.customerId,
      vaultAddr: VAULT_PUBLIC_ADDR,
      token: parsed.token,
      accessor: parsed.accessor,
      policyName: parsed.policyName,
      leaseDurationSec: parsed.leaseDurationSec,
      mintedAt: parsed.mintedAt,
    });
  } catch (err) { next(err); }
});

// GET /api/vault/customers/:customerId/:key
router.get('/customers/:customerId/keys/:key', async (req, res, next) => {
  try {
    const out = await req.app.locals.vault.readCustomerSecret(req.params.customerId, req.params.key);
    if (!out) return res.status(404).json({ error: 'secret_not_found' });
    res.json({ customerId: req.params.customerId, key: req.params.key, ...out });
  } catch (err) { next(err); }
});

// PUT /api/vault/customers/:customerId/:key
router.put('/customers/:customerId/keys/:key', async (req, res, next) => {
  try {
    const data = req.body?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw bad('body.data must be an object');
    }
    const out = await req.app.locals.vault.writeCustomerSecret(
      req.params.customerId, req.params.key, data,
    );
    await auditEvent(req, 'customer.secret.updated', req.params.customerId, {
      customerId: req.params.customerId, key: req.params.key,
      fields: Object.keys(data), version: out.version,
      actor: req.adminActor || 'admin',
    });
    res.json({ ok: true, ...out });
  } catch (err) { next(err); }
});

// DELETE /api/vault/customers/:customerId/:key
router.delete('/customers/:customerId/keys/:key', async (req, res, next) => {
  try {
    await req.app.locals.vault.deleteCustomerSecret(req.params.customerId, req.params.key);
    await auditEvent(req, 'customer.secret.deleted', req.params.customerId, {
      customerId: req.params.customerId, key: req.params.key,
      actor: req.adminActor || 'admin',
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
