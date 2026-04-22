/**
 * SpinBuild Android runner agent.
 *
 * Same lifecycle as building/runners/linux/agent.js — differences are the
 * defaults: Android projects typically build with `./gradlew` and output to
 * `app/build/outputs/apk/release`. Keeping the two agents as separate files
 * is deliberate: Android-specific knobs (AAB vs APK, gradle wrapper perms,
 * signing env passthrough) evolve independently.
 *
 * Env (injected by DispatchService):
 *   JOB_ID, CUSTOMER_ID, PLATFORM, WORKSPACE_PATH, ARTIFACTS_DIR,
 *   BUILD_COMMAND (optional), OUTPUT_DIR (optional),
 *   ARTIFACT_PATTERNS (optional — comma-separated globs),
 *   REDIS_{HOST,PORT,DB,PASSWORD}
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const redisLib = require('redis');
const { VaultClient } = require('./lib/vault-client');

const JOB_ID = requireEnv('JOB_ID');
const CUSTOMER_ID = requireEnv('CUSTOMER_ID');
const PLATFORM = requireEnv('PLATFORM');
const WORKSPACE_PATH = requireEnv('WORKSPACE_PATH');
const ARTIFACTS_DIR = requireEnv('ARTIFACTS_DIR');

const BUILD_COMMAND = (process.env.BUILD_COMMAND && process.env.BUILD_COMMAND.trim())
  || 'chmod +x ./gradlew && ./gradlew assembleRelease bundleRelease';
const OUTPUT_DIR = process.env.OUTPUT_DIR || 'app/build/outputs';
// Comma-separated globs to collect. Default picks up apk + aab anywhere
// under OUTPUT_DIR.
const ARTIFACT_PATTERNS = (process.env.ARTIFACT_PATTERNS || '**/*.apk,**/*.aab')
  .split(',').map((s) => s.trim()).filter(Boolean);

const REDIS_URL = `redis://${process.env.REDIS_HOST || 'spinforge-keydb'}:${process.env.REDIS_PORT || 16378}/${process.env.REDIS_DB ?? 1}`;

const SCRATCH = `/tmp/spinbuild-${JOB_ID}`;
const RUNNER_ID = `android-${os.hostname()}-${process.pid}`;
const JOB_EVENTS_MAXLEN = 5_000;
const JOB_LOG_MAXLEN = 10_000;
const PLATFORM_EVENTS = 'platform:events';

const log = (...args) => console.log(`[${RUNNER_ID} ${JOB_ID}]`, ...args);

let redis;

async function main() {
  redis = redisLib.createClient({
    url: REDIS_URL,
    password: process.env.REDIS_PASSWORD || undefined,
  });
  redis.on('error', (err) => log('redis error:', err.message));
  await redis.connect();
  log('connected to keydb');

  await transition('assigned', { runnerId: RUNNER_ID });

  try {
    await appendEvent('runner.claim', { runnerId: RUNNER_ID, hostname: os.hostname() });
    await fsp.mkdir(SCRATCH, { recursive: true });
    await fsp.mkdir(ARTIFACTS_DIR, { recursive: true });

    await transition('running');
    await step('unzip', () => run(['unzip', '-q', WORKSPACE_PATH, '-d', SCRATCH]));

    // Optional signing: if VAULT_ADDR + VAULT_TOKEN + VAULT_PATH are
    // injected, check out the keystore, drop it in scratch, and surface
    // it to gradle via injected props. See Fastfile `android release_aab`
    // for the canonical invocation shape; here we build with raw gradle
    // to keep the runner image slim (no ruby/fastlane in Docker).
    const signingEnv = await setupAndroidSigningIfRequested();

    await step('build', () => runShell(buildCommandWithSigning(BUILD_COMMAND, signingEnv), SCRATCH, signingEnv));

    await step('collect_artifacts', async () => {
      const src = path.join(SCRATCH, OUTPUT_DIR);
      await assertDir(src, `OUTPUT_DIR "${OUTPUT_DIR}" not found after build`);
      const collected = await collectArtifacts(src, ARTIFACT_PATTERNS, ARTIFACTS_DIR);
      await appendEvent('artifacts.collected', { count: collected.length, files: collected });
      if (!collected.length) {
        throw new Error(`no artifacts matched patterns: ${ARTIFACT_PATTERNS.join(', ')}`);
      }
    });

    await transition('succeeded');
    await publishGlobal('job.succeeded', 'info');
    log('done');
  } catch (err) {
    log('FAILED:', err.message);
    await appendEvent('runner.error', { message: err.message });
    await transition('failed', { reason: err.message }).catch(() => {});
    await publishGlobal('job.failed', 'error', { reason: err.message });
    process.exitCode = 1;
  } finally {
    try { await fsp.rm(SCRATCH, { recursive: true, force: true }); } catch (_) {}
    try { await redis.quit(); } catch (_) {}
  }
}

// ─── Signing (optional, Vault-driven) ──────────────────────────────

async function setupAndroidSigningIfRequested() {
  const vaultAddr = process.env.VAULT_ADDR;
  const vaultToken = process.env.VAULT_TOKEN;
  const vaultPath = process.env.VAULT_PATH;
  if (!vaultAddr || !vaultToken || !vaultPath) {
    await appendEvent('signing.skipped', { reason: 'no_vault_env' });
    return {};
  }
  await appendEvent('signing.setup.started', { vaultPath });

  const client = new VaultClient({
    addr: vaultAddr,
    token: vaultToken,
    mount: process.env.VAULT_KV_MOUNT || 'secret',
  });

  // VAULT_PATH comes through as "signing/<cust>/<platform>/<id>" —
  // strip "secret/" if the caller prepended it by mistake.
  const secretPath = vaultPath.replace(/^secret\//, '').replace(/^data\//, '');
  const secrets = await client.read(secretPath);
  if (!secrets) throw new Error(`vault secret at ${vaultPath} not found`);
  if (!secrets.keystore) throw new Error('vault secret missing field: keystore');

  const keystorePath = path.join(SCRATCH, 'upload.keystore');
  await fsp.writeFile(
    keystorePath,
    Buffer.from(secrets.keystore, 'base64'),
    { mode: 0o600 }
  );

  await appendEvent('signing.setup.ok', {});

  return {
    SPINFORGE_KEYSTORE_PATH: keystorePath,
    SPINFORGE_KEYSTORE_PASSWORD: secrets.keystorePassword || '',
    SPINFORGE_KEY_ALIAS: secrets.keyAlias || '',
    SPINFORGE_KEY_PASSWORD: secrets.keyPassword || '',
  };
}

function buildCommandWithSigning(baseCommand, signingEnv) {
  if (!signingEnv.SPINFORGE_KEYSTORE_PATH) return baseCommand;
  // Append -P flags so gradle's signingConfig picks up the injected
  // keystore even if the customer's build.gradle doesn't reference the
  // SPINFORGE_* env directly.
  return [
    baseCommand,
    `-Pandroid.injected.signing.store.file=${signingEnv.SPINFORGE_KEYSTORE_PATH}`,
    `-Pandroid.injected.signing.store.password="${signingEnv.SPINFORGE_KEYSTORE_PASSWORD}"`,
    `-Pandroid.injected.signing.key.alias=${signingEnv.SPINFORGE_KEY_ALIAS}`,
    `-Pandroid.injected.signing.key.password="${signingEnv.SPINFORGE_KEY_PASSWORD}"`,
  ].join(' ');
}

// ─── Artifact collection ─────────────────────────────────────────────

async function collectArtifacts(srcDir, patterns, destDir) {
  // Walk srcDir; flatten onto destDir for simple /data/artifacts/<jobId>/<file>.
  // Name collisions are possible across multiple variants — prefix with
  // nearest parent dir to disambiguate (e.g. release-app-release.apk).
  const matched = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        const rel = path.relative(srcDir, full);
        if (matchesAny(rel, patterns)) {
          const safeName = rel.replace(/\//g, '-');
          const dest = path.join(destDir, safeName);
          await fsp.copyFile(full, dest);
          const st = await fsp.stat(dest);
          matched.push({ name: safeName, bytes: st.size });
        }
      }
    }
  }
  await walk(srcDir);
  return matched;
}

function matchesAny(relPath, globs) {
  // Tiny glob matcher for "**/*.apk" / "**/*.aab" / "**/some-file".
  // Not a full glob library; enough for v1 artifact selection.
  return globs.some((g) => matchGlob(relPath, g));
}

