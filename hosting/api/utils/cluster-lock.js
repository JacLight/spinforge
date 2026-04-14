/**
 * SpinForge - Cluster-wide Redis lock
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * When the api runs as N replicas across a cluster, every replica boots with
 * its own `setInterval` loops. Without coordination, the cert renewal
 * scheduler would fire N times per tick, burning through Let's Encrypt rate
 * limits and corrupting state via concurrent writes. Same for any other
 * cron-style loop we add in the future.
 *
 * This module provides a single primitive: `withClusterLock(name, ttl, fn)`.
 * It's a per-loop Redis lock with a TTL so a dead holder auto-releases. The
 * lock is acquired with SET NX EX (atomic), refreshed mid-work by a watchdog
 * timer, and released with a Lua CAS so we only delete our own lock.
 *
 * Usage:
 *   const { withClusterLock } = require('./utils/cluster-lock');
 *   await withClusterLock('cron:cert-renewal', 300, async () => {
 *     // only ONE api replica runs this at a time
 *   });
 *
 * Return value: { ran: boolean, result?: ... }. `ran: false` means another
 * replica held the lock — a totally normal outcome, not an error.
 */
const crypto = require('crypto');

const redisClient = require('./redis');

// Lua script that deletes the key ONLY if the value still matches our
// token. Prevents the pathological case where:
//   - replica A takes lock, TTL expires because A is slow
//   - replica B takes lock, starts working
//   - replica A finally finishes and tries to release → would delete B's lock
// With the CAS, A's release is a no-op and B keeps running.
const RELEASE_LUA = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;

// Lua script that extends the TTL only if the value still matches.
// Used by the watchdog to prevent the lock from expiring mid-work.
const EXTEND_LUA = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("EXPIRE", KEYS[1], ARGV[2])
  else
    return 0
  end
`;

// Cache the loaded script SHAs so we don't SCRIPT LOAD on every call.
let _releaseSha = null;
let _extendSha = null;

async function loadScripts() {
  if (_releaseSha && _extendSha) return;
  // node-redis v4 exposes SCRIPT LOAD via sendCommand
  try {
    _releaseSha = await redisClient.sendCommand(['SCRIPT', 'LOAD', RELEASE_LUA]);
    _extendSha = await redisClient.sendCommand(['SCRIPT', 'LOAD', EXTEND_LUA]);
  } catch (err) {
    // If SCRIPT LOAD isn't supported for some reason, we fall back to
    // EVAL on every call which works but is slower.
    _releaseSha = null;
    _extendSha = null;
  }
}

async function casDelete(key, token) {
  if (_releaseSha) {
    try {
      return await redisClient.sendCommand(['EVALSHA', _releaseSha, '1', key, token]);
    } catch (_) { /* fall through to EVAL */ }
  }
  return redisClient.sendCommand(['EVAL', RELEASE_LUA, '1', key, token]);
}

async function casExtend(key, token, ttlSeconds) {
  if (_extendSha) {
    try {
      return await redisClient.sendCommand(['EVALSHA', _extendSha, '1', key, token, String(ttlSeconds)]);
    } catch (_) { /* fall through */ }
  }
  return redisClient.sendCommand(['EVAL', EXTEND_LUA, '1', key, token, String(ttlSeconds)]);
}

/**
 * Try to acquire a cluster lock and run fn inside it.
 *
 * @param {string} name       lock name (namespace your loop, e.g. "cron:cert-renewal")
 * @param {number} ttlSeconds TTL of the lock. Must be longer than the longest
 *                            normal run time. Auto-extended by a watchdog
 *                            while fn is running.
 * @param {Function} fn       async function to run while holding the lock
 * @returns {Promise<{ran: boolean, result?: any, error?: Error}>}
 */
async function withClusterLock(name, ttlSeconds, fn) {
  if (!name || typeof name !== 'string') throw new Error('lock name required');
  if (!ttlSeconds || ttlSeconds < 1) throw new Error('ttlSeconds must be >= 1');
  if (typeof fn !== 'function') throw new Error('fn must be a function');

  await loadScripts();

  const key = `lock:${name}`;
  const token = crypto.randomBytes(16).toString('hex');

  // Atomic SET key token NX EX ttl
  const acquired = await redisClient.set(key, token, {
    NX: true,
    EX: ttlSeconds,
  });

  if (acquired !== 'OK' && acquired !== true) {
    // Someone else holds it. Normal, not an error.
    return { ran: false };
  }

  // Start a watchdog that refreshes the lock every ttl/3 seconds so a
  // long-running fn doesn't lose the lock mid-work.
  const refreshInterval = Math.max(1, Math.floor(ttlSeconds / 3));
  const watchdog = setInterval(() => {
    casExtend(key, token, ttlSeconds).catch(() => {
      // best-effort; if the extend fails we'll lose the lock naturally
    });
  }, refreshInterval * 1000);
  watchdog.unref?.(); // don't block process exit

  let result, error;
  try {
    result = await fn();
  } catch (e) {
    error = e;
  } finally {
    clearInterval(watchdog);
    try {
      await casDelete(key, token);
    } catch (_) {
      // best-effort; lock will expire on its own
    }
  }

  if (error) return { ran: true, error };
  return { ran: true, result };
}

module.exports = { withClusterLock };
