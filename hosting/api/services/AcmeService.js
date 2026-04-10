/**
 * SpinForge - ACME Service
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Native ACME client (Let's Encrypt etc.) using the `acme-client` npm package.
 * Replaces the old `docker exec spinforge-certbot certbot ...` approach which
 * was vulnerable to command injection and forced a shared docker socket.
 *
 * Capabilities:
 *   - HTTP-01 challenge via the existing /var/www/certbot webroot, which
 *     OpenResty already serves at /.well-known/acme-challenge/  (no edge
 *     config changes needed)
 *   - Per-domain Redis lock to prevent concurrent issuance racing into
 *     Let's Encrypt rate limits
 *   - Account key persistence in Redis (regenerated only on first boot)
 *   - DNS-01 stub: hooks for adding/removing DNS TXT records via a pluggable
 *     provider, used for wildcard certs (currently no providers wired up,
 *     but the surface is here so it's a one-file change to add Cloudflare etc.)
 *   - Staging mode for testing without burning the prod LE rate limit
 */
const acme = require('acme-client');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { preflight: dnsPreflight } = require('../utils/dns-preflight');

const CHALLENGE_WEBROOT = process.env.ACME_WEBROOT || '/data/certbot-webroot';
const CHALLENGE_DIR = path.join(CHALLENGE_WEBROOT, '.well-known', 'acme-challenge');
const ACCOUNT_KEY_REDIS_KEY = 'acme:account:key';
const ACCOUNT_URL_REDIS_KEY = 'acme:account:url';
const LOCK_TTL_SECONDS = 600; // 10 minutes — longer than any sane LE handshake

