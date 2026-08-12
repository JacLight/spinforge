/**
 * Nomad stage handlers.
 *
 * For `runner.kind === 'nomad'` actions, BuildService delegates here.
 * Each handler:
 *   1. Writes the stage spec to a well-known env + path that the
 *      existing building/runners/linux agent can consume.
 *   2. Submits a Nomad batch job (one per stage).
 *   3. Polls until the alloc is terminal, tailing stderr into the
 *      stage log stream so the UI shows live progress.
 *   4. Reads outputs back from the artifact dir on Ceph.
 *
 * The existing agent.js already implements the unzip → BUILD_COMMAND →
 * copy-to-artifacts flow. We reuse it verbatim by passing the right env;
 * no runner changes needed for build.static / build.node.
 *
 * build.container / build.android / sign.* / publish.* remain
 * unregistered — each needs a different runner workflow and will get a
 * dedicated handler in the next pass. Those stages are explicitly
 * marked `skipped_unimplemented` by BuildService with a clear reason.
 */

const axios = require('axios');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

const DEFAULT_NOMAD_ADDR = process.env.NOMAD_ADDR || 'http://127.0.0.1:4646';
const DEFAULT_DATACENTER = process.env.NOMAD_DATACENTER || 'spinforge-dc1';
const DEFAULT_REGISTRY = process.env.BUILDER_REGISTRY || '192.168.88.170:5000';
const DATA_HOST_VOLUME = process.env.SPINFORGE_DATA_HOST_VOLUME || 'spinforge-data';

// Node class customer builds are pinned to. Without this a build lands
// wherever Nomad has room — which meant a 2000 MHz / 2048 MB stage
// competing with the hosting API, the UIs and OpenResty on the same
// three converged nodes. Set to empty to lift the constraint (single-node
// dev setups where no node carries the class).
const BUILD_NODE_CLASS = process.env.BUILD_NODE_CLASS !== undefined
  ? process.env.BUILD_NODE_CLASS
  : 'build';

// buildkitd runs on the build node as a long-lived container with its
// socket on a host path. Stage jobs bind-mount the directory rather than
// dialling TCP — see the mount comment in staticHandler.
const BUILDKIT_SOCKET_DIR = process.env.BUILDKIT_SOCKET_DIR || '/run/buildkit';
const BUILDKIT_HOST = process.env.BUILDKIT_HOST || `unix://${BUILDKIT_SOCKET_DIR}/buildkitd.sock`;

// Redis coordinates handed to every stage runner. Inherited from this
// process so the runner talks to the same KeyDB building-api does.
const REDIS_ENV = {
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: String(process.env.REDIS_PORT || 16378),
  REDIS_DB: String(process.env.REDIS_DB || 1),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
};

const POLL_INTERVAL_MS = 2000;
const LOG_TAIL_CHUNK = 64 * 1024;

// In-allocation retries for a build stage. See the RestartPolicy comment
// in buildNomadSpec for why this isn't 0.
const STAGE_RESTART_ATTEMPTS = Number(process.env.BUILD_STAGE_RETRIES || 2);

function build({ logger, redis } = {}) {
  const log = logger || console;
  const http = axios.create({
    baseURL: DEFAULT_NOMAD_ADDR,
    timeout: 30_000,
    validateStatus: (s) => s < 500,
  });
  const handlers = new Map();

  handlers.set('build.static', staticHandler({ http, log, redis }));
  handlers.set('build.node', nodeHandler({ http, log, redis }));
  handlers.set('build.container', containerHandler({ http, log, redis }));

  return handlers;
}

// ─── build.container ───────────────────────────────────────────────────
// Produces an image in the cluster registry rather than a tree of files.
// The runner writes image.json into the artifact dir; we read the ref
// back out of it and hand it to deploy.container.