function matchGlob(str, glob) {
  const re = '^' + glob
    .replace(/[.+^${}()|\[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::GLOBSTAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::GLOBSTAR::/g, '.*')
    + '$';
  return new RegExp(re).test(str);
}

// ─── Job state helpers (identical shape to linux/agent.js — consider
// extracting when a third runner type reuses them) ─────────────────────

async function transition(newStatus, extra = {}) {
  const raw = await redis.get(`job:${JOB_ID}`);
  if (!raw) throw new Error(`job ${JOB_ID} not found`);
  const job = JSON.parse(raw);
  const now = new Date().toISOString();
  const next = { ...job, ...extra, status: newStatus, updatedAt: now };
  if (newStatus === 'running' && !job.startedAt) next.startedAt = now;
  if (['succeeded', 'failed', 'canceled', 'timeout'].includes(newStatus)) {
    next.completedAt = now;
    if (job.startedAt) {
      next.metrics = {
        ...(job.metrics || {}),
        durationSec: Math.round((new Date(now) - new Date(job.startedAt)) / 1000),
      };
    }
  }
  await redis.set(`job:${JOB_ID}`, JSON.stringify(next));
  await appendEvent(`job.${newStatus}`, extra);
}

async function appendEvent(type, context = {}) {
  await redis.xAdd(
    `job:${JOB_ID}:events`,
    '*',
    { type, ts: new Date().toISOString(), context: JSON.stringify(context).slice(0, 2000) },
    { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: JOB_EVENTS_MAXLEN } }
  );
}

async function appendLog(streamName, line) {
  if (!line) return;
  await redis.xAdd(
    `job:${JOB_ID}:log`,
    '*',
    { stream: streamName, line: String(line).slice(0, 8000) },
    { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: JOB_LOG_MAXLEN } }
  );
}

