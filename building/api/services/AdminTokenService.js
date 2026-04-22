// Copied from hosting/api/services/AdminTokenService.js on 2026-04-20 — keep in
// sync until extracted to @spinforge/admin-auth (see SPINBUILD_PLAN.md M8).
// Validates sfa_* machine API keys stored in shared KeyDB.
/**
 * SpinForge - Admin API Token Service
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Manages multi-token admin API access. Tokens are stored as sha256 hashes
 * keyed by their public ID; the plaintext value is only ever returned at
 * creation time and never persisted. Used by routes/admin.js to expose
 * /_admin/tokens endpoints and by utils/admin-auth.js to validate
 * X-Admin-Token headers against this store.
 *
 * Redis layout:
 *   admin:tokens                          → set of token IDs
 *   admin:token:<id>                      → JSON metadata (no plaintext)
 *   admin:token:hash:<sha256>             → token id (reverse lookup for validation)
 *   admin:token:name:<name>               → token id (uniqueness index)
 */
const crypto = require('crypto');

const TOKEN_PREFIX = 'sfa_';

// Hierarchical roles. A token granted a higher role implicitly satisfies any
// lower role. The middleware computes the required role from the request and
// rejects with 403 if the token's role is lower.
const ROLE_LEVELS = { read: 1, write: 2, admin: 3 };
const VALID_ROLES = Object.keys(ROLE_LEVELS);

function normalizeRole(role) {
  if (!role) return 'admin'; // back-compat: tokens created before roles existed
  const r = String(role).toLowerCase();
  if (!VALID_ROLES.includes(r)) {
    throw new Error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
  }
  return r;
}

function roleSatisfies(tokenRole, requiredRole) {
  return ROLE_LEVELS[normalizeRole(tokenRole)] >= ROLE_LEVELS[requiredRole];
}

function generateId() {
  return 'tk_' + crypto.randomBytes(8).toString('hex');
}

function generatePlaintextToken() {
  // 32 bytes of entropy → 64 hex chars, prefixed for easy identification
  return TOKEN_PREFIX + crypto.randomBytes(32).toString('hex');
}

function hashToken(plaintext) {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

function parseExpiry(expiry) {
  // Accepts: "never" | "7d" | "30d" | "90d" | "1y" | ISO date string | null
  if (!expiry || expiry === 'never') return null;

  const presets = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
  };
  if (presets[expiry]) {
    return new Date(Date.now() + presets[expiry]).toISOString();
  }

  // Try to parse as a date
  const parsed = new Date(expiry);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  return null;
}