/**
 * Sleep helper.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class AcmeService {
  /**
   * @param {object} opts
   * @param {object} opts.redis              ioredis-style client
   * @param {object} opts.certStore          CertStore instance
   * @param {string} [opts.contactEmail]     LE account contact email
   * @param {boolean} [opts.staging]         use LE staging directory
   * @param {object} [opts.logger]
   */
  constructor({ redis, certStore, contactEmail, staging = false, logger } = {}) {
    if (!redis) throw new Error('AcmeService requires redis');
    if (!certStore) throw new Error('AcmeService requires certStore');

    this.redis = redis;
    this.certStore = certStore;
    this.contactEmail = contactEmail || process.env.ADMIN_EMAIL || 'admin@spinforge.local';
    this.staging = staging || process.env.ACME_STAGING === '1';
    this.logger = logger || console;
    this._client = null;
  }

  // ─── ACME client lifecycle ────────────────────────────────────────────

  async getClient() {
    if (this._client) return this._client;

    // Load or create the account key. Persist in Redis so subsequent boots
    // (and the renewal scheduler) reuse the same Let's Encrypt account.
    let accountKeyPem = await this.redis.get(ACCOUNT_KEY_REDIS_KEY);
    if (!accountKeyPem) {
      this.logger.info?.('AcmeService: generating new ACME account key');
      const generated = await acme.crypto.createPrivateKey();
      accountKeyPem = generated.toString();
      await this.redis.set(ACCOUNT_KEY_REDIS_KEY, accountKeyPem);
    }

    const directoryUrl = this.staging
      ? acme.directory.letsencrypt.staging
      : acme.directory.letsencrypt.production;

    const client = new acme.Client({
      directoryUrl,
      accountKey: accountKeyPem,
    });

    // Try to reuse a previously-registered account URL so we don't keep
    // re-registering on every boot.
    const cachedAccountUrl = await this.redis.get(ACCOUNT_URL_REDIS_KEY);
    if (cachedAccountUrl) {
      try {
        client.api.accountUrl = cachedAccountUrl;
      } catch (_) {
        /* old client API — fall through and register fresh */
      }
    }

    this._client = client;
    return client;
  }

  // ─── Challenge handling (HTTP-01 via shared webroot) ─────────────────

  async challengeCreateHttp01(authz, challenge, keyAuthorization) {
    await fs.mkdir(CHALLENGE_DIR, { recursive: true });
    const tokenFile = path.join(CHALLENGE_DIR, challenge.token);
    await fs.writeFile(tokenFile, keyAuthorization, { mode: 0o644 });
    this.logger.info?.(
      `AcmeService: wrote http-01 challenge file ${tokenFile} for ${authz.identifier.value}`
    );
  }

  async challengeRemoveHttp01(authz, challenge) {
    const tokenFile = path.join(CHALLENGE_DIR, challenge.token);
    try {
      await fs.unlink(tokenFile);
    } catch (_) {
      /* fine if already gone */
    }
  }

  // DNS-01 stubs. To support wildcards, plug a real DNS provider here:
  // for each authz, the provider must create a TXT record at
  // _acme-challenge.<domain> with the value `keyAuthorization` (already
  // SHA-256 + base64url'd by acme-client).
  async challengeCreateDns01(authz, challenge, keyAuthorization) {
    throw new Error(
      `DNS-01 challenge for ${authz.identifier.value} requested but no DNS provider is configured. ` +
        `Wire one up in AcmeService.challengeCreateDns01.`
    );
  }
  async challengeRemoveDns01(_authz, _challenge) {}

  // ─── Per-domain locking ───────────────────────────────────────────────

  /**
   * Try to grab an exclusive lock for ACME work on this domain. Prevents two
   * concurrent issue/renew calls from racing into Let's Encrypt rate limits.
   * Returns the unique unlock token, or null if another holder has it.
   */
  async acquireLock(domain) {
    const token = crypto.randomBytes(16).toString('hex');
    // Try the modern `set` signature with options first, then fall back to
    // setNX/EXPIRE for older clients. node-redis v4 supports the options form.
    try {
      const ok = await this.redis.set(`acme:lock:${domain}`, token, {
        NX: true,
        EX: LOCK_TTL_SECONDS,
      });
      return ok === 'OK' || ok === true ? token : null;
    } catch (_) {
      const ok = await this.redis.setNX(`acme:lock:${domain}`, token);
      if (!ok) return null;
      await this.redis.expire(`acme:lock:${domain}`, LOCK_TTL_SECONDS);
      return token;
    }
  }

  async releaseLock(domain, token) {
    if (!token) return;
    // Only delete if our token still matches — defensive against TTL expiry
    // followed by another holder.
    const current = await this.redis.get(`acme:lock:${domain}`);
    if (current === token) await this.redis.del(`acme:lock:${domain}`);
  }

  // ─── Issue / renew ────────────────────────────────────────────────────

  /**
   * Issue (or re-issue) a cert for `domain`. Returns the freshly-installed
   * cert metadata. Single-flighted per-domain via the Redis lock.
   *
   * @param {string} domain
   * @param {object} [opts]
   * @param {string[]} [opts.altNames]   additional SANs
   * @param {boolean} [opts.wildcard]    treat as wildcard (DNS-01 only)
   * @param {boolean} [opts.force]       skip the DNS preflight check
   */
  async issue(domain, opts = {}) {
    const { CertStatus } = this.certStore.constructor;
    const altNames = opts.altNames || [];
    const wildcard = opts.wildcard || domain.startsWith('*.');
    const force = !!opts.force;

    const lockToken = await this.acquireLock(domain);
    if (!lockToken) {
      throw Object.assign(new Error(`Another ACME operation for ${domain} is in progress`), {
        code: 'LOCKED',
      });
    }

    try {
      // ─── DNS preflight ─────────────────────────────────────────────
      // Burn nothing on Let's Encrypt rate limits if the domain has moved
      // to another host. Wildcards skip preflight (they use DNS-01 anyway).
      if (!force && !wildcard) {
        const preflight = await dnsPreflight(domain);
        if (!preflight.ok && !preflight.skipped) {
          await this.certStore.putMetadata(domain, {
            status: CertStatus.ERROR,
            lastAttemptAt: new Date().toISOString(),
            lastError: preflight.reason,
            preflight: {
              resolved: preflight.resolved,
              expected: preflight.expected,
              checkedAt: new Date().toISOString(),
            },
          });
          await this.certStore.appendHistory(domain, {
            action: 'preflight:dns-mismatch',
            resolved: preflight.resolved,
            expected: preflight.expected,
          });
          throw Object.assign(new Error(preflight.reason), {
            code: 'DNS_PREFLIGHT_FAILED',
            resolved: preflight.resolved,
            expected: preflight.expected,
          });
        }
      }

      await this.certStore.putMetadata(domain, {
        status: CertStatus.ISSUING,
        type: 'letsencrypt',
        wildcard,
        altNames,
        lastAttemptAt: new Date().toISOString(),
        lastError: null,
        preflight: null, // clear any previous DNS-mismatch state
        attemptCount: ((await this.certStore.getMetadata(domain))?.attemptCount || 0) + 1,
      });
      await this.certStore.appendHistory(domain, {
        action: 'issue:start',
        wildcard,
        altNames,
        staging: this.staging,
        force,
      });

      const client = await this.getClient();

      // Build CSR + private key
      const [key, csr] = await acme.crypto.createCsr({
        commonName: domain,
        altNames: altNames.length ? altNames : [domain],
      });

      // Run the full ACME flow. acme-client.auto handles account creation,
      // order, authorization, challenge, finalization, and download.
      const certPem = await client.auto({
        csr,
        email: this.contactEmail,
        termsOfServiceAgreed: true,
        skipChallengeVerification: false,
        challengeCreateFn: (authz, challenge, keyAuthorization) => {
          if (challenge.type === 'http-01') {
            return this.challengeCreateHttp01(authz, challenge, keyAuthorization);
          }
          return this.challengeCreateDns01(authz, challenge, keyAuthorization);
        },
        challengeRemoveFn: (authz, challenge) => {
          if (challenge.type === 'http-01') {
            return this.challengeRemoveHttp01(authz, challenge);
          }
          return this.challengeRemoveDns01(authz, challenge);
        },
        challengePriority: wildcard ? ['dns-01'] : ['http-01', 'dns-01'],
      });

      // Cache the account URL on first successful issuance for reuse
      try {
        if (client.api?.accountUrl) {
          await this.redis.set(ACCOUNT_URL_REDIS_KEY, client.api.accountUrl);
        }
      } catch (_) {}

      // Persist to disk + Redis hot cache
      await this.certStore.writeCert(domain, {
        cert: certPem.toString(),
        key: key.toString(),
      });

      // Parse + record metadata
      const parsed = this.certStore.parsePem(certPem.toString());
      const meta = await this.certStore.putMetadata(domain, {
        ...parsed,
        status: CertStatus.ACTIVE,
        type: 'letsencrypt',
        issuedAt: new Date().toISOString(),
        lastError: null,
        autoRenew: true,
        wildcard,
        altNames,
        staging: this.staging,
      });
      await this.redis.sAdd('active-certs', domain);
      await this.certStore.appendHistory(domain, {
        action: 'issue:success',
        validTo: parsed.validTo,
        staging: this.staging,
      });

      this.logger.info?.(`AcmeService: issued cert for ${domain} (validTo=${parsed.validTo})`);
      return meta;
    } catch (err) {
      const message = (err && err.message) || String(err);
      this.logger.error?.(`AcmeService: issuance failed for ${domain}: ${message}`);
      await this.certStore.putMetadata(domain, {
        status: CertStatus.ERROR,
        lastError: message,
      });
      await this.certStore.appendHistory(domain, {
        action: 'issue:error',
        error: message,
      });
      throw err;
    } finally {
      await this.releaseLock(domain, lockToken);
    }
  }

  /**
   * Renew an existing cert. Same flow as issue() but uses the existing
   * altNames from metadata. Marks status as RENEWING during the process so
   * the UI can show what's happening.
   *
   * @param {string} domain
   * @param {{force?: boolean}} [opts]  force=true bypasses DNS preflight
   */
  async renew(domain, opts = {}) {
    const { CertStatus } = this.certStore.constructor;
    const meta = await this.certStore.getMetadata(domain);
    if (!meta) {
      throw new Error(`No certificate record for ${domain}`);
    }

    await this.certStore.putMetadata(domain, { status: CertStatus.RENEWING });
    await this.certStore.appendHistory(domain, { action: 'renew:start', force: !!opts.force });

    try {
      // Reuse the issue() pipeline — for ACME there is no real difference
      // between issue and renew, both fetch a fresh certificate.
      const result = await this.issue(domain, {
        altNames: meta.altNames || [],
        wildcard: !!meta.wildcard,
        force: !!opts.force,
      });
      await this.certStore.appendHistory(domain, {
        action: 'renew:success',
        validTo: result.validTo,
      });
      return result;
    } catch (err) {
      await this.certStore.appendHistory(domain, {
        action: 'renew:error',
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Best-effort revocation. Most users should use deleteCert below; revoke is
   * for the rare case of a compromised key. We don't fail loudly because
   * revoke being best-effort doesn't block the rest of cert management.
   */
  async revoke(domain) {
    try {
      const meta = await this.certStore.getMetadata(domain);
      if (!meta) return false;
      const pem = await this.certStore.readPemFromDisk(domain);
      if (!pem) return false;
      const client = await this.getClient();
      await client.revokeCertificate(pem.cert);
      await this.certStore.appendHistory(domain, { action: 'revoke:success' });
      return true;
    } catch (err) {
      this.logger.warn?.(`AcmeService: revoke failed for ${domain}: ${err.message}`);
      await this.certStore.appendHistory(domain, {
        action: 'revoke:error',
        error: err.message,
      });
      return false;
    }
  }
}

module.exports = AcmeService;
