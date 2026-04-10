/**
 * SpinForge - Customer API Token Service
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Per-customer API tokens. Each token is owned by exactly one customer and
 * grants the same privileges as that customer's normal session token. Used
 * by /_api/customer/tokens (and consumed by the customer auth middleware
 * inside routes/customer.js).
 *
 * Redis layout:
 *   customer:<custId>:tokens                  → set of token ids owned by this customer
 *   customer:<custId>:token:<id>              → JSON metadata (no plaintext)
 *   customer:<custId>:token:name:<name>       → token id (per-customer name uniqueness)
 *   customer:token:hash:<sha256>              → JSON { customerId, id } (global reverse lookup)
 */
const crypto = require('crypto');

const TOKEN_PREFIX = 'sfc_';

function generateId() {
  return 'tk_' + crypto.randomBytes(8).toString('hex');
}

function generatePlaintextToken() {
  return TOKEN_PREFIX + crypto.randomBytes(32).toString('hex');
}

function hashToken(plaintext) {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

function parseExpiry(expiry) {
  if (!expiry || expiry === 'never') return null;
  const presets = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
  };
  if (presets[expiry]) return new Date(Date.now() + presets[expiry]).toISOString();
  const parsed = new Date(expiry);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

class CustomerTokenService {
  constructor(redis) {
    this.redis = redis;
  }

  async createToken({ customerId, userId, userEmail, name, expiry }) {
    if (!customerId) throw new Error('customerId is required');
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Token name is required');
    }

    const cleanName = name.trim();

    // Per-customer name uniqueness (two different customers may both have a
    // token named "production").
    const existingId = await this.redis.get(
      `customer:${customerId}:token:name:${cleanName}`
    );
    if (existingId) {
      const err = new Error(`A token named "${cleanName}" already exists`);
      err.code = 'DUPLICATE_NAME';
      throw err;
    }

    const id = generateId();
    const plaintext = generatePlaintextToken();
    const hash = hashToken(plaintext);
    const now = new Date().toISOString();
    const expiresAt = parseExpiry(expiry);

    const metadata = {
      id,
      name: cleanName,
      hash,
      customerId,
      createdBy: userEmail || userId || 'unknown',
      createdAt: now,
      expiresAt,
      lastUsed: null,
      useCount: 0,
    };

    const reverseLookup = JSON.stringify({ customerId, id });

    await Promise.all([
      this.redis.set(`customer:${customerId}:token:${id}`, JSON.stringify(metadata)),
      this.redis.set(`customer:${customerId}:token:name:${cleanName}`, id),
      this.redis.set(`customer:token:hash:${hash}`, reverseLookup),
      this.redis.sAdd(`customer:${customerId}:tokens`, id),
    ]);

    return { ...this.toPublic(metadata), token: plaintext };
  }

  async listTokens(customerId) {
    if (!customerId) return [];
    const ids = await this.redis.sMembers(`customer:${customerId}:tokens`);
    if (!ids || ids.length === 0) return [];

    const records = await Promise.all(
      ids.map((id) => this.redis.get(`customer:${customerId}:token:${id}`))
    );

    return records
      .filter((r) => r)
      .map((r) => this.toPublic(JSON.parse(r)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Validate a plaintext customer token. Returns { customerId, userId,
   * userEmail, tokenId, tokenName } or null. Used by the customer auth
   * middleware to identify the caller without a session.
   */
  async validatePlaintext(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') return null;
    if (!plaintext.startsWith(TOKEN_PREFIX)) return null;

    const hash = hashToken(plaintext);
    const reverseLookup = await this.redis.get(`customer:token:hash:${hash}`);
    if (!reverseLookup) return null;

    let parsed;
    try {
      parsed = JSON.parse(reverseLookup);
    } catch (_) {
      return null;
    }
    const { customerId, id } = parsed;
    if (!customerId || !id) return null;

    const raw = await this.redis.get(`customer:${customerId}:token:${id}`);
    if (!raw) {
      // Stale reverse lookup → clean up
      await this.redis.del(`customer:token:hash:${hash}`);
      await this.redis.sRem(`customer:${customerId}:tokens`, id);
      return null;
    }

    const metadata = JSON.parse(raw);

    if (metadata.expiresAt && new Date(metadata.expiresAt) < new Date()) {
      return null;
    }

    // Bump usage stats (best-effort)
    try {
      metadata.lastUsed = new Date().toISOString();
      metadata.useCount = (metadata.useCount || 0) + 1;
      await this.redis.set(
        `customer:${customerId}:token:${id}`,
        JSON.stringify(metadata)
      );
    } catch (_) {}

    return {
      customerId,
      userId: metadata.createdBy, // best we have
      userEmail: metadata.createdBy,
      tokenId: id,
      tokenName: metadata.name,
      isApiToken: true,
    };
  }

  /**
   * Revoke a single token. The customerId is required so customers cannot
   * delete each other's tokens by guessing ids.
   */
  async deleteToken(customerId, id) {
    const raw = await this.redis.get(`customer:${customerId}:token:${id}`);
    if (!raw) return false;
    const metadata = JSON.parse(raw);

    await Promise.all([
      this.redis.del(`customer:${customerId}:token:${id}`),
      this.redis.del(`customer:${customerId}:token:name:${metadata.name}`),
      this.redis.del(`customer:token:hash:${metadata.hash}`),
      this.redis.sRem(`customer:${customerId}:tokens`, id),
    ]);
    return true;
  }

  /**
   * Bulk revoke every token belonging to a customer. Optional exceptId keeps
   * the calling token alive when used for incident response.
   */
  async deleteAll(customerId, { exceptId } = {}) {
    if (!customerId) return 0;
    const ids = await this.redis.sMembers(`customer:${customerId}:tokens`);
    if (!ids || ids.length === 0) return 0;

    let revoked = 0;
    for (const id of ids) {
      if (exceptId && id === exceptId) continue;
      const ok = await this.deleteToken(customerId, id);
      if (ok) revoked++;
    }
    return revoked;
  }

  toPublic(metadata) {
    return {
      id: metadata.id,
      name: metadata.name,
      createdAt: metadata.createdAt,
      createdBy: metadata.createdBy,
      expiresAt: metadata.expiresAt,
      lastUsed: metadata.lastUsed,
      useCount: metadata.useCount || 0,
    };
  }
}

module.exports = CustomerTokenService;
