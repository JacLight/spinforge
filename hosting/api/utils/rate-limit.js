/**
 * Lightweight Redis-backed rate limiter. Keeps it dependency-free — we
 * already talk to Redis from every other module, there's no reason to pull
 * in express-rate-limit + rate-limit-redis just to share state between the
 * api replicas.
 *
 * Usage:
 *   const { rateLimit } = require('../utils/rate-limit');
 *   router.post('/login', rateLimit({ name: 'admin-login', max: 5, windowSec: 60 }), handler);
 *
 * Strategy: INCR a key keyed by (name, ip), set EXPIRE on first hit, block
 * once the counter crosses `max`. Fixed window is good enough for login
 * brute-force protection — a sliding window costs more Redis round-trips.
 */

const redisClient = require('./redis');

function getClientIp(req) {
  // Behind OpenResty the real IP is set via proxy_protocol → X-Real-IP /
  // X-Forwarded-For. Prefer X-Real-IP since the edge writes it, then fall
  // back to the connection's remote address.
  const xrip = req.headers['x-real-ip'];
  if (xrip) return xrip.split(',')[0].trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimit({ name, max = 5, windowSec = 60 }) {
  if (!name) throw new Error('rateLimit: name is required');

  return async function rateLimitMiddleware(req, res, next) {
    try {
      const ip = getClientIp(req);
      const key = `ratelimit:${name}:${ip}`;

      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, windowSec);
      }

      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)));

      if (count > max) {
        const ttl = await redisClient.ttl(key);
        res.setHeader('Retry-After', String(Math.max(1, ttl)));
        return res.status(429).json({
          error: 'Too many requests',
          retryAfterSeconds: Math.max(1, ttl),
        });
      }

      next();
    } catch (error) {
      // Fail open: if Redis is unreachable we'd rather serve the request
      // than lock everyone out. Failed admin logins still get rejected by
      // the handler itself.
      console.error(`[rate-limit:${name}] error, failing open:`, error.message);
      next();
    }
  };
}

module.exports = { rateLimit, getClientIp };
