/**
 * SpinForge - Partner Service
 * Copyright (c) 2025 Jacob Ajiboye

 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Manages third-party partner integrations. A "partner" is an external
 * service (reseller, agency, OEM platform, etc.) that wants to provision
 * SpinForge hosting for their own customers.
 *
 * The flow:
 *   1. SpinForge admin registers a partner by configuring the URL of the
 *      partner's "validation" endpoint — the URL we'll call to verify any
 *      customer token the partner sends our way.
 *   2. The partner receives a one-time API key (sfpk_...) that they embed
 *      in their backend. Every call the partner makes to our /_partners/*
 *      endpoints MUST send this key as X-Partner-Key.
 *   3. When one of the partner's customers wants SpinForge access, the
 *      partner's backend calls POST /_partners/exchange with the customer's
 *      own auth token (from the partner's system).
 *   4. We use that token to call the partner's validation endpoint, which
 *      tells us who the customer is and what they are allowed to do.
 *   5. We mint a short-lived SpinForge customer token and return it.
 *
 * Redis layout:
 *   partners                            SET of partner ids
 *   partner:<id>                        JSON metadata (no plaintext key)
 *   partner:key:hash:<sha256>           partner id (reverse lookup)
 *   partner:name:<name>                 partner id (uniqueness)
 */
const crypto = require('crypto');

const KEY_PREFIX = 'sfpk_';

function genId() {
  return 'prt_' + crypto.randomBytes(8).toString('hex');
}

function genApiKey() {
  return KEY_PREFIX + crypto.randomBytes(32).toString('hex');
}