async function publishGlobal(type, severity, context = {}) {
  try {
    await redis.xAdd(
      PLATFORM_EVENTS,
      '*',
      {
        type,
        subject: JOB_ID,
        severity,
        source: os.hostname(),
        ts: new Date().toISOString(),
        context: JSON.stringify({ customerId: CUSTOMER_ID, platform: PLATFORM, ...context }).slice(0, 2000),
      },
      { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 10_000 } }
    );
  } catch (err) {
    log('publishGlobal failed:', err.message);
  }
}

// ─── Exec helpers ────────────────────────────────────────────────────

async function step(name, fn) {
  await appendEvent(`step.${name}.started`);
  const t0 = Date.now();
  try {
    await fn();
    await appendEvent(`step.${name}.ok`, { durationMs: Date.now() - t0 });
  } catch (err) {
    await appendEvent(`step.${name}.failed`, { durationMs: Date.now() - t0, message: err.message });
    throw err;
  }
}

function run(argv, cwd) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = argv;
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    pipeStream(child.stdout, 'stdout');
    pipeStream(child.stderr, 'stderr');
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

function runShell(command, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    pipeStream(child.stdout, 'stdout');
    pipeStream(child.stderr, 'stderr');
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`build command exited ${code}`));
    });
  });
}

function pipeStream(readable, label) {
  if (!readable) return;
  let buf = '';
  readable.setEncoding('utf8');
  readable.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      appendLog(label, line).catch(() => {});
    }
  });
  readable.on('end', () => {
    if (buf) appendLog(label, buf).catch(() => {});
  });
}

async function assertDir(p, message) {
  try {
    const st = await fsp.stat(p);
    if (!st.isDirectory()) throw new Error(message);
  } catch (_) {
    throw new Error(message);
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing required env: ${name}`);
    process.exit(2);
  }
  return v;
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
