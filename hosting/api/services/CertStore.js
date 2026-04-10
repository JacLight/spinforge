/**
 * SpinForge - Certificate Storage Service
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Single source of truth for SSL certificate storage. Replaces what was
 * previously split across CertificateService (issuance + parse), SSLCacheService
 * (Redis cache), and SSLMappingService (lookup).
 *
 * Storage layout (api container side):
 *   /data/certs/live/<domain>/fullchain.pem    ← what OpenResty reads
 *   /data/certs/live/<domain>/privkey.pem      ← (mounted as /etc/letsencrypt
 *                                                  in the openresty container)
 *
 * Redis layout:
 *   cert:<domain>          → JSON metadata (status, validTo, lastError, history…)
 *   active-certs           → SET of domains that currently have a cert
 *   ssl:cert:<domain>      → cached PEM body (1h TTL, read by openresty Lua)
 *   ssl:key:<domain>       → cached PEM body (1h TTL, read by openresty Lua)
 *   ssl:meta:<domain>      → cache metadata (cached_at, sha256)
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const CERTS_BASE = process.env.CERTS_PATH || '/data/certs';
const LIVE_DIR = path.join(CERTS_BASE, 'live');
const CACHE_TTL_SECONDS = 3600;
const HISTORY_LIMIT = 10;

// Statuses a cert metadata record can carry. Surfaced to the admin UI for
// troubleshooting — keep human-readable.
const CertStatus = Object.freeze({
  PENDING: 'pending',     // requested, waiting for first issuance attempt
  ISSUING: 'issuing',     // ACME flow in progress
  ACTIVE: 'active',       // installed, valid
  RENEWING: 'renewing',   // ACME flow in progress for an existing cert
  ERROR: 'error',         // last attempt failed; will retry on schedule
  EXPIRED: 'expired',     // valid_to has passed
});

class CertStore {
  constructor(redisClient, { logger } = {}) {
    this.redis = redisClient;
    this.logger = logger || console;
  }

  // ─── Path helpers ─────────────────────────────────────────────────────
  fullchainPath(domain) {
    return path.join(LIVE_DIR, domain, 'fullchain.pem');
  }
  privKeyPath(domain) {
    return path.join(LIVE_DIR, domain, 'privkey.pem');
  }
  certDir(domain) {
    return path.join(LIVE_DIR, domain);
  }

  // ─── On-disk persistence ──────────────────────────────────────────────

  /**
   * Atomically write a freshly-issued cert+key pair to disk and refresh the
   * Redis hot-cache that OpenResty's Lua handler reads on every TLS handshake.
   *
   * @param {string} domain
   * @param {{cert: string, key: string, chain?: string}} pem  PEM-encoded
   */
  async writeCert(domain, pem) {
    if (!pem || !pem.cert || !pem.key) {
      throw new Error('writeCert requires { cert, key }');
    }
    const dir = this.certDir(domain);
    await fs.mkdir(dir, { recursive: true });

    // Write to a temp file then rename so OpenResty never observes a half-
    // written cert (atomic on the same filesystem).
    const fullchain = pem.chain ? `${pem.cert.trim()}\n${pem.chain.trim()}\n` : `${pem.cert.trim()}\n`;
    const tmpCert = path.join(dir, `.fullchain.pem.tmp.${process.pid}.${Date.now()}`);
    const tmpKey = path.join(dir, `.privkey.pem.tmp.${process.pid}.${Date.now()}`);
    await fs.writeFile(tmpCert, fullchain, { mode: 0o644 });
    await fs.writeFile(tmpKey, pem.key, { mode: 0o600 });
    await fs.rename(tmpCert, this.fullchainPath(domain));
    await fs.rename(tmpKey, this.privKeyPath(domain));

    // Refresh the OpenResty hot-cache so the next handshake doesn't have to
    // touch the filesystem.
    await this.refreshHotCache(domain);
  }

  async readPemFromDisk(domain) {
    try {
      const [cert, key] = await Promise.all([
        fs.readFile(this.fullchainPath(domain), 'utf8'),
        fs.readFile(this.privKeyPath(domain), 'utf8'),
      ]);
      return { cert, key };
    } catch (err) {
      return null;
    }
  }

  async deleteFromDisk(domain) {
    const dir = this.certDir(domain);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (err) {
      this.logger.warn?.(`CertStore: failed to delete ${dir}: ${err.message}`);
    }
  }

  // ─── Redis hot-cache (read by openresty/lua/ssl_handler.lua) ──────────

  async refreshHotCache(domain) {
    const pem = await this.readPemFromDisk(domain);
    if (!pem) return false;

    const certHash = crypto.createHash('sha256').update(pem.cert).digest('hex');
    await Promise.all([
      this.redis.setEx(`ssl:cert:${domain}`, CACHE_TTL_SECONDS, pem.cert),
      this.redis.setEx(`ssl:key:${domain}`, CACHE_TTL_SECONDS, pem.key),
      this.redis.setEx(`ssl:meta:${domain}`, CACHE_TTL_SECONDS, JSON.stringify({
        domain,
        cached_at: new Date().toISOString(),
        cert_hash: certHash,
      })),
    ]);
    return true;
  }

  async evictHotCache(domain) {
    await Promise.all([
      this.redis.del(`ssl:cert:${domain}`),
      this.redis.del(`ssl:key:${domain}`),
      this.redis.del(`ssl:meta:${domain}`),
    ]);
  }

  /**
   * Refresh the hot-cache for every domain in active-certs. Called once on
   * server boot. Replaces SSLCacheService's old 5-minute polling loop —
   * the renewal scheduler will refresh individual certs as it touches them.
   */
  async warmupHotCache() {
    const domains = await this.redis.sMembers('active-certs');
    let ok = 0;
    for (const domain of domains || []) {
      try {
        if (await this.refreshHotCache(domain)) ok++;
      } catch (err) {
        this.logger.warn?.(`CertStore: warmup failed for ${domain}: ${err.message}`);
      }
    }
    this.logger.info?.(`CertStore: warmed hot-cache for ${ok} domain(s)`);
    return ok;
  }

  // ─── Cert metadata in Redis ───────────────────────────────────────────

  async getMetadata(domain) {
    const raw = await this.redis.get(`cert:${domain}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  async putMetadata(domain, patch) {
    const existing = (await this.getMetadata(domain)) || { domain };
    const merged = { ...existing, ...patch, domain, updatedAt: new Date().toISOString() };
    await this.redis.set(`cert:${domain}`, JSON.stringify(merged));
    return merged;
  }

  async deleteMetadata(domain) {
    await this.redis.del(`cert:${domain}`);
    await this.redis.sRem('active-certs', domain);
  }

  /**
   * Append an entry to the cert's history log (capped at HISTORY_LIMIT).
   * Use for visibility into what happened: issuance attempts, renewals,
   * errors, manual triggers.
   */
  async appendHistory(domain, entry) {
    const meta = (await this.getMetadata(domain)) || { domain };
    const history = Array.isArray(meta.history) ? meta.history.slice() : [];
    history.unshift({ at: new Date().toISOString(), ...entry });
    if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
    return this.putMetadata(domain, { history });
  }

  // ─── Higher-level "give me a friendly view of this cert" ──────────────

  /**
   * Returns the full public-facing record for one domain: metadata + on-disk
   * presence + computed derived fields like daysUntilExpiry. This is what
   * GET /api/ssl/certificates returns to the admin UI.
   */
  async describe(domain) {
    const meta = await this.getMetadata(domain);
    if (!meta) return null;

    const onDisk = await this.fileExists(this.fullchainPath(domain));
    const out = { ...meta, filesExist: onDisk };

    if (meta.validTo) {
      const expiresAt = new Date(meta.validTo);
      const ms = expiresAt.getTime() - Date.now();
      out.daysUntilExpiry = Math.floor(ms / (1000 * 60 * 60 * 24));
      out.isExpired = ms < 0;
      if (out.isExpired && meta.status === CertStatus.ACTIVE) {
        out.status = CertStatus.EXPIRED;
      }
    }
    return out;
  }

  /**
   * List every cert known to the system, with describe() applied to each.
   */
  async listAll() {
    const domains = await this.redis.sMembers('active-certs');
    if (!domains || domains.length === 0) return [];
    const out = [];
    for (const d of domains) {
      const desc = await this.describe(d);
      if (desc) out.push(desc);
    }
    return out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  // ─── Cert parsing (no shell-out, uses node:crypto) ────────────────────

  /**
   * Parse a PEM cert without shelling out to openssl. Uses Node's built-in
   * X509Certificate (Node 15+).
   */
  parsePem(pem) {
    if (!pem) return {};
    try {
      const X509Certificate = crypto.X509Certificate;
      if (!X509Certificate) {
        throw new Error('crypto.X509Certificate not available (need Node 15+)');
      }
      const cert = new X509Certificate(pem);
      return {
        commonName: this.extractCN(cert.subject),
        subject: cert.subject,
        issuer: this.extractCN(cert.issuer) || cert.issuer,
        validFrom: new Date(cert.validFrom).toISOString(),
        validTo: new Date(cert.validTo).toISOString(),
        fingerprint: cert.fingerprint256,
        // SANs
        subjectAltName: cert.subjectAltName || null,
      };
    } catch (err) {
      this.logger.warn?.(`CertStore: parsePem failed: ${err.message}`);
      return {};
    }
  }

  extractCN(distinguishedName) {
    if (!distinguishedName) return null;
    const m = /CN=([^,\n]+)/.exec(distinguishedName);
    return m ? m[1].trim() : null;
  }

  // ─── Misc ─────────────────────────────────────────────────────────────

  async fileExists(p) {
    try {
      await fs.access(p);
      return true;
    } catch (_) {
      return false;
    }
  }

  async hasActiveCert(domain) {
    const meta = await this.getMetadata(domain);
    if (!meta) return false;
    if (meta.status !== CertStatus.ACTIVE) return false;
    return this.fileExists(this.fullchainPath(domain));
  }
}

CertStore.CertStatus = CertStatus;

module.exports = CertStore;
