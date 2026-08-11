/**
 * SpinForge - One-time email links for customer sign-in and password reset.
 *
 * Two flows share one mechanism:
 *
 *   magic  — sign in without a password. The only way in for customers an
 *            admin provisioned (those records have no password at all).
 *   reset  — set a new password.
 *
 * Only the SHA-256 of the token is stored, so a Redis dump can't be replayed
 * as a login. The plaintext exists exactly twice: in the email we send, and
 * in the URL the customer clicks.
 *
 * Single-use is enforced on DEL, not GET — under a double-click or a mail
 * scanner prefetching the link, only the request whose DEL returns 1 wins.
 *
 * Issuing a new link invalidates the previous one for the same (purpose,
 * user), so a customer who clicks "resend" three times doesn't leave three
 * live credentials in their inbox.
 */

const crypto = require('crypto');

// Sign-in links are short-lived because they *are* a session. Reset links
// get longer since people fetch them from a different device.
const TTL_SECONDS = {
  magic: 15 * 60,
  reset: 60 * 60,
};

// Per-email throttle. IP rate limiting lives in the route; this stops one
// address being mail-bombed from many IPs.
const REQUEST_WINDOW_SECONDS = 15 * 60;
const REQUEST_MAX = 5;

const PURPOSES = Object.keys(TTL_SECONDS);

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const linkKey = (h) => `customer:authlink:${h}`;
const latestKey = (purpose, userId) => `customer:authlink:latest:${purpose}:${userId}`;
const throttleKey = (purpose, email) => `customer:authlink:throttle:${purpose}:${String(email).toLowerCase()}`;

class CustomerAuthLinkService {
  constructor(redis) {
    this.redis = redis;
  }

  ttlSeconds(purpose) {
    return TTL_SECONDS[purpose];
  }

  ttlMinutes(purpose) {
    return Math.round(TTL_SECONDS[purpose] / 60);
  }

  /**
   * Has this email asked for too many links lately? Checked before we do
   * any work, and counted only for addresses that actually resolve to an
   * account — otherwise the throttle itself becomes an oracle.
   */
  async throttled(purpose, email) {
    const key = throttleKey(purpose, email);
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, REQUEST_WINDOW_SECONDS);
    return count > REQUEST_MAX;
  }

  /**
   * Mint a link token for a user. Returns the plaintext — the caller emails
   * it and then forgets it.
   */
  async issue(purpose, user) {
    if (!PURPOSES.includes(purpose)) throw new Error(`unknown link purpose: ${purpose}`);
    if (!user || !user.id) throw new Error('issue: user with an id is required');

    // Retire whatever link is currently outstanding for this user+purpose.
    const previous = await this.redis.get(latestKey(purpose, user.id));
    if (previous) await this.redis.del(linkKey(previous));

    const token = crypto.randomBytes(32).toString('base64url');
    const h = hash(token);
    const ttl = TTL_SECONDS[purpose];

    await this.redis.setEx(linkKey(h), ttl, JSON.stringify({
      purpose,
      userId: user.id,
      email: user.email,
      customerId: user.customerId,
      issuedAt: new Date().toISOString(),
    }));
    await this.redis.setEx(latestKey(purpose, user.id), ttl, h);

    return token;
  }

  /**
   * Redeem a token. Returns the stored record, or null if the token is
   * unknown, expired, for a different flow, or already used.
   */
  async consume(purpose, token) {
    if (!token || typeof token !== 'string') return null;

    const h = hash(token);
    const raw = await this.redis.get(linkKey(h));
    if (!raw) return null;

    let record;
    try { record = JSON.parse(raw); } catch { return null; }
    if (record.purpose !== purpose) return null;

    // Whoever deletes it owns it. A racing second request gets 0 and fails.
    const deleted = await this.redis.del(linkKey(h));
    if (deleted !== 1) return null;

    await this.redis.del(latestKey(purpose, record.userId));
    return record;
  }
}

CustomerAuthLinkService.PURPOSES = PURPOSES;
CustomerAuthLinkService.TTL_SECONDS = TTL_SECONDS;

module.exports = CustomerAuthLinkService;