function containerHandler({ http, log, redis }) {
  return async ({ build, stage, inputs, emit }) => {
    const artifactDir = path.join(build.workspace, '..', `${build.id}-${stage.id}-artifacts`);
    await fs.mkdir(artifactDir, { recursive: true });

    const workspacePath = inputs.workspacePath
      || (build.workspace && await firstExisting([
        path.join(build.workspace, 'workspace.zip'),
      ]));
    if (!workspacePath) {
      throw new Error('build.container: no workspacePath input and no workspace.zip at build root');
    }

    // Tagged by build id so a rollback can name an exact prior image,
    // and so two builds of the same app never race on one tag.
    const imageRef = inputs.imageName
      ? `${DEFAULT_REGISTRY}/${inputs.imageName}`
      : `${DEFAULT_REGISTRY}/apps/${slug(build.customerId)}/${slug(build.pipelineId)}:${build.id}`;

    const spec = buildNomadSpec({
      buildId: build.id,
      stageId: stage.id,
      image: `${DEFAULT_REGISTRY}/spinforge/builder-linux:latest`,
      env: {
        JOB_ID: `${build.id}-${stage.id}`,
        CUSTOMER_ID: build.customerId,
        PLATFORM: 'linux',
        BUILD_MODE: 'container',
        ROOT_DIR: inputs.rootDir || '.',
        IMAGE_REF: imageRef,
        // Cache is namespaced per customer so one tenant's layers are
        // never reused for another's build.
        CACHE_KEY: `cust-${slug(build.customerId)}`,
        BUILDKIT_HOST,
        WORKSPACE_PATH: workspacePath,
        ARTIFACTS_DIR: artifactDir,
        ...(inputs.env || {}),
      },
      hostVolumes: [`${BUILDKIT_SOCKET_DIR}:${BUILDKIT_SOCKET_DIR}`],
    });

    await seedRunnerJob({ redis, jobId: `${build.id}-${stage.id}`, build, stage, log });
    const { nomadJobId, allocId } = await submitAndWait({ http, spec, emit, log });
    await tailNomadLogs({ http, allocId, emit, log });

    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(path.join(artifactDir, 'image.json'), 'utf8'));
    } catch (err) {
      throw new Error(
        `build.container: runner exited clean but wrote no image.json to ${artifactDir} — the push probably failed (${err.message})`
      );
    }
    if (!manifest.imageRef) throw new Error('build.container: image.json has no imageRef');

    emit('info', 'finish', `pushed ${manifest.imageRef}`, { nomadJobId });
    return { imageRef: manifest.imageRef, startCommand: manifest.startCommand || '' };
  };
}

// Registry paths allow [a-z0-9._/-]; ids carry underscores and case.
function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

// ─── build.static ──────────────────────────────────────────────────────
// Reuses the linux builder image. Unzips the workspace zip under the
// stage's workspace, runs BUILD_COMMAND, copies OUTPUT_DIR into the
// artifact dir. Outputs { artifactPath, bytes }.

function staticHandler({ http, log, redis }) {
  return async ({ build, stage, inputs, emit, workspace }) => {
    const artifactDir = path.join(build.workspace, '..', `${build.id}-${stage.id}-artifacts`);
    await fs.mkdir(artifactDir, { recursive: true });

    // Resolve the upstream workspace. The stage either runs against a
    // source-stage's output (common) or falls back to the build-level
    // workspace.zip.
    const workspacePath = inputs.workspacePath
      || (build.workspace && await firstExisting([
        path.join(build.workspace, 'workspace.zip'),
      ]));
    if (!workspacePath) {
      throw new Error('build.static: no workspacePath input and no workspace.zip at build root');
    }

    const spec = buildNomadSpec({
      buildId: build.id,
      stageId: stage.id,
      image: `${DEFAULT_REGISTRY}/spinforge/builder-linux:latest`,
      env: {
        JOB_ID: `${build.id}-${stage.id}`,
        CUSTOMER_ID: build.customerId,
        PLATFORM: 'web',
        BUILD_COMMAND: inputs.command,
        OUTPUT_DIR: inputs.outputDir,
        FRAMEWORK: inputs.framework || '',
        BUILD_MODE: inputs.mode || 'command',
        ROOT_DIR: inputs.rootDir || '.',
        BUILDKIT_HOST: BUILDKIT_HOST,
        WORKSPACE_PATH: workspacePath,
        ARTIFACTS_DIR: artifactDir,
        ...(inputs.env || {}),
      },
      // Railpack drives buildkitd over this socket. Bind-mounted rather
      // than reached over TCP: buildkitd's protocol is unauthenticated
      // and can build as root, so a TCP listener would be root-equivalent
      // to anything on the LAN.
      hostVolumes: inputs.mode === 'railpack' ? [`${BUILDKIT_SOCKET_DIR}:${BUILDKIT_SOCKET_DIR}`] : [],
    });

    await seedRunnerJob({ redis, jobId: `${build.id}-${stage.id}`, build, stage, log });
    const { nomadJobId, allocId } = await submitAndWait({ http, spec, emit, log });
    await tailNomadLogs({ http, allocId, emit, log });

    // Runner succeeded iff it left files under ARTIFACTS_DIR
    const bytes = await dirSizeBytes(artifactDir);
    if (bytes === 0) {
      throw new Error(`build.static: runner exited clean but artifact dir is empty (${artifactDir}). Check your OUTPUT_DIR.`);
    }

    emit('info', 'finish', `produced ${bytes} bytes into ${artifactDir}`, { nomadJobId });
    return { artifactPath: artifactDir, bytes };
  };
}

// ─── build.node ────────────────────────────────────────────────────────
// Same runner; separate handler keeps output shape distinct (zip vs
// dir). For this cut, the builder just emits the output directory;
// zipping is deferred to a follow-up (trivial: tar + gzip into
// artifactDir).

function nodeHandler({ http, log, redis }) {
  return async ({ build, stage, inputs, emit }) => {
    const artifactDir = path.join(build.workspace, '..', `${build.id}-${stage.id}-artifacts`);
    await fs.mkdir(artifactDir, { recursive: true });

    const workspacePath = inputs.workspacePath
      || path.join(build.workspace, 'workspace.zip');
    if (!fsSync.existsSync(workspacePath)) {
      throw new Error(`build.node: no zip at ${workspacePath}`);
    }

    const spec = buildNomadSpec({
      buildId: build.id,
      stageId: stage.id,
      image: `${DEFAULT_REGISTRY}/spinforge/builder-linux:latest`,
      env: {
        JOB_ID: `${build.id}-${stage.id}`,
        CUSTOMER_ID: build.customerId,
        PLATFORM: 'linux',
        BUILD_COMMAND: `${inputs.install || 'npm ci'} && ${inputs.command || 'npm run build'}`,
        OUTPUT_DIR: inputs.outputDir || 'dist',
        WORKSPACE_PATH: workspacePath,
        ARTIFACTS_DIR: artifactDir,
        ...(inputs.env || {}),
      },
    });

    await seedRunnerJob({ redis, jobId: `${build.id}-${stage.id}`, build, stage, log });
    const { nomadJobId, allocId } = await submitAndWait({ http, spec, emit, log });
    await tailNomadLogs({ http, allocId, emit, log });

    const bytes = await dirSizeBytes(artifactDir);
    if (bytes === 0) {
      throw new Error('build.node: artifact dir empty — check outputDir in your build config');
    }
    // Zip the artifact dir so the downstream host.static / download
    // surface has a single-file handle.
    const zipPath = path.join(artifactDir, '..', `${build.id}-${stage.id}.zip`);
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const pexec = promisify(execFile);
    await pexec('zip', ['-r', '-q', zipPath, '.'], { cwd: artifactDir });
    const zipBytes = (await fs.stat(zipPath)).size;
    emit('info', 'package', `packaged build as ${zipPath} (${zipBytes} bytes)`);
    return { artifactZip: zipPath, bytes: zipBytes };
  };
}

// ─── Nomad job helpers ─────────────────────────────────────────────────

