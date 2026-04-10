/**
 * SpinForge - Admin authentication middleware
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Two-path admin auth model. There is no overlap between the paths — a
 * request must use exactly one of these and the wrong header is rejected:
 *
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ Identity                 Header                  Token format        │
 *   ├──────────────────────────────────────────────────────────────────────┤
 *   │ Logged-in admin user     Authorization: Bearer   JWT from /_admin/  │
 *   │                                                  login              │
 *   │ Machine API integration  X-API-Key               sfa_… (created via │
 *   │                                                  /_admin/tokens)    │
 *   │                                                  OR the static      │
 *   │                                                  ADMIN_TOKEN env    │
 *   │                                                  bypass             │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * Used by routes/admin.js (mounts /_admin/*) and by server-openresty.js to
 * gate /api/* mounts.
 */
const AdminService = require('../services/AdminService');
const AdminTokenService = require('../services/AdminTokenService');
const redisClient = require('./redis');

const adminService = new AdminService(redisClient);
const adminTokenService = new AdminTokenService(redisClient);

const { ROLE_LEVELS } = AdminTokenService;

// Compute the minimum role required to satisfy this request.
//   - Anything under /_admin/* requires the full 'admin' role (token mgmt,
//     settings, customer/admin user management).
//   - Within /api/*, write methods (POST/PUT/PATCH/DELETE) require 'write'.
//   - GET/HEAD on /api/* requires 'read'.
function requiredRoleForRequest(req) {
  const url = req.originalUrl || req.url || '';
  if (url.startsWith('/_admin/')) return 'admin';
  const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  if (writeMethods.has(req.method)) return 'write';
  return 'read';
}

// Paths under /api that MUST remain publicly reachable. Anything listed here
// is matched against req.path (which is relative to the mount point), so an
// entry like '/health' matches a request to '/api/health'.
const PUBLIC_API_PATHS = [
  '/health',
  '/_health',
];

function isPublicPath(reqPath) {
  return PUBLIC_API_PATHS.some((p) => reqPath === p || reqPath.startsWith(p + '/'));
}

// Pull "Bearer <token>" out of the Authorization header. Returns null if the
// header is missing or doesn't match the Bearer scheme.
function extractBearerToken(req) {
  const header = req.headers['authorization'];
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

/**
 * Try to identify the caller. Returns either an admin object (with `role`
 * and `authMethod` set) or null. Does NOT touch the response.
 */
async function identify(req) {
  // ─── Path 1: Bearer JWT (logged-in admin user) ───────────────────────
  const bearer = extractBearerToken(req);
  if (bearer) {
    const admin = await adminService.validateSessionToken(bearer);
    if (admin) {
      return {
        ...admin,
        role: 'admin', // logged-in users always have full admin role
        authMethod: 'session',
      };
    }
    // Bearer was provided but invalid → fall through with null so the
    // caller can return a precise 401.
    return null;
  }

  // ─── Path 2: X-API-Key (machine API key) ─────────────────────────────
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    // 2a. Static env bypass — useful for emergency / internal services.
    if (process.env.ADMIN_TOKEN && apiKey === process.env.ADMIN_TOKEN) {
      return {
        id: 'env-admin',
        username: 'env',
        email: 'admin@spinforge.local',
        isSuperAdmin: true,
        role: 'admin',
        authMethod: 'env',
      };
    }
    // 2b. Database-backed sfa_ tokens with explicit roles.
    const apiAdmin = await adminTokenService.validatePlaintext(apiKey);
    if (apiAdmin) {
      return { ...apiAdmin, authMethod: 'apikey' };
    }
    return null;
  }

  // No credentials at all
  return null;
}

const authenticateAdmin = async (req, res, next) => {
  const hasBearer = !!extractBearerToken(req);
  const hasApiKey = !!req.headers['x-api-key'];

  if (!hasBearer && !hasApiKey) {
    return res.status(401).json({
      error: 'Admin authentication required',
      hint: 'Send Authorization: Bearer <login-jwt> or X-API-Key: <sfa_token>',
    });
  }

  const admin = await identify(req);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid or expired admin credentials' });
  }

  // Role enforcement
  const required = requiredRoleForRequest(req);
  const tokenRole = admin.role || 'admin';
  if ((ROLE_LEVELS[tokenRole] || 0) < (ROLE_LEVELS[required] || 0)) {
    return res.status(403).json({
      error: `This credential has '${tokenRole}' role; '${required}' required for ${req.method} ${req.originalUrl || req.url}.`,
      tokenRole,
      requiredRole: required,
    });
  }

  req.admin = admin;
  next();
};

// Variant that lets PUBLIC_API_PATHS through without credentials. Used when
// mounting broad trees like /api/*.
const authenticateAdminOrPublic = async (req, res, next) => {
  if (isPublicPath(req.path)) return next();
  return authenticateAdmin(req, res, next);
};

module.exports = {
  adminService,
  adminTokenService,
  authenticateAdmin,
  authenticateAdminOrPublic,
  PUBLIC_API_PATHS,
};