class AdminTokenService {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * Create a new admin API token. Returns the metadata along with the
   * plaintext token — this is the ONLY time the plaintext is ever returned.
   * Caller is responsible for showing it to the user once.
   *
   * @throws {Error} with code='DUPLICATE_NAME' if a token with the same name
   *   already exists. The route handler should map this to HTTP 409.
   */
  async createToken({ name, createdBy, expiry, role }) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Token name is required');
    }

    const cleanName = name.trim();
    const normalizedRole = normalizeRole(role);

    // O(1) name uniqueness check via the name index.
    const existingId = await this.redis.get(`admin:token:name:${cleanName}`);
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
      role: normalizedRole,
      createdAt: now,
      createdBy: createdBy || 'unknown',
      expiresAt,
      lastUsed: null,
      useCount: 0,
    };

    await Promise.all([
      this.redis.set(`admin:token:${id}`, JSON.stringify(metadata)),
      this.redis.set(`admin:token:hash:${hash}`, id),
      this.redis.set(`admin:token:name:${cleanName}`, id),
      this.redis.sAdd('admin:tokens', id),
    ]);

    // Return public view + plaintext
    return {
      ...this.toPublic(metadata),
      token: plaintext,
    };
  }

  /**
   * List all admin tokens. Plaintext is never included.
   */
  async listTokens() {
    const ids = await this.redis.sMembers('admin:tokens');
    if (!ids || ids.length === 0) return [];

    const records = await Promise.all(
      ids.map((id) => this.redis.get(`admin:token:${id}`))
    );

    return records
      .filter((r) => r)
      .map((r) => this.toPublic(JSON.parse(r)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Look up a token by its plaintext value. Returns the admin identity that
   * the auth middleware should attach to req.admin, or null if no match.
   * Side effect: bumps lastUsed and useCount.
   */
  async validatePlaintext(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') return null;
    if (!plaintext.startsWith(TOKEN_PREFIX)) return null;

    const hash = hashToken(plaintext);
    const id = await this.redis.get(`admin:token:hash:${hash}`);
    if (!id) return null;

    const raw = await this.redis.get(`admin:token:${id}`);
    if (!raw) {
      // Stale hash index — clean up
      await this.redis.del(`admin:token:hash:${hash}`);
      await this.redis.sRem('admin:tokens', id);
      return null;
    }

    const metadata = JSON.parse(raw);

    // Check expiry
    if (metadata.expiresAt && new Date(metadata.expiresAt) < new Date()) {
      return null;
    }

    // Bump usage stats (best-effort, do not fail validation if this errors)
    try {
      metadata.lastUsed = new Date().toISOString();
      metadata.useCount = (metadata.useCount || 0) + 1;
      await this.redis.set(`admin:token:${id}`, JSON.stringify(metadata));
    } catch (_) {
      // ignore
    }

    // Malformed tokens (e.g. legacy role="root") should be rejected with
    // null — not throw — so an attacker can't DoS the process by
    // crafting a bogus record.
    let role;
    try {
      role = normalizeRole(metadata.role);
    } catch (_err) {
      return null;
    }
    return {
      id: 'admin-token:' + id,
      username: metadata.createdBy || 'admin-token',
      tokenId: id,
      tokenName: metadata.name,
      role,
      isApiToken: true,
      // Only the 'admin' role implies super-admin. Lower roles are scoped.
      isSuperAdmin: role === 'admin',
    };
  }

  /**
   * Revoke a token by id. Returns true on success, false if not found.
   */
  async deleteToken(id) {
    const raw = await this.redis.get(`admin:token:${id}`);
    if (!raw) return false;

    const metadata = JSON.parse(raw);

    await Promise.all([
      this.redis.del(`admin:token:${id}`),
      this.redis.del(`admin:token:hash:${metadata.hash}`),
      this.redis.del(`admin:token:name:${metadata.name}`),
      this.redis.sRem('admin:tokens', id),
    ]);

    return true;
  }

  /**
   * Revoke every admin token. Optionally exclude a single token id (use this
   * to keep the caller's own token alive when they trigger the bulk revoke).
   * Returns the number of tokens that were actually revoked.
   */
  async deleteAll({ exceptId } = {}) {
    const ids = await this.redis.sMembers('admin:tokens');
    if (!ids || ids.length === 0) return 0;

    let revoked = 0;
    for (const id of ids) {
      if (exceptId && id === exceptId) continue;
      const ok = await this.deleteToken(id);
      if (ok) revoked++;
    }
    return revoked;
  }

  /**
   * Strip secrets from a metadata record before sending it to clients.
   */
  toPublic(metadata) {
    return {
      id: metadata.id,
      name: metadata.name,
      role: normalizeRole(metadata.role),
      createdAt: metadata.createdAt,
      createdBy: metadata.createdBy,
      expiresAt: metadata.expiresAt,
      lastUsed: metadata.lastUsed,
      useCount: metadata.useCount || 0,
    };
  }
}

// Re-export the role helpers so middleware and routes can share them.
AdminTokenService.ROLE_LEVELS = ROLE_LEVELS;
AdminTokenService.VALID_ROLES = VALID_ROLES;
AdminTokenService.normalizeRole = normalizeRole;
AdminTokenService.roleSatisfies = roleSatisfies;

module.exports = AdminTokenService;
