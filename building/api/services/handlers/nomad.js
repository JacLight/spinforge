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

const POLL_INTERVAL_MS = 2000;
const LOG_TAIL_CHUNK = 64 * 1024;

function build({ logger } = {}) {
  const log = logger || console;
  const http = axios.create({
    baseURL: DEFAULT_NOMAD_ADDR,
    timeout: 30_000,
    validateStatus: (s) => s < 500,
  });
  const handlers = new Map();

  handlers.set('build.static', staticHandler({ http, log }));
  handlers.set('build.node', nodeHandler({ http, log }));

  return handlers;
}

// ─── build.static ──────────────────────────────────────────────────────
// Reuses the linux builder image. Unzips the workspace zip under the
// stage's workspace, runs BUILD_COMMAND, copies OUTPUT_DIR into the
// artifact dir. Outputs { artifactPath, bytes }.

function staticHandler({ http, log }) {
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
        WORKSPACE_PATH: workspacePath,
        ARTIFACTS_DIR: artifactDir,
        ...(inputs.env || {}),
      },
    });

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

function nodeHandler({ http, log }) {
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

function buildNomadSpec({ buildId, stageId, image, env }) {
  const id = `stage-${buildId}-${stageId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  return {
    ID: id,
    Name: id,
    Type: 'batch',
    Datacenters: [DEFAULT_DATACENTER],
    TaskGroups: [{
      Name: 'stage',
      Count: 1,
      RestartPolicy: { Attempts: 0, Mode: 'fail' },
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
        Config: { image },
        VolumeMounts: [{ Volume: 'spinforge-data', Destination: '/data', ReadOnly: false }],
        Env: env,
        Resources: { CPU: 2000, MemoryMB: 2048 },
        KillTimeout: 30_000_000_000,
      }],
    }],
    Meta: { spinbuild_build_id: buildId, spinbuild_stage_id: stageId },
  };
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
  const maxWaitMs = 10 * 60 * 1000; // 10 min
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
