/**
 * SpinForge - Admin authentication middleware
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Shared Express middleware that validates the X-Admin-Token header against
 * AdminService. Used by routes/admin.js and by server-openresty.js to gate
 * /api/* mounts that were previously unauthenticated.
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

const authenticateAdmin = async (req, res, next) => {
  const token = req.headers['x-admin-token'];

  if (!token) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  // Order: cheapest checks first.
  //   1. AdminService.validateToken handles the static ADMIN_TOKEN env bypass
  //      and JWT-backed sessions (for users that logged in via /_admin/login).
  //      These callers are always treated as full 'admin' role for back-compat.
  //   2. AdminTokenService.validatePlaintext handles the multi-token API keys
  //      created via /_admin/tokens. These carry an explicit role field.
  let admin = await adminService.validateToken(token);
  if (admin) {
    admin.role = 'admin'; // env bypass and login JWTs are always full admin
  } else {
    admin = await adminTokenService.validatePlaintext(token);
  }
  if (!admin) {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }

  // Role enforcement.
  const required = requiredRoleForRequest(req);
  const tokenRole = admin.role || 'admin';
  if ((ROLE_LEVELS[tokenRole] || 0) < (ROLE_LEVELS[required] || 0)) {
    return res.status(403).json({
      error: `This token has '${tokenRole}' role; '${required}' required for ${req.method} ${req.originalUrl || req.url}.`,
      tokenRole,
      requiredRole: required,
    });
  }

  req.admin = admin;
  next();
};

// Variant that lets PUBLIC_API_PATHS through without a token. Used when
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
