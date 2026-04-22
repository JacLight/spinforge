/**
 * Signing profile HTTP surface.
 *
 * Admin-only (once auth is wired — PLATFORM_PLAN.md O4). Customers never
 * see this directly; the admin UI drives it on their behalf.
 */

const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const multer = require('multer');
const { UPLOADS_TMP, MAX_UPLOAD_BYTES } = require('../utils/constants');

const router = express.Router();

fs.mkdirSync(UPLOADS_TMP, { recursive: true });

// Cert + profile + keystore files are small (<1MB each). 20MB cap is
// generous and still catches bad uploads early.
const upload = multer({
  dest: UPLOADS_TMP,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ─── POST /api/signing-profiles ─────────────────────────────────────
// multipart with any number of file fields + `meta` JSON string.
// Every uploaded file becomes one entry in the Vault secret bundle,
// keyed by its field name: e.g. field name `cert` → Vault key `cert`
// containing base64 of the file bytes.
router.post('/', upload.any(), async (req, res, next) => {
  const toClean = (req.files || []).map((f) => f.path);
  try {
    const meta = parseMeta(req.body.meta);
    if (!meta.customerId) throw bad('meta.customerId is required');
    if (!meta.platform) throw bad('meta.platform is required');

    const secrets = {};
    // Scalar secret values passed inline (e.g. "keystorePassword",
    // "keyPassword") arrive as regular body fields, not files. Accept
    // strings — but never log them.
    for (const [k, v] of Object.entries(req.body || {})) {
      if (k === 'meta') continue;
      if (typeof v === 'string') secrets[k] = v;
    }
    for (const f of req.files || []) {
      const buf = await fsp.readFile(f.path);
      secrets[f.fieldname] = buf.toString('base64');
    }

    const profile = await req.app.locals.signing.create({
      customerId: meta.customerId,
      platform: meta.platform,
      label: meta.label,
      metadata: meta.metadata || {},
      secrets,
    });

    res.status(201).json(profile);
  } catch (err) {
    next(err);
  } finally {
    for (const p of toClean) fsp.unlink(p).catch(() => {});
  }
});

// Without `?customerId=` returns every profile cluster-wide (admin UI).
// With `?customerId=` filters to that customer.
router.get('/', async (req, res, next) => {
  try {
    const customerId = req.query.customerId;
    const limit  = Math.min(500, parseInt(req.query.limit, 10) || 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const profiles = customerId
      ? await req.app.locals.signing.listByCustomer(customerId, { limit, offset })
      : await req.app.locals.signing.listAll({ limit, offset });
    res.json({ customerId: customerId || null, profiles, total: profiles.length });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const p = await req.app.locals.signing.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'signing_profile_not_found' });
    res.json(p);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ok = await req.app.locals.signing.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'signing_profile_not_found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

function parseMeta(input) {
  if (!input) throw bad('meta form field is required');
  try {
    return typeof input === 'string' ? JSON.parse(input) : input;
  } catch (err) {
    throw bad('meta is not valid JSON');
  }
}

function bad(message) {
  return Object.assign(new Error(message), { status: 400, expose: true });
}

module.exports = router;
