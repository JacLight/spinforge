/**
 * Per-customer audit trail.
 *
 * Mirrors utils/audit.js but scoped per-customer: each entry lands in
 * `audit:customer:{customerId}` so we don't leak one customer's activity
 * to another, and the read endpoint can return everything for the
 * authenticated caller without filtering.
 *
 * As with admin audit, we never store request bodies — only metadata
 * (who in the customer org, what endpoint, when, from where, status).
 */

const redisClient = require('./redis');

const STREAM_PREFIX = 'audit:customer:';
const MAXLEN = 5000;

function streamKey(customerId) {
  return `${STREAM_PREFIX}${customerId}`;
}

function auditCustomerActivity({ includeReads = false } = {}) {
  return function auditMiddleware(req, res, next) {
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (!isWrite && !includeReads) return next();

    const started = Date.now();
    const ctx = {
      method: req.method,
      path: req.originalUrl || req.url,
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] || '').slice(0, 200),
    };

    res.on('finish', () => {
      // authenticateCustomer populated these — if it didn't, we have
      // nothing to scope the entry to and the request was already
      // rejected with 401, so skip writing.
      if (!req.customerId) return;

      const entry = {
        ts: new Date().toISOString(),
        durMs: Date.now() - started,
        status: res.statusCode,
        method: ctx.method,
        path: ctx.path,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        customerId: req.customerId,
        userId: req.userId || null,
        userEmail: req.userEmail || null,
        authMethod: req.apiTokenId ? 'apitoken' : 'session',
        apiTokenId: req.apiTokenId || null,
      };

      writeEntry(req.customerId, entry).catch((err) => {
        console.error('[customer-audit] write failed:', err.message);
      });
    });

    next();
  };
}

async function writeEntry(customerId, entry) {
  const obj = {};
  for (const [k, v] of Object.entries(entry)) {
    obj[k] = v == null ? '' : String(v);
  }
  await redisClient.xAdd(streamKey(customerId), '*', obj, {
    TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: MAXLEN },
  });
}

async function recent(customerId, limit = 100) {
  const entries = await redisClient.xRevRange(streamKey(customerId), '+', '-', {
    COUNT: limit,
  });
  return (entries || []).map((e) => ({ id: e.id, ...e.message }));
}

function clientIp(req) {
  const xrip = req.headers['x-real-ip'];
  if (xrip) return String(xrip).split(',')[0].trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

module.exports = { auditCustomerActivity, recent, STREAM_PREFIX };
