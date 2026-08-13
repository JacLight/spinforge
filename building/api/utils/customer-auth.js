/**
 * Customer authentication middleware for building-api.
 *
 * Mirrors hosting/api/routes/customer.js authenticateCustomer. Both services
 * share the same KeyDB instance (db=1) so the same tokens validate here
 * without any additional enrollment step.
 *
 * Accepted credentials (in order, cheapest lookup first):
 *   1. apitoken:<token>   — legacy short-lived token from /_auth/customer/login
 *   2. session:<token>    — browser session from /_auth/customer/login
 *   3. sfc_<…>            — long-lived customer API token (see CustomerTokenService)
 *
 * On success: req.customerId, req.userId, req.userEmail are populated.
 * For sfc_ tokens, req.apiTokenId is also set.
 */
const crypto = require('crypto');
const redisClient = require('./redis');
const { identify: identifyAdmin } = require('./admin-auth');

const SFC_PREFIX = 'sfc_';

function hashToken(plaintext) {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

// Resolve an sfc_ token by reading the global hash → {customerId,id} pointer
// that hosting/api's CustomerTokenService writes. Then load the per-customer
// token record to fetch userId/userEmail and check expiry/revocation.
async function validateSfcToken(plaintext) {
  if (!plaintext || !plaintext.startsWith(SFC_PREFIX)) return null;
  const ptr = await redisClient.get(`customer:token:hash:${hashToken(plaintext)}`);
  if (!ptr) return null;
  let lookup;
  try { lookup = JSON.parse(ptr); } catch { return null; }
  const { customerId, id } = lookup || {};
  if (!customerId || !id) return null;

  const recordRaw = await redisClient.get(`customer:${customerId}:token:${id}`);
  if (!recordRaw) return null;
  let record;
  try { record = JSON.parse(recordRaw); } catch { return null; }
  if (record.revokedAt) return null;
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) return null;

  return {
    customerId,
    userId: record.userId || null,
    userEmail: record.userEmail || null,
    tokenId: id,
  };
}

const authenticateCustomer = async (req, res, next) => {
  const header = req.headers['authorization'];
  const bearer = header && /^Bearer\s+(.+)$/i.exec(header);
  const authToken = (bearer && bearer[1].trim()) || req.headers['x-auth-token'];

  if (!authToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // 1+2. Single Redis GET for legacy session/apitoken first.
    const apiTokenRaw = await redisClient.get(`apitoken:${authToken}`);
    if (apiTokenRaw) {
      const t = JSON.parse(apiTokenRaw);
      req.customerId = t.customerId;
      req.userId = t.userId;
      req.userEmail = t.email;
    } else {
      const sessionRaw = await redisClient.get(`session:${authToken}`);
      if (sessionRaw) {
        const s = JSON.parse(sessionRaw);
        req.customerId = s.customerId;
        req.userId = s.userId;
        req.userEmail = s.email;
      } else {
        // 3. Long-lived sfc_ token.
        const sfc = await validateSfcToken(authToken);
        if (sfc) {
          req.customerId = sfc.customerId;
          req.userId = sfc.userId;
          req.userEmail = sfc.userEmail;
          req.apiTokenId = sfc.tokenId;
        } else {
          // 4. An admin acting on a customer's behalf.
          //
          // admin-ui manages every customer's pipelines but holds an admin
          // JWT, not a customer token — so without this the whole Pipelines
          // section 401s against building-api, which reads as "no pipelines"
          // rather than as an auth failure.
          //
          // The customer is never inferred: an admin must name it, the same
          // way the pipeline editor already makes them pick one. Guessing
          // would mean an operator silently creating pipelines under
          // whichever account happened to be first.
          const admin = await identifyAdmin(req).catch(() => null);
          if (!admin) {
            return res.status(401).json({ error: 'Invalid or expired token' });
          }
          // Read-only inspection (repo detection) happens before anyone
          // has picked an app, so an admin is allowed through without one.
          // Routes that write must check req.customerId themselves.
          const onBehalfOf = req.headers['x-customer-id']
            || (req.body && req.body.customerId)
            || req.query.customerId;
          req.customerId = onBehalfOf ? String(onBehalfOf) : null;
          req.isAdmin = true;
          req.adminId = admin.id || admin.username || 'admin';
        }
      }
    }

    // An authenticated admin may proceed without a customer; a customer
    // token that resolved to nothing may not.
    if (!req.customerId && !req.isAdmin) {
      return res.status(401).json({ error: 'Invalid customer token' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticateCustomer };
