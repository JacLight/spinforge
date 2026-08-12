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

// 'railpack' detects the toolchain and builds via BuildKit; anything
// else keeps the legacy path (run BUILD_COMMAND, collect OUTPUT_DIR).
// The legacy path stays the default so an existing pipeline can't change
// behaviour underneath itself on a runner-image bump.
const BUILD_MODE = (process.env.BUILD_MODE || 'command').toLowerCase();
const ROOT_DIR = process.env.ROOT_DIR || '.';
const BUILDKIT_HOST = process.env.BUILDKIT_HOST || 'unix:///run/buildkit/buildkitd.sock';

// Container builds only.
const IMAGE_REF = process.env.IMAGE_REF || '';
// Namespaces the BuildKit cache. Per-customer, so one tenant's cache
// entries can never be served to another's build.
const CACHE_KEY = process.env.CACHE_KEY || '';
// Registry ref the BuildKit layer cache is imported from / exported to.
// Empty disables it and falls back to the build node's local cache only.
const CACHE_REF = process.env.CACHE_REF || '';
const RAILPACK_FRONTEND = process.env.RAILPACK_FRONTEND
  || 'ghcr.io/railwayapp/railpack-frontend';

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

    if (BUILD_MODE === 'container') {
      // Container builds produce an image in the registry, not a tree of
      // files. The only artifact is the reference to it.
      await containerBuild();
      await step('register_artifacts', async () => {
        const recorded = await registerArtifacts(ARTIFACTS_DIR);
        await appendEvent('artifacts.collected', {
          source: 'container-build',
          count: recorded.length,
          totalBytes: recorded.reduce((s, a) => s + a.bytes, 0),
        });
      });
      await transition('succeeded');
      await publishGlobal('job.succeeded', 'info');
      log('done');
      return;
    }

    let artifactSrc;
    let srcLabel;
    if (BUILD_MODE === 'railpack') {
      artifactSrc = await railpackBuild();
      srcLabel = `railpack output "${path.relative(SCRATCH, artifactSrc)}"`;
    } else {
      // Customer-provided build command runs in a shell inside the scratch
      // dir. Shell parsing lets them chain with && / ||, pipe, etc.
      await step('build', () => runShell(BUILD_COMMAND, SCRATCH));
      artifactSrc = path.join(SCRATCH, OUTPUT_DIR);
      srcLabel = `OUTPUT_DIR "${OUTPUT_DIR}"`;
    }

    await step('collect_artifacts', async () => {
      const src = artifactSrc;
      await assertDir(src, `${srcLabel} not found in workspace root after build`);
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

// ─── Railpack ─────────────────────────────────────────────────────────

/**
 * Build with Railpack and return the directory holding the built assets.
 *
 * Railpack normally produces a container image. We don't want one: static
 * sites are served straight off CephFS by OpenResty, and running a
 * container per site would cost far more than serving files. So we use
 * `--output`, which exports the final filesystem to a directory instead
 * of an image, and lift just the built assets out of it.
 *
 * The export is a whole rootfs (Caddy, libc, the assets — ~175 MB for a
 * Vite app), but Railpack's deploy step only copies the output directory
 * out of the build step, so no node_modules or toolchain comes with it.
 * We land it on the stage's ephemeral disk and copy only the assets to
 * Ceph.
 */
async function railpackBuild() {
  const projectDir = ROOT_DIR && ROOT_DIR !== '.' ? path.join(SCRATCH, ROOT_DIR) : SCRATCH;
  await assertDir(projectDir, `rootDir "${ROOT_DIR}" not found in the repository`);

  const exportDir = path.join(SCRATCH, '.railpack-fs');
  await fsp.mkdir(exportDir, { recursive: true });

  const buildArgs = ['railpack', 'build', '--output', exportDir];
  // Same reasoning as the container path: local cache is per-node, so it
  // stops helping the moment there is more than one build node.
  // Full exporter specs, not bare refs — railpack passes these straight
  // through to BuildKit, which rejects a bare ref with
  // `unknown cache exporter: ""`.
  if (CACHE_REF) {
    buildArgs.push(
      '--cache-from', `type=registry,ref=${CACHE_REF}`,
      '--cache-to', `type=registry,ref=${CACHE_REF},mode=max`,
    );
  }
  buildArgs.push(projectDir);

  await step('railpack_build', () => run(buildArgs, undefined, { BUILDKIT_HOST }));

  // Where the assets landed is read back out of the build, not asked for
  // separately. `railpack info` answers the same question, but it
  // re-resolves toolchain versions over the network — measured at 4.9s on
  // one run and 68s on the next, which on a warm cache was longer than
  // the build itself. The generated Caddyfile already records Railpack's
  // own decision, and it costs a file read.
  const outputPath = await caddyRootFromExport(exportDir);
  if (!outputPath) {
    // No Caddyfile means Railpack planned a long-running process (an API
    // server, not a static bundle). Serving that needs the image
    // published and scheduled — the container path, not wired up yet.
    throw new Error(
      'railpack detected a server application, not a static site (no Caddyfile in the build output). '
      + 'Serving it requires the container deploy path, which is not implemented yet. '
      + 'Use a static project, or set BUILD_MODE=command with an explicit BUILD_COMMAND.'
    );
  }

  await appendEvent('railpack.output', { outputPath });
  // outputPath is absolute inside the exported rootfs (e.g. /app/dist).
  return path.join(exportDir, outputPath.replace(/^\/+/, ''));
}

/**
 * Build a container image and push it to the cluster registry.
 *
 * Two steps, matching Railpack's documented platform integration:
 *
 *   1. `railpack prepare` writes the build plan and an info file. It
 *      only analyses — no build happens, so it's cheap.
 *   2. buildctl runs that plan through Railpack's BuildKit frontend and
 *      exports straight to the registry.
 *
 * We deliberately do NOT use `railpack build --name`: that exports a
 * docker tarball for `docker load`, which needs a Docker daemon in the
 * build container. Handing customer builds the docker socket would give
 * them root on the build node, and without it the command hangs at
 * "sending tarball" indefinitely — observed, not theorised.
 */
async function containerBuild() {
  if (!IMAGE_REF) throw new Error('container build requires IMAGE_REF');

  const projectDir = ROOT_DIR && ROOT_DIR !== '.' ? path.join(SCRATCH, ROOT_DIR) : SCRATCH;
  await assertDir(projectDir, `rootDir "${ROOT_DIR}" not found in the repository`);

  const planDir = path.join(SCRATCH, '.railpack-plan');
  await fsp.mkdir(planDir, { recursive: true });
  const planPath = path.join(planDir, 'railpack-plan.json');
  const infoPath = path.join(planDir, 'railpack-info.json');

  await step('railpack_prepare', () => run(
    ['railpack', 'prepare', projectDir, '--plan-out', planPath, '--info-out', infoPath],
    undefined,
    { BUILDKIT_HOST },
  ));

  const args = [
    'build',
    '--local', `context=${projectDir}`,
    '--local', `dockerfile=${planDir}`,
    '--frontend', 'gateway.v0',
    '--opt', `source=${RAILPACK_FRONTEND}`,
    '--output', `type=image,name=${IMAGE_REF},push=true`,
    '--progress', 'plain',
  ];
  if (CACHE_KEY) args.push('--opt', `build-arg:cache-key=${CACHE_KEY}`);

  // Push the layer cache to the registry as well as keeping it on local
  // disk. Local cache only helps while there is exactly one build node —
  // the moment a second exists, a build landing on the other one starts
  // cold. import is best-effort: on the very first build for an app the
  // ref doesn't exist yet, which buildctl treats as a miss, not an error.
  if (CACHE_REF) {
    args.push('--import-cache', `type=registry,ref=${CACHE_REF}`);
    args.push('--export-cache', `type=registry,ref=${CACHE_REF},mode=max`);
  }

  await step('image_build_push', () => run(['buildctl', ...args], undefined, { BUILDKIT_HOST }));

  // Railpack worked out how the app starts and what it's built from.
  // Carry that forward so the deploy stage doesn't have to guess, and so
  // SpinForge can keep it as the app's profile for later builds.
  //
  // The two files hold different halves: --plan-out has the start
  // command, --info-out has the detected runtime and package manager.
  // (`railpack info --format json` returns a third, larger shape — don't
  // assume they're interchangeable.)
  const plan = await readJson(planPath, log);
  const info = await readJson(infoPath, log);
  const profile = {
    imageRef: IMAGE_REF,
    startCommand: ((plan.deploy || {}).startCommand) || '',
    runtime: ((info.metadata || {}).nodeRuntime) || '',
    packageManager: ((info.metadata || {}).nodePackageManager) || '',
    providers: info.detectedProviders || [],
    resolvedPackages: Object.keys(info.resolvedPackages || {}),
  };

  await fsp.mkdir(ARTIFACTS_DIR, { recursive: true });
  await fsp.writeFile(
    path.join(ARTIFACTS_DIR, 'image.json'),
    JSON.stringify(profile, null, 2) + '\n',
  );
  const startCommand = profile.startCommand;
  // Keep the full info file as an artifact — it's the raw detection
  // result, useful for debugging a misdetected project.
  try {
    await fsp.copyFile(infoPath, path.join(ARTIFACTS_DIR, 'railpack-info.json'));
  } catch (_) {}

  await appendEvent('image.pushed', {
    imageRef: IMAGE_REF,
    startCommand,
    runtime: profile.runtime,
    packageManager: profile.packageManager,
  });
}

async function readJson(p, logger) {
  try {
    return JSON.parse(await fsp.readFile(p, 'utf8'));
  } catch (err) {
    logger(`could not read ${path.basename(p)}: ${err.message}`);
    return {};
  }
}

/**
 * Read the asset root out of the Caddyfile Railpack generates.
 *
 * The file carries a single `root * <path>` directive naming the
 * directory the site is served from — for a Vite app, `/app/dist`.
 * Returns null when there's no Caddyfile, which is the signal that this
 * isn't a static site at all.
 */
async function caddyRootFromExport(exportDir) {
  const caddyfile = path.join(exportDir, 'Caddyfile');
  let text;
  try {
    text = await fsp.readFile(caddyfile, 'utf8');
  } catch {
    return null;
  }
  const m = /^\s*root\s+\*\s+(\S+)\s*$/m.exec(text);
  return m ? m[1] : null;
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

function run(argv, cwd, env) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = argv;
    const child = spawn(cmd, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
