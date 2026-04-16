/**
 * First-run bootstrap for admin credentials and the JWT signing secret.
 *
 * Two separate artifacts live on disk under /data/admin/:
 *
 *   secret.key            JWT-signing HMAC key. Generated on first boot if
 *                         missing, reused thereafter. We refuse to silently
 *                         regenerate it — rotating this key invalidates every
 *                         outstanding admin session and every sfa_ API key,
 *                         so it has to be an explicit operator action.
 *
 *   first-run-token.txt   One-time setup token. Only exists when no admin
 *                         user is registered in Redis yet. The operator
 *                         uses it once against POST /_admin/setup to create
 *                         the initial admin account; the file is deleted
 *                         as soon as it's consumed.
 *
 * Both files are mode 0600 and live on the shared SPINFORGE_DATA_ROOT volume
 * so any node in the cluster can bootstrap the same way. The directory is
 * created lazily — we never assume it already exists.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ADMIN_DIR = path.join(process.env.DATA_ROOT || '/data', 'admin');
const SECRET_PATH = path.join(ADMIN_DIR, 'secret.key');
const SETUP_TOKEN_PATH = path.join(ADMIN_DIR, 'first-run-token.txt');

function ensureDir() {
  if (!fs.existsSync(ADMIN_DIR)) {
    fs.mkdirSync(ADMIN_DIR, { recursive: true, mode: 0o700 });
  }
}

function readSecretFromDisk() {
  try {
    const v = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    return v || null;
  } catch (_) {
    return null;
  }
}

function writeSecretToDisk(value) {
  ensureDir();
  // O_EXCL: fail if file already exists. In multi-node boot the first
  // node to write wins; others read the winner's secret instead of
  // stomping it with a different random value.
  try {
    fs.writeFileSync(SECRET_PATH, value + '\n', { mode: 0o600, flag: 'wx' });
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
}

/**
 * Returns the JWT signing secret, loading (or creating) it from
 * /data/admin/secret.key and exporting it into process.env so that every
 * module reading process.env.ADMIN_TOKEN_SECRET sees the same value. The
 * env var still takes precedence if explicitly set, which lets operators
 * rotate via env without touching disk.
 */
function loadOrCreateJwtSecret() {
  if (process.env.ADMIN_TOKEN_SECRET) return process.env.ADMIN_TOKEN_SECRET;

  let secret = readSecretFromDisk();
  if (!secret) {
    const candidate = 'sf_jwt_' + crypto.randomBytes(32).toString('hex');
    const won = writeSecretToDisk(candidate);
    if (won) {
      secret = candidate;
      console.log('[admin-bootstrap] generated new JWT signing key at', SECRET_PATH);
    } else {
      // Another node beat us — read what they wrote.
      secret = readSecretFromDisk();
      console.log('[admin-bootstrap] loaded JWT signing key written by another node');
    }
  }
  process.env.ADMIN_TOKEN_SECRET = secret;
  return secret;
}

function readSetupToken() {
  try {
    return fs.readFileSync(SETUP_TOKEN_PATH, 'utf8').trim() || null;
  } catch (_) {
    return null;
  }
}

function writeSetupToken(token) {
  ensureDir();
  // Same O_EXCL guard as the secret key — first node wins.
  try {
    fs.writeFileSync(SETUP_TOKEN_PATH, token + '\n', { mode: 0o600, flag: 'wx' });
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
}

function clearSetupToken() {
  try { fs.unlinkSync(SETUP_TOKEN_PATH); } catch (_) {}
}

/**
 * If no admin users exist in Redis, make sure a setup token is written to
 * /data/admin/first-run-token.txt and log a banner pointing at it.
 * Idempotent: safe to call every boot.
 */
async function ensureSetupTokenIfNeeded(adminService) {
  const admins = await adminService.getAllAdmins();
  if (admins.length > 0) {
    // Admin already provisioned — any leftover setup token is stale, drop it.
    clearSetupToken();
    return null;
  }

  let token = readSetupToken();
  if (!token) {
    const candidate = 'sfs_' + crypto.randomBytes(24).toString('hex');
    const won = writeSetupToken(candidate);
    token = won ? candidate : readSetupToken();
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  SpinForge first-run setup                                        ║');
  console.log('║                                                                   ║');
  console.log('║  No admin user exists yet. Use the one-time setup token below to  ║');
  console.log('║  create the first admin account via POST /_admin/setup.           ║');
  console.log('║                                                                   ║');
  console.log(`║  Setup token: ${token.padEnd(50)} ║`);
  console.log(`║  Also available at: ${SETUP_TOKEN_PATH.padEnd(44)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  return token;
}

/**
 * Validate that `provided` matches the on-disk setup token using a constant-
 * time compare. Returns false if no token exists on disk.
 */
function validateSetupToken(provided) {
  if (!provided) return false;
  const expected = readSetupToken();
  if (!expected) return false;
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

module.exports = {
  loadOrCreateJwtSecret,
  ensureSetupTokenIfNeeded,
  validateSetupToken,
  clearSetupToken,
  SETUP_TOKEN_PATH,
};