function hashKey(plaintext) {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

class PartnerService {
  constructor(redis, { logger } = {}) {
    this.redis = redis;
    this.logger = logger || console;
  }

  /**
   * Register a new partner.
   *
   * @param {object} opts
   * @param {string} opts.name              human-readable name (unique)
   * @param {string} opts.validationUrl     HTTPS URL we call to validate
   *                                        customer tokens supplied by this
   *                                        partner.
   * @param {string} [opts.validationMethod] HTTP method to use (default GET)
   * @param {object} [opts.validationHeaders] extra headers we send to the
   *                                          validation endpoint (e.g. for
   *                                          partner->us service-to-service
   *                                          auth going the other direction)
   * @param {number} [opts.tokenTtlSeconds] how long issued SpinForge tokens
   *                                        live by default (default 3600)
   * @returns {Promise<{id, name, validationUrl, createdAt, apiKey}>}
   *   apiKey is the plaintext sfpk_ key — returned ONCE at creation and
   *   never retrievable again.
   */
  async createPartner(opts) {
    const { name, validationUrl } = opts;
    if (!name || !name.trim()) throw new Error('name is required');
    if (!validationUrl || !/^https?:\/\//i.test(validationUrl)) {
      throw new Error('validationUrl must be a valid http(s) URL');
    }

    const cleanName = name.trim();

    // Uniqueness
    const existing = await this.redis.get(`partner:name:${cleanName}`);
    if (existing) {
      const err = new Error(`A partner named "${cleanName}" already exists`);
      err.code = 'DUPLICATE_NAME';
      throw err;
    }

    const id = genId();
    const apiKey = genApiKey();
    const hash = hashKey(apiKey);
    const now = new Date().toISOString();

    const metadata = {
      id,
      name: cleanName,
      validationUrl,
      // POST + empty body is the most common shape for modern token-check
      // endpoints (e.g. appmint's /repository/find/dev_environment). GET
      // still works if the partner explicitly asks for it.
      validationMethod: (opts.validationMethod || 'POST').toUpperCase(),
      validationHeaders: opts.validationHeaders || {},
      tokenTtlSeconds: opts.tokenTtlSeconds || 3600,
      keyHash: hash,
      createdAt: now,
      updatedAt: now,
      enabled: true,
      useCount: 0,
      lastUsedAt: null,
    };

    await Promise.all([
      this.redis.set(`partner:${id}`, JSON.stringify(metadata)),
      this.redis.set(`partner:key:hash:${hash}`, id),
      this.redis.set(`partner:name:${cleanName}`, id),
      this.redis.sAdd('partners', id),
    ]);

    return { ...this.toPublic(metadata), apiKey };
  }

  /**
   * Look up a partner by the plaintext sfpk_ key they sent on X-Partner-Key.
   * Returns the partner record or null. Side-effect: bumps useCount and
   * lastUsedAt on successful lookups.
   */
  async validateApiKey(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') return null;
    if (!plaintext.startsWith(KEY_PREFIX)) return null;

    const hash = hashKey(plaintext);
    const id = await this.redis.get(`partner:key:hash:${hash}`);
    if (!id) return null;

    const raw = await this.redis.get(`partner:${id}`);
    if (!raw) {
      // Stale index — clean up
      await this.redis.del(`partner:key:hash:${hash}`);
      await this.redis.sRem('partners', id);
      return null;
    }

    const metadata = JSON.parse(raw);
    if (metadata.enabled === false) return null;

    // Best-effort usage stats
    try {
      metadata.useCount = (metadata.useCount || 0) + 1;
      metadata.lastUsedAt = new Date().toISOString();
      await this.redis.set(`partner:${id}`, JSON.stringify(metadata));
    } catch (_) {}

    // Apply the same env override getPartner() uses.
    const overrideKey = `PARTNER_VERIFY_URL_${id.toUpperCase().replace(/-/g, '_')}`;
    if (process.env[overrideKey]) {
      metadata.validationUrl = process.env[overrideKey];
      metadata.validationUrlOverridden = true;
    }
    return metadata;
  }

  async getPartner(id) {
    const raw = await this.redis.get(`partner:${id}`);
    if (!raw) return null;
    const record = JSON.parse(raw);

    // Env override for the validation URL. Useful for dev ("point my local
    // appmint at a ngrok tunnel without touching Redis") and as an escape
    // hatch if a bad URL was saved and the admin UI is offline. Shape:
    //   PARTNER_VERIFY_URL_<uppercased id with '-' → '_'> = https://…
    const overrideKey = `PARTNER_VERIFY_URL_${id.toUpperCase().replace(/-/g, '_')}`;
    if (process.env[overrideKey]) {
      record.validationUrl = process.env[overrideKey];
      record.validationUrlOverridden = true;
    }
    return record;
  }

  async listPartners() {
    const ids = await this.redis.sMembers('partners');
    if (!ids || ids.length === 0) return [];
    const records = await Promise.all(
      ids.map((id) => this.redis.get(`partner:${id}`))
    );
    return records
      .filter(Boolean)
      .map((r) => this.toPublic(JSON.parse(r)))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async updatePartner(id, patch) {
    const raw = await this.redis.get(`partner:${id}`);
    if (!raw) return null;
    const existing = JSON.parse(raw);

    // Handle name rename (keep the name index consistent)
    if (patch.name && patch.name.trim() !== existing.name) {
      const taken = await this.redis.get(`partner:name:${patch.name.trim()}`);
      if (taken) {
        const err = new Error(`A partner named "${patch.name.trim()}" already exists`);
        err.code = 'DUPLICATE_NAME';
        throw err;
      }
      await this.redis.del(`partner:name:${existing.name}`);
      await this.redis.set(`partner:name:${patch.name.trim()}`, id);
    }

    const merged = {
      ...existing,
      ...patch,
      // Never allow these to be overridden from the patch
      id: existing.id,
      keyHash: existing.keyHash,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(`partner:${id}`, JSON.stringify(merged));
    return this.toPublic(merged);
  }

  /**
   * Rotate a partner's API key. Returns the new plaintext key (shown once).
   */
  async rotateApiKey(id) {
    const raw = await this.redis.get(`partner:${id}`);
    if (!raw) return null;
    const metadata = JSON.parse(raw);

    const newKey = genApiKey();
    const newHash = hashKey(newKey);

    // Remove the old hash index
    if (metadata.keyHash) {
      await this.redis.del(`partner:key:hash:${metadata.keyHash}`);
    }

    metadata.keyHash = newHash;
    metadata.keyRotatedAt = new Date().toISOString();
    metadata.updatedAt = metadata.keyRotatedAt;

    await Promise.all([
      this.redis.set(`partner:${id}`, JSON.stringify(metadata)),
      this.redis.set(`partner:key:hash:${newHash}`, id),
    ]);

    return { ...this.toPublic(metadata), apiKey: newKey };
  }

  async deletePartner(id) {
    const raw = await this.redis.get(`partner:${id}`);
    if (!raw) return false;
    const metadata = JSON.parse(raw);
    await Promise.all([
      this.redis.del(`partner:${id}`),
      this.redis.del(`partner:key:hash:${metadata.keyHash}`),
      this.redis.del(`partner:name:${metadata.name}`),
      this.redis.sRem('partners', id),
    ]);
    return true;
  }

  /**
   * Strip the key hash before returning to clients.
   */
  toPublic(metadata) {
    const out = { ...metadata };
    delete out.keyHash;
    return out;
  }
}

module.exports = PartnerService;