function buildNomadSpec({ buildId, stageId, image, env, hostVolumes = [] }) {
  const id = `stage-${buildId}-${stageId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  return {
    ID: id,
    Name: id,
    Type: 'batch',
    Datacenters: [DEFAULT_DATACENTER],
    ...(BUILD_NODE_CLASS ? {
      Constraints: [{
        LTarget: '${node.class}',
        RTarget: BUILD_NODE_CLASS,
        Operand: '=',
      }],
    } : {}),
    TaskGroups: [{
      Name: 'stage',
      Count: 1,
      // Builds pull from npm, GitHub releases, ghcr and apt — a lot of
      // third-party network for something a customer sees as "my push
      // failed". With Attempts:0 a single upstream 503 killed the whole
      // build: two of four container builds died that way during
      // bring-up, once on the yarn tarball and once on the mise binary,
      // both transient and both fine on retry.
      //
      // Retrying a build stage is safe — it's a pure function of the
      // workspace, and the image push overwrites its own tag. Restarts
      // stay in-allocation so the warm BuildKit cache on that node is
      // reused; a genuine failure still fails, just after 3 tries.
      RestartPolicy: {
        Attempts: STAGE_RESTART_ATTEMPTS,
        Interval: 900 * 1e9,
        Delay: 15 * 1e9,
        Mode: 'fail',
      },
      ReschedulePolicy: { Attempts: 0 },
      EphemeralDisk: { SizeMB: 2048 },
      Volumes: {
        'spinforge-data': {
          Name: 'spinforge-data',
          Type: 'host',
          ReadOnly: false,
          Source: DATA_HOST_VOLUME,
        },
      },
      Tasks: [{
        Name: 'stage',
        Driver: 'docker',
        Config: {
          image,
          ...(hostVolumes.length ? { volumes: hostVolumes } : {}),
        },
        VolumeMounts: [{ Volume: 'spinforge-data', Destination: '/data', ReadOnly: false }],
        // The runner agent publishes step status to KeyDB. Its default host
        // is the compose-era name `spinforge-keydb`, which doesn't resolve
        // inside Nomad's bridge network — the agent then retries the
        // connection forever and the stage hangs until it times out rather
        // than failing. Pass the same coordinates building-api itself uses.
        Env: { ...REDIS_ENV, ...env },
        Resources: { CPU: 2000, MemoryMB: 2048 },
        KillTimeout: 30_000_000_000,
      }],
    }],
    Meta: { spinbuild_build_id: buildId, spinbuild_stage_id: stageId },
  };
}

/**
 * Seed the `job:<id>` record the runner agent expects.
 *
 * agent.js predates pipelines: its first act is transition('assigned'),
 * which reads `job:$JOB_ID` from KeyDB and throws "not found" if it's
 * missing. The pipeline executor tracks state on the *build* record
 * instead, so nothing was ever writing this — every Nomad stage started,
 * connected to KeyDB, and immediately died.
 *
 * Writing a minimal record keeps agent.js unmodified and gives its status
 * transitions somewhere to land. The build record stays authoritative for
 * the UI; this one is the runner's scratch state.
 */
async function seedRunnerJob({ redis, jobId, build, stage, log }) {
  if (!redis) {
    log.warn?.('[nomad] no redis client — runner job record not seeded, agent will fail');
    return;
  }
  const now = new Date().toISOString();
  await redis.set(`job:${jobId}`, JSON.stringify({
    id: jobId,
    buildId: build.id,
    stageId: stage.id,
    customerId: build.customerId,
    platform: 'web',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    source: 'pipeline-stage',
  }));
  // Runner state is disposable once the stage reports back; don't let it
  // accumulate in KeyDB forever.
  await redis.expire(`job:${jobId}`, 7 * 24 * 60 * 60).catch(() => {});
}

async function submitAndWait({ http, spec, emit, log }) {
  emit('info', 'dispatch', `submitting Nomad batch job ${spec.ID}`);
  const reg = await http.post('/v1/jobs', { Job: spec });
  if (reg.status >= 400) {
    throw new Error(`Nomad register failed (${reg.status}): ${JSON.stringify(reg.data).slice(0, 500)}`);
  }

  // Poll allocations until one is running or terminal.
  let allocId = null;
  const started = Date.now();
  // Must exceed the worst case of STAGE_RESTART_ATTEMPTS full builds plus
  // their restart delays, or a stage that is legitimately retrying gets
  // declared dead by the poller while it's still working.
  const maxWaitMs = Number(process.env.BUILD_STAGE_TIMEOUT_MS || 30 * 60 * 1000);
  while (Date.now() - started < maxWaitMs) {
    const allocs = await http.get(`/v1/job/${encodeURIComponent(spec.ID)}/allocations`);
    if (allocs.status === 200 && Array.isArray(allocs.data) && allocs.data.length > 0) {
      const a = allocs.data[0];
      allocId = a.ID;
      if (['complete', 'failed', 'lost'].includes(a.ClientStatus)) {
        if (a.ClientStatus !== 'complete') {
          throw new Error(`Nomad alloc ${a.ID} terminated ${a.ClientStatus}: ${a.FailedReason || 'unknown'}`);
        }
        return { nomadJobId: spec.ID, allocId: a.ID };
      }
      emit('info', 'schedule', `alloc ${a.ID.slice(0, 8)} is ${a.ClientStatus}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Nomad batch job did not terminate within 10 minutes');
}

async function tailNomadLogs({ http, allocId, emit, log }) {
  if (!allocId) return;
  // Best-effort: grab final stderr + stdout from the client FS API.
  for (const t of ['stdout', 'stderr']) {
    try {
      const res = await http.get(`/v1/client/fs/logs/${allocId}`, {
        params: { task: 'stage', type: t, origin: 'start', plain: true },
        responseType: 'text',
        timeout: 30_000,
      });
      if (typeof res.data === 'string' && res.data.length > 0) {
        // Split into reasonable chunks so XADD doesn't choke on giant lines.
        const lines = res.data.split('\n');
        for (const line of lines) {
          if (line) emit('info', 'log', line.slice(0, 2000), { stream: t });
        }
      }
    } catch (err) {
      log.warn?.(`tailNomadLogs(${t}) for ${allocId} failed: ${err.message}`);
    }
  }
}

// ─── utilities ─────────────────────────────────────────────────────────

async function dirSizeBytes(dir) {
  let total = 0;
  async function walk(p) {
    let entries = [];
    try { entries = await fs.readdir(p, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const child = path.join(p, e.name);
      if (e.isDirectory()) await walk(child);
      else {
        try {
          const st = await fs.stat(child);
          total += st.size;
        } catch {}
      }
    }
  }
  await walk(dir);
  return total;
}

async function firstExisting(paths) {
  for (const p of paths) {
    try { await fs.access(p); return p; } catch {}
  }
  return null;
}

module.exports = { build };
