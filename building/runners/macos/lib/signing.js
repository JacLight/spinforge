/**
 * iOS / macOS signing setup.
 *
 * Takes a Vault handle (addr + short-lived token + secret path) and
 * produces an ephemeral keychain, imports the cert, installs the
 * provisioning profile(s). Returns a teardown function the caller must
 * run in a `finally` to leave the Mac clean.
 *
 * Secret shape expected at `vault.path`:
 *   {
 *     cert:          base64(.p12)
 *     certPassword:  string
 *     profile:       base64(.mobileprovision)
 *     teamId:        string (optional)
 *     bundleId:      string (optional, for fastlane match)
 *
 *     // App Store Connect API key for fastlane (pilot, deliver):
 *     appStoreConnectApiKey:     base64(.p8)      (optional)
 *     appStoreConnectKeyId:      string            (optional)
 *     appStoreConnectIssuerId:   string            (optional)
 *   }
 */

const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const { VaultClient } = require('./vault-client');

async function setupIosSigning({ vault, scratchDir, state, platform }) {
  if (!vault || !vault.addr || !vault.token || !vault.path) {
    throw new Error('setupIosSigning: vault {addr, token, path} required');
  }

  const client = new VaultClient(vault);
  const secrets = await client.read(vault.path.replace(/^secret\//, '').replace(/^data\//, ''));
  if (!secrets) throw new Error(`vault secret at ${vault.path} not found`);
  if (!secrets.cert || !secrets.profile) {
    throw new Error('vault secret missing required fields: cert, profile');
  }

  const keychainName = `spinbuild-${path.basename(scratchDir)}`;
  const keychainPath = path.join(scratchDir, `${keychainName}.keychain-db`);
  const keychainPassword = crypto.randomBytes(24).toString('base64');

  // Create + unlock keychain. 3600s idle timeout — builds typically
  // finish faster; if not, the outer job timeout handles it.
  await run(['security', 'create-keychain', '-p', keychainPassword, keychainPath]);
  await run(['security', 'set-keychain-settings', '-t', '3600', '-l', keychainPath]);
  await run(['security', 'unlock-keychain', '-p', keychainPassword, keychainPath]);

  // Prepend to search list so codesign finds the cert.
  const { stdout: listRaw } = await runCapture('security', ['list-keychains', '-d', 'user']);
  const existing = (listRaw.match(/"([^"]+)"/g) || []).map((s) => s.slice(1, -1));
  await run(['security', 'list-keychains', '-d', 'user', '-s', keychainPath, ...existing]);

  // Import the cert.
  const certPath = path.join(scratchDir, 'signing.p12');
  await fsp.writeFile(certPath, Buffer.from(secrets.cert, 'base64'), { mode: 0o600 });
  await run([
    'security', 'import', certPath,
    '-k', keychainPath,
    '-P', secrets.certPassword || '',
    '-T', '/usr/bin/codesign',
    '-T', '/usr/bin/security',
  ]);
  // Prevent the OS keychain access prompt.
  await run([
    'security', 'set-key-partition-list',
    '-S', 'apple-tool:,apple:,codesign:',
    '-s', '-k', keychainPassword,
    keychainPath,
  ]);

  // Install the provisioning profile. Apple requires it live under
  // ~/Library/MobileDevice/Provisioning Profiles with the UUID as the
  // filename for Xcode to pick it up.
  const profileBuf = Buffer.from(secrets.profile, 'base64');
  const profileUuid = extractProfileUuid(profileBuf) || `spinbuild-${Date.now()}`;
  const profileDir = path.join(os.homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles');
  await fsp.mkdir(profileDir, { recursive: true });
  const profilePath = path.join(profileDir, `${profileUuid}.mobileprovision`);
  await fsp.writeFile(profilePath, profileBuf, { mode: 0o600 });

  // Record non-secret metadata for the build-executor (Fastfile reads it).
  await state.appendEvent('signing.ready', {
    platform,
    teamId: secrets.teamId || null,
    bundleId: secrets.bundleId || null,
    profileUuid,
  });

  // Optional App Store Connect API key for fastlane pilot/deliver.
  let appStoreConnectKeyPath = null;
  if (secrets.appStoreConnectApiKey) {
    appStoreConnectKeyPath = path.join(scratchDir, 'app_store_connect.p8');
    await fsp.writeFile(
      appStoreConnectKeyPath,
      Buffer.from(secrets.appStoreConnectApiKey, 'base64'),
      { mode: 0o600 }
    );
  }

  const envForBuild = {
    SPINFORGE_KEYCHAIN_PATH: keychainPath,
    SPINFORGE_KEYCHAIN_PASSWORD: keychainPassword,
    SPINFORGE_PROFILE_PATH: profilePath,
    SPINFORGE_PROFILE_UUID: profileUuid,
    ...(secrets.teamId ? { SPINFORGE_TEAM_ID: secrets.teamId } : {}),
    ...(secrets.bundleId ? { SPINFORGE_BUNDLE_ID: secrets.bundleId } : {}),
    ...(appStoreConnectKeyPath ? {
      APP_STORE_CONNECT_API_KEY_PATH: appStoreConnectKeyPath,
      APP_STORE_CONNECT_API_KEY_ID: secrets.appStoreConnectKeyId || '',
      APP_STORE_CONNECT_ISSUER_ID: secrets.appStoreConnectIssuerId || '',
    } : {}),
  };

  const teardown = async () => {
    // Remove from search list, delete keychain, remove profile + secret files.
    try {
      await run(['security', 'list-keychains', '-d', 'user', '-s', ...existing]);
    } catch (_) {}
    try { await run(['security', 'delete-keychain', keychainPath]); } catch (_) {}
    try { await fsp.unlink(profilePath); } catch (_) {}
    try { await fsp.unlink(certPath); } catch (_) {}
    if (appStoreConnectKeyPath) {
      try { await fsp.unlink(appStoreConnectKeyPath); } catch (_) {}
    }
  };

  return { envForBuild, teardown };
}

function extractProfileUuid(buf) {
  // mobileprovision is a CMS-signed plist. We find the plist block and
  // regex out UUID — easier than parsing the cert envelope for a name.
  const str = buf.toString('latin1');
  const m = str.match(/<key>UUID<\/key>\s*<string>([^<]+)<\/string>/);
  return m ? m[1] : null;
}

function run(argv) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = argv;
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (c) => { err += c; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(0, 400)}`));
    });
  });
}

function runCapture(cmd, args) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    c.stdout.setEncoding('utf8');
    c.stderr.setEncoding('utf8');
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { err += d; });
    c.on('error', reject);
    c.on('close', (code) => {
      if (code === 0) resolve({ stdout: out, stderr: err });
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(0, 400)}`));
    });
  });
}

module.exports = { setupIosSigning };
