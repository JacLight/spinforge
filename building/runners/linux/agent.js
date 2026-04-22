/**
 * SpinBuild Linux runner agent.
 *
 * Nomad spawns one container per job with env injected by DispatchService:
 *   JOB_ID, CUSTOMER_ID, PLATFORM, BUILD_COMMAND, OUTPUT_DIR,
 *   WORKSPACE_PATH, ARTIFACTS_DIR, REDIS_{HOST,PORT,DB,PASSWORD}
 *
 * The agent owns the job's lifecycle once it picks it up:
 *
 *   (queued)  ← set by building-api on POST /jobs
 *     │
 *     ▼
 *   assigned  ← this agent claims it on boot
 *     │
 *     ▼
 *   running   ← unzip + build phase
 *     │
 *     ▼
 *   succeeded | failed
 *
 * Events + logs stream to job:<id>:events and job:<id>:log. SSE on the
 * api side tails those, so no RPC back to building-api is needed.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const redisLib = require('redis');

const JOB_ID = requireEnv('JOB_ID');
const CUSTOMER_ID = requireEnv('CUSTOMER_ID');
const PLATFORM = requireEnv('PLATFORM');
const WORKSPACE_PATH = requireEnv('WORKSPACE_PATH');
const ARTIFACTS_DIR = requireEnv('ARTIFACTS_DIR');

const BUILD_COMMAND = process.env.BUILD_COMMAND && process.env.BUILD_COMMAND.trim()
  ? process.env.BUILD_COMMAND
  : 'npm ci && npm run build';
const OUTPUT_DIR = process.env.OUTPUT_DIR || 'dist';

const REDIS_URL = `redis://${process.env.REDIS_HOST || 'spinforge-keydb'}:${process.env.REDIS_PORT || 16378}/${process.env.REDIS_DB ?? 1}`;

const SCRATCH = `/tmp/spinbuild-${JOB_ID}`;
const RUNNER_ID = `lxc-${os.hostname()}-${process.pid}`;
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

    // Customer-provided build command runs in a shell inside the scratch
    // dir. Shell parsing lets them chain with && / ||, pipe, etc.
    await step('build', () => runShell(BUILD_COMMAND, SCRATCH));

    await step('collect_artifacts', async () => {
      const src = path.join(SCRATCH, OUTPUT_DIR);
      await assertDir(src, `OUTPUT_DIR "${OUTPUT_DIR}" not found in workspace root after build`);
      // Copy contents of outputDir (not the dir itself) into ARTIFACTS_DIR
      // so downloads resolve at /data/artifacts/<jobId>/index.html etc.
      await run(['cp', '-r', `${src}/.`, ARTIFACTS_DIR]);

      // Also produce a single artifact.zip sitting next to the unpacked
      // files so callers that want one downloadable blob (CI caches,
      // release pipelines) have a stable URL to fetch. The unpacked
      // tree stays authoritative for CDN-style serving.
      const zipPath = path.join(ARTIFACTS_DIR, 'artifact.zip');
      await run(['sh', '-c', `cd "${src}" && zip -q -r "${zipPath}" .`]);

      // Register every produced file with the JobService so GET
      // /api/jobs/:id/artifacts and the per-customer usage roll-up see
      // them. We skip the top-level zip itself when walking the unpacked
      // tree (the zip is at the root of ARTIFACTS_DIR, not inside src).
      const recorded = await registerArtifacts(ARTIFACTS_DIR);
      await appendEvent('artifacts.collected', {
        source: src,
        count: recorded.length,
        totalBytes: recorded.reduce((s, a) => s + a.bytes, 0),
      });
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

// ─── Job state helpers ────────────────────────────────────────────────

async function transition(newStatus, extra = {}) {
  const raw = await redis.get(`job:${JOB_ID}`);
  if (!raw) throw new Error(`job ${JOB_ID} not found in keydb`);
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

// ─── Exec helpers ─────────────────────────────────────────────────────

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

function runShell(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
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
      // Best-effort — don't await each line or we'd serialize the stream.
      appendLog(label, line).catch(() => {});
    }
  });
  readable.on('end', () => {
    if (buf) appendLog(label, buf).catch(() => {});
  });
}

// Walk ARTIFACTS_DIR, hash each file, and register it on the job record
// + the per-job artifact set KeyDB keys building-api's APIs read.
//
// Writes these keys directly (no HTTP round-trip):
//   job:<id>                        artifacts[] array (JobService.recordArtifact shape)
//   job:<id>:artifacts              SADD of each artifact filename
//   artifact:<id>:<name>            hash with metadata
//   job:<id>:events                 `job.artifact` event per file (matches JobService)
async function registerArtifacts(dir) {
  const recorded = [];
  const files = await walk(dir);
  const raw = await redis.get(`job:${JOB_ID}`);
  const job = raw ? JSON.parse(raw) : {};
  const existing = Array.isArray(job.artifacts) ? job.artifacts : [];

  for (const abs of files) {
    const rel = path.relative(dir, abs);
    const name = rel.split(path.sep).join('/');
    const st = await fsp.stat(abs);
    const sha = await sha256(abs);
    const entry = {
      path: `file://${abs}`,
      name,
      bytes: st.size,
      sha256: sha,
      kind: null,
      createdAt: new Date().toISOString(),
    };
    recorded.push(entry);

    // Per-artifact hash + set — mirrors what /_internal/jobs/:id/artifact
    // would populate if the runner ever went through the HTTP path.
    try {
      await redis.sAdd(`job:${JOB_ID}:artifacts`, name);
      await redis.hSet(`artifact:${JOB_ID}:${name}`, {
        jobId: JOB_ID,
        name,
        bytes: String(st.size),
        sha256: sha,
        cephPath: abs,
        createdAt: entry.createdAt,
      });
    } catch (err) {
      log(`registerArtifacts metadata write failed for ${name}: ${err.message}`);
    }

    await appendEvent('job.artifact', entry);
  }

  // Single write-back of the merged artifacts[] — avoids N round-trips
  // for a large dist tree.
  try {
    const next = { ...job, artifacts: [...existing, ...recorded] };
    await redis.set(`job:${JOB_ID}`, JSON.stringify(next));
  } catch (err) {
    log(`artifacts array write failed: ${err.message}`);
  }

  return recorded;
}

async function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const entries = await fsp.readdir(cur, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) out.push(p);
    }
  }
  return out;
}

function sha256(filePath) {
  const crypto = require('crypto');
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
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
