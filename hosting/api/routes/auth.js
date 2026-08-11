/**
 * SpinForge - Customer Authentication Routes
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Three ways in, all landing on the same session:
 *
 *   password    POST /customer/login
 *   magic link  POST /customer/magic-link  →  POST /customer/magic-link/consume
 *   reset       POST /customer/forgot-password  →  POST /customer/reset-password
 *
 * The magic link isn't a convenience feature — customers provisioned by an
 * admin (POST /_admin/customers) have no password, so an emailed link is
 * their only door. See ensureLoginRecord().
 */
const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('../utils/rate-limit');
const CustomerAuthLinkService = require('../services/CustomerAuthLinkService');

const authLinks = new CustomerAuthLinkService(redisClient);

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIN_PASSWORD_LENGTH = 10;

// Where the customer portal lives. Emailed links point here.
const APP_URL = (process.env.CUSTOMER_APP_URL || 'https://app.spinforge.dev').replace(/\/+$/, '');

// Helper to generate IDs
function generateId(prefix = '') {
  return prefix + crypto.randomBytes(16).toString('hex');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function linkUrl(mode, token) {
  return `${APP_URL}/?mode=${mode}&token=${encodeURIComponent(token)}`;
}

function notifier(req) {
  return req.app?.locals?.notifications || null;
}

/**
 * Record why a link request sent nothing.
 *
 * The HTTP response is deliberately identical whether or not the address
 * has an account — it must not become an oracle for which emails are
 * registered. That leaves operators with no way to tell "no such account"
 * from "mail is broken" except by reading Redis by hand, so the reason goes
 * to the server log, where only operators can see it.
 */
function logLinkSkipped(purpose, email, reason) {
  console.warn(`[auth] ${purpose} link not sent to ${email}: ${reason}`);
}

// ─── User record lookup ────────────────────────────────────────────────────

/**
 * Find the login record for an address.
 *
 * Registration writes `user:email:<email>` verbatim, so old records may be
 * mixed-case; try the exact string before the normalized one. Returns null
 * when there's no login record at all — callers decide whether to fall back
 * to ensureLoginRecord().
 */
async function findUserByEmail(email) {
  const raw = String(email || '').trim();
  const lower = normalizeEmail(email);

  for (const candidate of raw === lower ? [lower] : [raw, lower]) {
    const data = await redisClient.get(`user:email:${candidate}`);
    if (data) {
      try { return JSON.parse(data); } catch { /* fall through */ }
    }
  }
  return null;
}

/**
 * Get a login record for an address, creating one if a customer exists
 * without it.
 *
 * `POST /_admin/customers` writes only a `customer:<id>` record — no user,
 * no password. Those accounts could be created but never signed into. This
 * backfills the missing half on first sign-in attempt, with no password set,
 * so the magic link works and a reset can later add one.
 */
async function ensureLoginRecord(email) {
  const existing = await findUserByEmail(email);
  if (existing) return existing;

  const lower = normalizeEmail(email);
  const raw = String(email || '').trim();

  let customerId = null;
  for (const candidate of raw === lower ? [lower] : [raw, lower]) {
    customerId = await redisClient.get(`customer:email:${candidate}`);
    if (customerId) break;
  }
  if (!customerId) return null;

  const customerRaw = await redisClient.get(`customer:${customerId}`);
  if (!customerRaw) return null;

  let customer;
  try { customer = JSON.parse(customerRaw); } catch { return null; }

  const now = new Date().toISOString();
  const user = {
    id: customer.metadata?.userId || generateId('user_'),
    email: customer.email || lower,
    password: null,            // no password yet — magic link or reset sets one
    name: customer.name || (customer.email || lower).split('@')[0],
    company: customer.metadata?.company,
    customerId,
    role: 'customer',
    emailVerified: false,
    createdAt: customer.createdAt || now,
    updatedAt: now,
    backfilledFrom: 'customer_record',
  };

  await redisClient.set(`user:${user.id}`, JSON.stringify(user));
  await redisClient.set(`user:email:${user.email}`, JSON.stringify(user));
  return user;
}

async function saveUser(user) {
  user.updatedAt = new Date().toISOString();
  await redisClient.set(`user:${user.id}`, JSON.stringify(user));
  await redisClient.set(`user:email:${user.email}`, JSON.stringify(user));
  return user;
}

/**
 * A soft-deleted customer keeps their session keys and their password hash.
 * Without this check, deactivating an account in the admin UI doesn't
 * actually stop them signing back in.
 */
async function customerIsActive(customerId) {
  if (!customerId) return false;
  const raw = await redisClient.get(`customer:${customerId}`);
  if (!raw) return true;   // no customer record — legacy user, don't lock out
  try {
    return JSON.parse(raw).isActive !== false;
  } catch {
    return true;
  }
}

// ─── Sessions ──────────────────────────────────────────────────────────────

const sessionIndexKey = (userId) => `user:sessions:${userId}`;
const apiTokenIndexKey = (userId) => `user:apitokens:${userId}`;

/**
 * Mint a session + legacy api token for a user and index both under the
 * user so a password change can revoke them. Both index sets carry the
 * session TTL so they can't grow forever.
 */
async function issueSession(user) {
  const sessionToken = generateId('session_');
  const authToken = generateId('token_');
  const now = new Date().toISOString();

  await redisClient.setEx(`session:${sessionToken}`, SESSION_TTL_SECONDS, JSON.stringify({
    userId: user.id,
    customerId: user.customerId,
    email: user.email,
    role: user.role || 'customer',
    token: sessionToken,
    createdAt: now,
  }));

  await redisClient.setEx(`apitoken:${authToken}`, SESSION_TTL_SECONDS, JSON.stringify({
    userId: user.id,
    customerId: user.customerId,
    email: user.email,
    token: authToken,
    createdAt: now,
  }));

  await redisClient.sAdd(sessionIndexKey(user.id), sessionToken);
  await redisClient.expire(sessionIndexKey(user.id), SESSION_TTL_SECONDS);
  await redisClient.sAdd(apiTokenIndexKey(user.id), authToken);
  await redisClient.expire(apiTokenIndexKey(user.id), SESSION_TTL_SECONDS);

  return {
    success: true,
    token: sessionToken,
    refreshToken: sessionToken,
    apiToken: authToken,
    user: {
      email: user.email,
      name: user.name,
      customerId: user.customerId,
      role: user.role || 'customer',
    },
  };
}

/**
 * Kill every browser session and short-lived api token for a user. Called
 * whenever the password changes.
 *
 * Deliberately leaves `sfc_` customer API tokens alone: those are deploy
 * credentials living in CI config, and silently breaking every pipeline on
 * a password change is worse than the marginal security gain. They're
 * revocable individually from Settings.
 */
async function revokeAllSessions(userId) {
  let revoked = 0;
  for (const [indexKey, prefix] of [[sessionIndexKey(userId), 'session:'], [apiTokenIndexKey(userId), 'apitoken:']]) {
    const members = await redisClient.sMembers(indexKey).catch(() => []);
    for (const token of members) {
      revoked += await redisClient.del(`${prefix}${token}`).catch(() => 0);
    }
    await redisClient.del(indexKey).catch(() => {});
  }
  return revoked;
}

// ─── Registration ──────────────────────────────────────────────────────────

router.post('/customer/register', rateLimit({ name: 'customer-register', max: 5, windowSec: 300 }), async (req, res) => {
  try {
    const { password, name, company } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const userId = generateId('user_');
    const customerId = generateId('cust_');
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const user = {
      id: userId,
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
      company,
      customerId,
      role: 'customer',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };

    await redisClient.set(`user:${userId}`, JSON.stringify(user));
    await redisClient.set(`user:email:${email}`, JSON.stringify(user));

    const customer = {
      id: customerId,
      name: user.name,
      email: user.email,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      metadata: { userId, company, role: 'customer' },
      limits: {},
    };

    await redisClient.set(`customer:${customerId}`, JSON.stringify(customer));
    await redisClient.sAdd('customers', customerId);
    await redisClient.set(`customer:email:${email}`, customerId);

    const session = await issueSession(user);

    res.status(201).json({
      success: true,
      user: { id: userId, email: user.email, name: user.name, customerId },
      token: session.apiToken,
      sessionToken: session.token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ─── Password sign-in ──────────────────────────────────────────────────────

router.post('/customer/login', rateLimit({ name: 'customer-login', max: 5, windowSec: 60 }), async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Accounts an admin created, or that only ever used magic links, have
    // no hash. bcrypt.compare against null throws, so answer explicitly.
    if (!user.password) {
      return res.status(409).json({
        error: 'no_password_set',
        message: 'This account has no password yet. Use the email sign-in link, then set one from Settings.',
      });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!(await customerIsActive(user.customerId))) {
      return res.status(403).json({ error: 'This account has been deactivated. Contact support.' });
    }

    res.json(await issueSession(user));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Magic link sign-in ────────────────────────────────────────────────────

/**
 * Request a sign-in link. Always answers 200 with the same body whether or
 * not the address exists — the response must not tell an attacker which
 * emails have SpinForge accounts.
 */
router.post('/customer/magic-link', rateLimit({ name: 'customer-magic-link', max: 5, windowSec: 300 }), async (req, res) => {
  const genericOk = {
    success: true,
    message: 'If that email has a SpinForge account, a sign-in link is on its way.',
  };

  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !isEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    const user = await ensureLoginRecord(email);
    if (!user) {
      logLinkSkipped('magic', email, 'no account for this address');
      return res.json(genericOk);
    }

    if (!(await customerIsActive(user.customerId))) {
      logLinkSkipped('magic', email, `customer ${user.customerId} is deactivated`);
      return res.json(genericOk);
    }

    // Counted only for real accounts, so a 429 never confirms an address.
    if (await authLinks.throttled('magic', user.email)) {
      logLinkSkipped('magic', email, 'per-address throttle exceeded');
      return res.json(genericOk);
    }

    const token = await authLinks.issue('magic', user);

    const notify = notifier(req);
    if (notify) {
      await notify.notify('magic_link_signin', {
        to: user.email,
        context: {
          name: user.name || user.email.split('@')[0],
          email: user.email,
          link: linkUrl('magic', token),
          expiresMinutes: authLinks.ttlMinutes('magic'),
        },
      });
    } else {
      console.error('[auth] magic link requested but notifications are not initialized');
    }

    res.json(genericOk);
  } catch (error) {
    console.error('Magic link error:', error);
    res.json(genericOk);
  }
});

/**
 * Redeem a sign-in link. Also marks the address verified — clicking a link
 * we mailed there is the proof signup never collected.
 */
router.post('/customer/magic-link/consume', rateLimit({ name: 'customer-magic-consume', max: 10, windowSec: 300 }), async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const record = await authLinks.consume('magic', token);
    if (!record) {
      return res.status(400).json({
        error: 'link_invalid',
        message: 'This sign-in link has expired or already been used. Request a new one.',
      });
    }

    const user = await findUserByEmail(record.email);
    if (!user) return res.status(400).json({ error: 'link_invalid', message: 'Account no longer exists.' });

    if (!(await customerIsActive(user.customerId))) {
      return res.status(403).json({ error: 'This account has been deactivated. Contact support.' });
    }

    if (!user.emailVerified) {
      user.emailVerified = true;
      await saveUser(user);
    }

    const session = await issueSession(user);
    res.json({ ...session, hasPassword: Boolean(user.password) });
  } catch (error) {
    console.error('Magic link consume error:', error);
    res.status(500).json({ error: 'Sign-in failed' });
  }
});

// ─── Password reset ────────────────────────────────────────────────────────

router.post('/customer/forgot-password', rateLimit({ name: 'customer-forgot-password', max: 5, windowSec: 300 }), async (req, res) => {
  const genericOk = {
    success: true,
    message: 'If that email has a SpinForge account, a reset link is on its way.',
  };

  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !isEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    const user = await ensureLoginRecord(email);
    if (!user) {
      logLinkSkipped('reset', email, 'no account for this address');
      return res.json(genericOk);
    }
    if (!(await customerIsActive(user.customerId))) {
      logLinkSkipped('reset', email, `customer ${user.customerId} is deactivated`);
      return res.json(genericOk);
    }
    if (await authLinks.throttled('reset', user.email)) {
      logLinkSkipped('reset', email, 'per-address throttle exceeded');
      return res.json(genericOk);
    }

    const token = await authLinks.issue('reset', user);

    const notify = notifier(req);
    if (notify) {
      await notify.notify('password_reset', {
        to: user.email,
        context: {
          name: user.name || user.email.split('@')[0],
          email: user.email,
          link: linkUrl('reset', token),
          expiresMinutes: authLinks.ttlMinutes('reset'),
        },
      });
    } else {
      console.error('[auth] password reset requested but notifications are not initialized');
    }

    res.json(genericOk);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.json(genericOk);
  }
});

/**
 * Set a new password from a reset link, then sign the customer in.
 *
 * Every other session dies here. A reset is usually triggered because the
 * old credential is suspect, so leaving prior sessions alive would defeat
 * the point.
 */
router.post('/customer/reset-password', rateLimit({ name: 'customer-reset-password', max: 10, windowSec: 300 }), async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token) return res.status(400).json({ error: 'Token is required' });
    if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const record = await authLinks.consume('reset', token);
    if (!record) {
      return res.status(400).json({
        error: 'link_invalid',
        message: 'This reset link has expired or already been used. Request a new one.',
      });
    }

    const user = await findUserByEmail(record.email);
    if (!user) return res.status(400).json({ error: 'link_invalid', message: 'Account no longer exists.' });

    if (!(await customerIsActive(user.customerId))) {
      return res.status(403).json({ error: 'This account has been deactivated. Contact support.' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.emailVerified = true;
    await saveUser(user);

    await revokeAllSessions(user.id);

    const notify = notifier(req);
    if (notify) {
      await notify.notify('password_changed', {
        to: user.email,
        context: {
          name: user.name || user.email.split('@')[0],
          email: user.email,
          changedAt: new Date().toISOString(),
          resetUrl: `${APP_URL}/?mode=forgot`,
        },
      });
    }

    // Issued after the revoke so the customer stays signed in on this device.
    res.json(await issueSession(user));
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

/**
 * Change password while signed in. Also the only way a magic-link-only
 * account can gain a password, so `currentPassword` is required just when
 * one is already set.
 */
router.post('/customer/change-password', rateLimit({ name: 'customer-change-password', max: 10, windowSec: 300 }), async (req, res) => {
  try {
    const sessionToken = req.headers['authorization']?.replace('Bearer ', '') || req.body.token;
    if (!sessionToken) return res.status(401).json({ error: 'Authentication required' });

    const sessionData = await redisClient.get(`session:${sessionToken}`);
    if (!sessionData) return res.status(401).json({ error: 'Invalid or expired session' });

    const session = JSON.parse(sessionData);
    const user = await findUserByEmail(session.email);
    if (!user) return res.status(401).json({ error: 'Account not found' });

    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    if (user.password) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await saveUser(user);

    await revokeAllSessions(user.id);

    const notify = notifier(req);
    if (notify) {
      await notify.notify('password_changed', {
        to: user.email,
        context: {
          name: user.name || user.email.split('@')[0],
          email: user.email,
          changedAt: new Date().toISOString(),
          resetUrl: `${APP_URL}/?mode=forgot`,
        },
      });
    }

    res.json(await issueSession(user));
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

// ─── Session lifecycle ─────────────────────────────────────────────────────

router.post('/customer/verify', async (req, res) => {
  try {
    const token = req.body.token || req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const sessionData = await redisClient.get(`session:${token}`);
    if (!sessionData) {
      return res.status(401).json({ valid: false });
    }

    const session = JSON.parse(sessionData);

    // A session outliving its customer's deactivation is the same hole as
    // login without the isActive check.
    if (!(await customerIsActive(session.customerId))) {
      await redisClient.del(`session:${token}`);
      return res.status(403).json({ valid: false, error: 'Account deactivated' });
    }

    res.json({
      valid: true,
      user: {
        userId: session.userId,
        customerId: session.customerId,
        email: session.email,
        role: session.role,
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/customer/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;

    if (token) {
      const sessionData = await redisClient.get(`session:${token}`);
      if (sessionData) {
        try {
          const { userId } = JSON.parse(sessionData);
          if (userId) await redisClient.sRem(sessionIndexKey(userId), token);
        } catch { /* index cleanup is best-effort */ }
      }
      await redisClient.del(`session:${token}`);
      await redisClient.del(`apitoken:${token}`);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
