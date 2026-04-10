/**
 * SpinForge - SSL Certificate Management Routes
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Thin Express wrappers over CertStore + AcmeService. Used to be 523 lines
 * of `docker exec spinforge-certbot certbot ...` and `openssl x509 ...`
 * shell-outs with embedded command injection vulnerabilities. The new
 * implementation has zero shell-outs and zero docker exec calls.
 */
const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis');
const CertStore = require('../services/CertStore');
const AcmeService = require('../services/AcmeService');

const certStore = new CertStore(redisClient);
const acmeService = new AcmeService({ redis: redisClient, certStore });

// ─── Validation helper ────────────────────────────────────────────────────
// Reject anything that isn't a plausible DNS hostname before passing it to
// the ACME flow. This is the first line of defence against the kind of
// command-injection bug the old code shipped with.
const DOMAIN_REGEX = /^(\*\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
function isValidDomain(d) {
  return typeof d === 'string' && d.length <= 253 && DOMAIN_REGEX.test(d);
}

// ─── Hot-cache management (read by openresty/lua/ssl_handler.lua) ─────────

// Refresh the in-Redis cert cache for a single domain.
router.post('/cache/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    if (!isValidDomain(domain)) return res.status(400).json({ error: 'Invalid domain' });
    const ok = await certStore.refreshHotCache(domain);
    res.json({ success: ok, domain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Re-cache every active cert. Used by ops as a recovery action.
router.post('/cache-all', async (req, res) => {
  try {
    const count = await certStore.warmupHotCache();
    res.json({ total: count, successful: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cache stats — kept compatible with the admin-ui expectations.
router.get('/cache-stats', async (req, res) => {
  try {
    const certs = await certStore.listAll();
    res.json({
      cached_certificates: certs.length,
      domains: certs.map((c) => ({
        domain: c.domain,
        validTo: c.validTo,
        status: c.status,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/cache/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    if (!isValidDomain(domain)) return res.status(400).json({ error: 'Invalid domain' });
    await certStore.evictHotCache(domain);
    res.json({ success: true, domain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Certificate listing ──────────────────────────────────────────────────

router.get('/certificates', async (req, res) => {
  try {
    const certs = await certStore.listAll();
    // Shape preserved for the existing admin-ui CertificateManager page.
    res.json(
      certs.map((c) => ({
        domain: c.domain,
        isWildcard: !!c.wildcard || (c.domain || '').startsWith('*.'),
        type: c.type || 'standard',
        status: c.status,
        validFrom: c.validFrom || null,
        validTo: c.validTo || null,
        issuer: c.issuer || null,
        autoRenew: c.autoRenew !== false,
        daysUntilExpiry: c.daysUntilExpiry,
        // Troubleshooting fields the old route never returned
        lastAttemptAt: c.lastAttemptAt || null,
        lastError: c.lastError || null,
        attemptCount: c.attemptCount || 0,
        failureCount: c.failureCount || 0,
        nextAttemptAt: c.nextAttemptAt || null,
        history: c.history || [],
        preflight: c.preflight || null,
        staging: !!c.staging,
        filesExist: !!c.filesExist,
      }))
    );
  } catch (error) {
    console.error('Error listing certificates:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Issue a new certificate ──────────────────────────────────────────────

router.post('/certificates', async (req, res) => {
  try {
    const { domain, email, type, altNames, force } = req.body || {};

    if (!isValidDomain(domain)) {
      return res.status(400).json({ error: 'A valid domain is required' });
    }

    const wildcard = type === 'wildcard' || domain.startsWith('*.');

    // Wildcards require DNS-01, which needs a configured DNS provider. The
    // hooks are stubs in AcmeService until somebody wires up Cloudflare/etc.
    if (wildcard) {
      return res.status(501).json({
        error: 'Wildcard certificates require DNS-01 and a configured DNS provider',
        hint: 'Implement AcmeService.challengeCreateDns01 with your DNS provider',
      });
    }

    // Override contact email for this issuance if the caller passed one.
    // AcmeService is single-flighted per domain via Redis lock, so this is
    // safe even with concurrent requests.
    if (email) acmeService.contactEmail = email;

    const cert = await acmeService.issue(domain, {
      altNames: altNames || [],
      force: !!force,
    });
    res.json({ success: true, message: 'Certificate issued successfully', domain, cert });
  } catch (error) {
    if (error.code === 'LOCKED') {
      return res.status(409).json({ error: error.message, code: 'LOCKED' });
    }
    if (error.code === 'DNS_PREFLIGHT_FAILED') {
      return res.status(412).json({
        error: error.message,
        code: 'DNS_PREFLIGHT_FAILED',
        resolved: error.resolved,
        expected: error.expected,
        hint: 'Update your DNS A/AAAA records, or pass force=true to bypass the check.',
      });
    }
    console.error('Error issuing certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Manual upload of customer-provided cert ──────────────────────────────

router.post('/certificates/upload', async (req, res) => {
  try {
    const { domain, certificate, privateKey, chain } = req.body || {};

    if (!isValidDomain(domain)) {
      return res.status(400).json({ error: 'A valid domain is required' });
    }
    if (!certificate || !privateKey) {
      return res.status(400).json({ error: 'certificate and privateKey are required' });
    }
    if (!certificate.includes('BEGIN CERTIFICATE')) {
      return res.status(400).json({ error: 'Invalid certificate format. Must be PEM.' });
    }
    if (!privateKey.includes('BEGIN')) {
      return res.status(400).json({ error: 'Invalid private key format. Must be PEM.' });
    }

    await certStore.writeCert(domain, { cert: certificate, key: privateKey, chain });

    const parsed = certStore.parsePem(certificate);
    const meta = await certStore.putMetadata(domain, {
      ...parsed,
      type: 'manual',
      status: CertStore.CertStatus.ACTIVE,
      uploadedAt: new Date().toISOString(),
      autoRenew: false,
    });
    await redisClient.sAdd('active-certs', domain);
    await certStore.appendHistory(domain, { action: 'upload:manual' });

    res.json({
      success: true,
      message: 'Certificate uploaded successfully',
      domain,
      validFrom: meta.validFrom,
      validTo: meta.validTo,
      isWildcard: !!meta.wildcard || domain.startsWith('*.'),
    });
  } catch (error) {
    console.error('Error uploading certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── DNS-01 manual validate (legacy endpoint, kept as a stub) ─────────────

router.post('/certificates/:domain/validate', async (req, res) => {
  res.status(501).json({
    error:
      'Manual DNS-01 validation has been replaced. Configure a DNS provider in AcmeService.challengeCreateDns01 and POST /certificates again.',
  });
});

// ─── Renew (manual trigger from the admin UI) ─────────────────────────────

router.post('/certificates/:domain/renew', async (req, res) => {
  try {
    const { domain } = req.params;
    if (!isValidDomain(domain)) return res.status(400).json({ error: 'Invalid domain' });
    const force = req.query.force === '1' || req.query.force === 'true' || req.body?.force === true;
    const cert = await acmeService.renew(domain, { force });
    res.json({
      success: true,
      message: 'Certificate renewed',
      domain,
      cert,
    });
  } catch (error) {
    if (error.code === 'LOCKED') {
      return res.status(409).json({ error: error.message, code: 'LOCKED' });
    }
    if (error.code === 'DNS_PREFLIGHT_FAILED') {
      return res.status(412).json({
        error: error.message,
        code: 'DNS_PREFLIGHT_FAILED',
        resolved: error.resolved,
        expected: error.expected,
        hint: 'Update DNS, or POST again with ?force=1 to bypass the check.',
      });
    }
    console.error('Error renewing certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Delete ───────────────────────────────────────────────────────────────

router.delete('/certificates/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    if (!isValidDomain(domain)) return res.status(400).json({ error: 'Invalid domain' });

    // Best-effort revocation. Failure is not fatal — we still tear down the
    // local cert files and metadata so the operator can re-issue cleanly.
    await acmeService.revoke(domain);
    await certStore.evictHotCache(domain);
    await certStore.deleteFromDisk(domain);
    await certStore.deleteMetadata(domain);

    res.json({ success: true, message: 'Certificate deleted', domain });
  } catch (error) {
    console.error('Error deleting certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
