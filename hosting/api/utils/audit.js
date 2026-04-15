/**
 * SpinForge - admin audit trail.
 *
 * Every admin-authenticated write (and all /_admin/* calls regardless of
 * method) lands in a capped Redis stream so operators have a "who did
 * what, when" record — invaluable when debugging a broken config or
 * investigating a security incident.
 *
 * We intentionally DO NOT log request bodies. Bodies can contain API keys,
 * passwords, partner validation URLs with embedded secrets, etc. The
 * stream records metadata only: who, what endpoint, when, from where.
 * Anyone correlating with code changes has the server logs anyway.
 *
 * Storage shape:
 *   key:    audit:admin                    (Redis stream)
 *   entries: { ts, adminId, adminUser, authMethod, method, path,
 *              status, ip, userAgent, targetKind?, targetId? }
 *   cap:    ~10000 entries (MAXLEN approx)
 *
 * Read path: GET /_admin/audit?limit=N  (see routes/admin.js).
 */

const redisClient = require('./redis');

const STREAM = 'audit:admin';
const MAXLEN = 10000;

/**
 * Express middleware factory. Installs an outbound-response hook that
 * writes an audit entry once the response is done. Uses `res.on('finish')`
 * so every request path (including early returns) lands a record with
 * the final status code.
 */
function auditAdminActivity({ includeReads = false } = {}) {
  return function auditMiddleware(req, res, next) {
    // Read requests on /api/* are high-volume and low-signal. Only
    // capture writes there. For /_admin/* we capture everything —
    // those endpoints are rare and every call is interesting.
    const isAdminTree = (req.baseUrl + req.path).startsWith('/_admin');
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (!isAdminTree && !isWrite && !includeReads) return next();

    // Grab context we want to log BEFORE the handler runs, so we don't
    // lose it if the handler mutates req.
    const started = Date.now();
    const context = {
      method: req.method,
      path: req.originalUrl || req.url,
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] || '').slice(0, 200),
    };

    res.on('finish', () => {
      // req.admin is populated by authenticateAdmin after identify().
      // If it's missing the request was rejected before auth — still
      // worth logging so we see failed attempts.
      const admin = req.admin || null;
      const entry = {
        ts: new Date().toISOString(),
        durMs: Date.now() - started,
        status: res.statusCode,
        method: context.method,
        path: context.path,
        ip: context.ip,
        userAgent: context.userAgent,
        adminId: admin?.id || null,
        adminUser: admin?.username || (admin?.authMethod === 'apikey' ? 'apikey' : null),
        authMethod: admin?.authMethod || null,
      };

      // Best-effort — audit failure never breaks the request.
      writeEntry(entry).catch((err) => {
        console.error('[audit] write failed:', err.message);
      });
    });

    next();
  };
}

async function writeEntry(entry) {
  const fields = [];
  for (const [k, v] of Object.entries(entry)) {
    fields.push(k, v == null ? '' : String(v));
  }
  // node-redis v4 client's xAdd with a MAXLEN option — uses approximate
  // trimming (`~`) so we stay fast even at high volumes.
  await redisClient.xAdd(STREAM, '*', fieldsToObject(fields), {
    TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: MAXLEN },
  });
}

function fieldsToObject(fields) {
  const o = {};
  for (let i = 0; i < fields.length; i += 2) o[fields[i]] = fields[i + 1];
  return o;
}

/**
 * Fetch the most recent `limit` entries, newest first. Returns a plain
 * array of objects suitable for JSON serialization.
 */
async function recent(limit = 100) {
  const entries = await redisClient.xRevRange(STREAM, '+', '-', { COUNT: limit });
  return (entries || []).map((e) => ({ id: e.id, ...e.message }));
}

function clientIp(req) {
  const xrip = req.headers['x-real-ip'];
  if (xrip) return String(xrip).split(',')[0].trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

module.exports = { auditAdminActivity, recent, STREAM };
