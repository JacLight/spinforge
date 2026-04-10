/**
 * SpinForge - CertificateService (compatibility shim)
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * This file used to be 377 lines of `docker exec spinforge-certbot ...` and
 * `openssl x509 ...` shell-outs. It is now a thin shim over CertStore +
 * AcmeService. Existing routes (routes/ssl.js, routes/certificates.js) keep
 * the same API surface so they don't need to change much.
 *
 * If you are writing new code, prefer importing CertStore and AcmeService
 * directly. The shim only exists for back-compat with existing route handlers.
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const CertStore = require('./CertStore');
const AcmeService = require('./AcmeService');

class CertificateService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.certsPath = process.env.CERTS_PATH || '/data/certs';
    this.store = new CertStore(redisClient);
    this.acme = new AcmeService({ redis: redisClient, certStore: this.store });
  }

  // ─── Read ─────────────────────────────────────────────────────────────

  async getCertificate(domain) {
    return this.store.describe(domain);
  }

  async listCertificates() {
    return this.store.listAll();
  }

  // ─── Issue / renew (now via ACME, no shell-outs) ──────────────────────

  /**
   * @param {string} domain
   * @param {string} [email]   contact email override
   * @param {boolean} [staging] use LE staging
   */
  async generateLetsEncryptCertificate(domain, email, staging = false) {
    // The shim respects the per-call email and staging flag for back-compat,
    // but the AcmeService instance is shared so we briefly override it. This
    // is OK because issue() is single-flighted per domain via Redis lock.
    if (email) this.acme.contactEmail = email;
    if (typeof staging === 'boolean') this.acme.staging = staging;
    return this.acme.issue(domain);
  }

  async renewCertificate(domain) {
    return this.acme.renew(domain);
  }

  // ─── Manual upload of customer-provided cert ──────────────────────────

  async uploadManualCertificate(domain, { certificate, privateKey, chain }) {
    if (!certificate || !privateKey) {
      throw new Error('certificate and privateKey are required');
    }
    await this.store.writeCert(domain, {
      cert: certificate,
      key: privateKey,
      chain: chain || null,
    });

    const parsed = this.store.parsePem(certificate);
    const meta = await this.store.putMetadata(domain, {
      ...parsed,
      type: 'manual',
      status: CertStore.CertStatus.ACTIVE,
      uploadedAt: new Date().toISOString(),
      autoRenew: false,
    });
    await this.redis.sAdd('active-certs', domain);
    await this.store.appendHistory(domain, { action: 'upload:manual' });
    return meta;
  }

  // ─── Delete ───────────────────────────────────────────────────────────

  async deleteCertificate(domain) {
    await this.store.evictHotCache(domain);
    await this.store.deleteFromDisk(domain);
    await this.store.deleteMetadata(domain);
    return { success: true };
  }

  // ─── Settings (autoRenew toggle, contact email, etc.) ─────────────────

  async updateCertificateSettings(domain, settings) {
    return this.store.putMetadata(domain, settings);
  }

  // ─── Cert parsing helpers (no more openssl shell-out) ─────────────────

  async parseCertificateInfo(domain) {
    const pem = await this.store.readPemFromDisk(domain);
    if (!pem) return {};
    return this.store.parsePem(pem.cert);
  }

  async parseCertificateFromContent(certContent) {
    return this.store.parsePem(certContent);
  }

  // ─── Renewal sweep (kept for back-compat) ─────────────────────────────

  async checkAndRenewCertificates() {
    // Real renewal lives in CertRenewalScheduler now. This is kept for any
    // existing callers and just delegates a single sweep.
    const all = await this.store.listAll();
    for (const cert of all) {
      if (cert.type !== 'letsencrypt' || cert.autoRenew === false) continue;
      if (typeof cert.daysUntilExpiry !== 'number' || cert.daysUntilExpiry > 30) continue;
      try {
        await this.acme.renew(cert.domain);
      } catch (err) {
        console.error(`renew failed for ${cert.domain}:`, err.message);
      }
    }
  }

  async getNginxSSLConfig(domain) {
    const cert = await this.store.describe(domain);
    if (!cert || cert.status !== CertStore.CertStatus.ACTIVE) return null;
    return {
      ssl: true,
      sslCertificate: this.store.fullchainPath(domain).replace('/data/certs', '/etc/letsencrypt'),
      sslCertificateKey: this.store.privKeyPath(domain).replace('/data/certs', '/etc/letsencrypt'),
      sslProtocols: 'TLSv1.2 TLSv1.3',
      sslCiphers: 'HIGH:!aNULL:!MD5',
      sslPreferServerCiphers: true,
    };
  }
}

module.exports = CertificateService;
