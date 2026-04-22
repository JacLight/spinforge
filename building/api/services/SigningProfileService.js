/**
 * SigningProfileService — signing material metadata in KeyDB + secrets in Vault.
 *
 * A signing profile is a named bundle of credentials a customer uses to
 * sign builds for one platform. For iOS: cert + provisioning profile
 * (+ App Store Connect API key for fastlane). For Android: upload keystore
 * + password (+ Play service account JSON).
 *
 * KeyDB holds only metadata: what the profile is, where its secrets live
 * in Vault, what fingerprint/app-id the cert belongs to. The actual
 * secret payloads live in Vault under `secret/signing/<customerId>/<platform>/<profileId>`.
 *
 * Key convention:
 *   signing:profile:<profileId>         metadata JSON
 *   signing:by-customer:<customerId>    sorted set of profileIds (score = createdAt)
 */

const { ulid } = require('ulid');

class SigningProfileService {
  constructor(redis, { vault, logger } = {}) {
    this.redis = redis;
    this.vault = vault || null;
    this.logger = logger || console;
  }

  /**
   * Create a profile. `secrets` is a flat object of field → base64 string
   * (or raw string for JSONs). We pass it through to Vault — the KeyDB
   * record only holds non-secret metadata.
   *
   * Input:
   *   { customerId, platform: 'ios'|'android', label, metadata, secrets }
   */
  async create({ customerId, platform, label, metadata = {}, secrets }) {
    if (!customerId) throw bad('customerId is required');
    if (!platform) throw bad('platform is required');
    if (!['ios', 'android'].includes(platform)) {
      throw bad(`platform must be "ios" or "android"; got "${platform}"`);
    }
    if (!secrets || typeof secrets !== 'object' || !Object.keys(secrets).length) {
      throw bad('secrets is required');
    }
    if (!this.vault || !this.vault.isConfigured()) {
      throw Object.assign(new Error('Vault not configured — cannot create signing profile'), {
        status: 503, expose: true,
      });
    }

    const id = `sp_${ulid()}`;

    // Write secret to Vault first. If metadata write fails after, we have
    // an orphaned secret — we detect + clean up below.
    const vaultResult = await this.vault.writeSecret(customerId, platform, id, secrets);

    const record = {
      id,
      customerId,
      platform,
      label: label || id,
      metadata: sanitizeMetadata(metadata),
      vaultPath: vaultResult.path,
      vaultVersion: vaultResult.version,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.redis.set(`signing:profile:${id}`, JSON.stringify(record));
      await this.redis.zAdd(`signing:by-customer:${customerId}`, {
        score: Date.now(),
        value: id,
      });
      // Global index — powers the admin UI's cluster-wide Signing page.
      await this.redis.zAdd('signing:recent', { score: Date.now(), value: id });
    } catch (err) {
      // Roll back the Vault write so we don't leave an unreferenced secret.
      await this.vault.deleteSecret(customerId, platform, id).catch(() => {});
      throw err;
    }

    return record;
  }

  async get(id) {
    const raw = await this.redis.get(`signing:profile:${id}`);
    return raw ? JSON.parse(raw) : null;
  }

  async listByCustomer(customerId, { limit = 100, offset = 0 } = {}) {
    const ids = await this.redis.zRange(
      `signing:by-customer:${customerId}`,
      -(offset + limit),
      -(offset + 1),
      { REV: true }
    );
    const out = [];
    for (const id of ids) {
      const p = await this.get(id);
      if (p) out.push(p);
    }
    return out;
  }

  /**
   * Cluster-wide listing — every signing profile across every customer.
   * Used by the admin UI's Signing page when no customerId filter is set.
   */
  async listAll({ limit = 200, offset = 0 } = {}) {
    const ids = await this.redis.zRange('signing:recent',
      -(offset + limit), -(offset + 1), { REV: true });
    const out = [];
    for (const id of ids) {
      const p = await this.get(id);
      if (p) out.push(p);
    }
    return out;
  }

  async delete(id) {
    const record = await this.get(id);
    if (!record) return false;
    if (this.vault && this.vault.isConfigured()) {
      await this.vault.deleteSecret(record.customerId, record.platform, id).catch(() => {});
    }
    await this.redis.del(`signing:profile:${id}`);
    await this.redis.zRem(`signing:by-customer:${record.customerId}`, id);
    return true;
  }

  /**
   * Mint a short-lived Vault token for a runner to check out this profile's
   * secret. Returns { token, accessor, path, leaseDurationSec }. The
   * accessor is stored on the job record so the api can revoke the token
   * early if the runner reports a failure / completion before TTL.
   */
  async mintJobToken(profileId, { ttlSeconds = 1800 } = {}) {
    const p = await this.get(profileId);
    if (!p) throw Object.assign(new Error('signing profile not found'), { status: 404, expose: true });
    const t = await this.vault.mintJobToken({
      customerId: p.customerId,
      platform: p.platform,
      profileId: p.id,
      ttlSeconds,
    });
    return { ...t, path: p.vaultPath };
  }
}

function sanitizeMetadata(m) {
  // Shallow copy + drop anything that looks secret-ish. Callers shouldn't
  // pass secrets in metadata, but belt + suspenders.
  const out = {};
  for (const [k, v] of Object.entries(m || {})) {
    if (typeof k !== 'string') continue;
    if (/password|secret|key|token|p12|keystore/i.test(k)) continue;
    out[k] = typeof v === 'string' ? v.slice(0, 1000) : v;
  }
  return out;
}

function bad(message) {
  return Object.assign(new Error(message), { status: 400, expose: true });
}

module.exports = SigningProfileService;
