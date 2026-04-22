/**
 * SpinBuild Mac runner — long-lived agent for bare-metal iOS/macOS builds.
 *
 * Lifecycle:
 *   boot → register heartbeat → subscribe to command channel → idle loop
 *
 * Each `build` command received on the channel spawns a per-job worker
 * (promise) that:
 *   1. Fetches workspace zip from building-api over Tailscale.
 *   2. Unzips to a scratch dir.
 *   3. Transitions the job to running.
 *   4. Runs xcodebuild (or manifest.buildCommand).
 *   5. Uploads artifacts back to building-api.
 *   6. Transitions terminal state.
 *
 * Concurrency: up to config.slots concurrent jobs. A running runner with
 * activeJobs < slots keeps accepting builds; when full, it publishes
 * `busy` in its heartbeat so the dispatcher skips it.
 *
 * Signing: stubbed for M3. M5 wires Vault checkout + fastlane here.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const redisLib = require('redis');

const { loadConfig } = require('./lib/config');
const { fetchWorkspace, uploadArtifacts } = require('./lib/api-client');
const { makeState } = require('./lib/state');
const {
  runBuild, collectXcodeArtifacts,
} = require('./lib/build-executor');
const { setupIosSigning } = require('./lib/signing');
const { runLane } = require('./lib/fastlane-runner');

const FASTLANE_TEMPLATE_DIR = process.env.SPINFORGE_FASTLANE_DIR
  || path.join(__dirname, '..', '..', 'fastlane');

const cfg = loadConfig();

const HEARTBEAT_KEY = `platform:runner:mac:${cfg.runnerId}`;
const COMMAND_CHANNEL = `runner:mac:${cfg.runnerId}:commands`;

// Activity tracking
const active = new Map(); // jobId → AbortController
let shuttingDown = false;

let writer, reader;

async function main() {
  writer = redisLib.createClient({ url: cfg.redisUrl, password: cfg.redisPassword || undefined });
  reader = writer.duplicate();
  writer.on('error', (e) => logErr('writer:', e.message));
  reader.on('error', (e) => logErr('reader:', e.message));
  await Promise.all([writer.connect(), reader.connect()]);
  log(`connected — runnerId=${cfg.runnerId} slots=${cfg.slots} caps=${cfg.capabilities.join(',')}`);

  await fsp.mkdir(cfg.scratchDir, { recursive: true });

  await heartbeat();
  setInterval(() => {
    heartbeat().catch((err) => logErr('heartbeat:', err.message));
  }, cfg.heartbeatIntervalMs);

  await reader.subscribe(COMMAND_CHANNEL, handleCommand);
  log(`subscribed to ${COMMAND_CHANNEL}`);

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ─── Heartbeat ────────────────────────────────────────────────────────

async function heartbeat() {
  if (shuttingDown) return;
  const state = {
    runnerId: cfg.runnerId,
    hostname: os.hostname(),
    tailscaleIp: cfg.tailscaleIp,
    updatedAt: new Date().toISOString(),
    status: active.size >= cfg.slots ? 'busy' : 'idle',
    slots: cfg.slots,
    activeJobs: active.size,
    currentJobIds: [...active.keys()],
    capabilities: cfg.capabilities,
    xcodeVersions: await detectXcodeVersions(),
    macosVersion: await detectMacosVersion(),
    nodeVersion: process.version,
  };
  await writer.set(HEARTBEAT_KEY, JSON.stringify(state), { EX: cfg.heartbeatTtlSec });
}

async function detectXcodeVersions() {
  try {
    const out = await runCapture('xcodebuild', ['-version']);
    const m = out.match(/Xcode\s+([\d.]+)/);
    return m ? [m[1]] : [];
  } catch (_) { return []; }
}

async function detectMacosVersion() {
  try {
    return (await runCapture('sw_vers', ['-productVersion'])).trim();
  } catch (_) { return null; }
}

function runCapture(cmd, args) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    c.stdout.on('data', (d) => { out += d.toString(); });
    c.on('error', reject);
    c.on('close', (code) => code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}`)));
  });
}

// ─── Command handling ────────────────────────────────────────────────

async function handleCommand(raw) {
  let msg;
  try { msg = JSON.parse(raw); }
  catch { return logErr('bad JSON on command channel'); }

  switch (msg.op) {
    case 'build':
      if (!msg.jobId) return logErr('build command missing jobId');
      if (active.size >= cfg.slots) {
        return logErr(`rejected job=${msg.jobId}: at capacity (${active.size}/${cfg.slots})`);
      }
      startJob(msg);
      break;
    case 'cancel':
      cancelJob(msg.jobId);
      break;
    case 'ping':
      log(`ping from dispatcher`);
      break;
    default:
      logErr(`unknown op: ${msg.op}`);
  }
}

function cancelJob(jobId) {
  const ctrl = active.get(jobId);
  if (ctrl) {
    log(`cancel requested for ${jobId}`);
    ctrl.abort();
  }
}

function startJob(cmd) {
  const jobId = cmd.jobId;
  const ctrl = new AbortController();
  active.set(jobId, ctrl);
  // Refresh heartbeat immediately so dispatcher's view updates within seconds.
  heartbeat().catch(() => {});

  runJob(cmd, ctrl.signal)
    .catch((err) => logErr(`job ${jobId} failed:`, err.message))
    .finally(() => {
      active.delete(jobId);
      heartbeat().catch(() => {});
    });
}

// ─── Job worker ──────────────────────────────────────────────────────

async function runJob(cmd, signal) {
  const jobId = cmd.jobId;
  const state = makeState(writer, jobId, {
    customerId: cmd.customerId,
    platform: cmd.platform,
    runnerId: cfg.runnerId,
  });

  const scratch = path.join(cfg.scratchDir, jobId);
  let job;
  let signingTeardown = null;
  let signingEnv = {};

  try {
    job = await state.get();
    if (!job) throw new Error('job record not found in keydb');

    await state.transition('assigned', { runnerId: cfg.runnerId });
    await state.appendEvent('runner.claim', {
      runnerId: cfg.runnerId,
      hostname: os.hostname(),
      tailscaleIp: cfg.tailscaleIp,
    });

    // Clean previous attempt, if any.
    await fsp.rm(scratch, { recursive: true, force: true });
    await fsp.mkdir(scratch, { recursive: true });

    // 1) Fetch workspace
    const workspaceZip = path.join(scratch, 'workspace.zip');
    await step(state, 'fetch_workspace', async () => {
      const { bytes } = await fetchWorkspace(cfg.apiUrl, jobId, workspaceZip);
      await state.appendEvent('workspace.fetched', { bytes });
    });

    // 2) Unzip
    const srcDir = path.join(scratch, 'src');
    await fsp.mkdir(srcDir, { recursive: true });
    await step(state, 'unzip', () => spawnInto(['unzip', '-q', workspaceZip, '-d', srcDir], { signal }));

    // 3) Signing. If a vault block was attached to the command AND the
    //    job references a signing profile, check out the material into
    //    an ephemeral keychain + install the profile. Teardown runs in
    //    the outer finally so we always clean up even on build failure.
    if (job.signingProfileId && cmd.vault && cmd.vault.token) {
      await step(state, 'signing_setup', async () => {
        const signing = await setupIosSigning({
          vault: cmd.vault,
          scratchDir: scratch,
          state,
          platform: cmd.platform,
        });
        signingEnv = signing.envForBuild;
        signingTeardown = signing.teardown;
      });
    } else if (job.signingProfileId) {
      await state.appendEvent('signing.deferred', {
        reason: 'no_vault_token',
        signingProfileId: job.signingProfileId,
      });
    }

    // 4) Build. Two paths:
    //    a) Signed build (signingProfileId + vault token) → fastlane lane
    //       that uses the runner-prepared keychain to produce a signed .ipa.
    //    b) Unsigned → raw xcodebuild archive via build-executor.
    await state.transition('running');
    if (signingEnv.SPINFORGE_KEYCHAIN_PATH) {
      await stageFastlaneIntoWorkspace(srcDir);
      await step(state, 'build', () =>
        runLane({
          platform: cmd.platform === 'ios' ? 'ios' : 'mac',
          lane: 'archive',
          cwd: srcDir,
          env: {
            ...(job.manifest?.env || {}),
            ...signingEnv,
            XCODE_SCHEME: job.manifest?.xcodeScheme || job.manifest?.scheme || '',
            ARTIFACT_DIR: path.join(srcDir, 'build'),
            EXPORT_METHOD: job.manifest?.exportMethod || 'app-store',
          },
          state,
          signal,
        })
      );
    } else {
      await step(state, 'build', () =>
        runBuild({
          platform: cmd.platform,
          manifest: job.manifest || {},
          scratchDir: srcDir,
          state,
          env: { ...(job.manifest?.env || {}), ...signingEnv },
          signal,
        })
      );
    }

    // 5) Collect artifacts
    const buildDir = path.join(srcDir, job.manifest?.outputDir || 'build');
    const artifacts = await collectXcodeArtifacts(buildDir);
    if (!artifacts.length) {
      throw new Error(`no .xcarchive/.ipa/.app found in ${buildDir}`);
    }
    await state.appendEvent('artifacts.collected', {
      count: artifacts.length,
      files: artifacts.map((a) => a.name),
    });

    // 6) Upload artifacts to building-api (which writes to Ceph).
    await step(state, 'upload_artifacts', async () => {
      const result = await uploadArtifacts(cfg.apiUrl, jobId, artifacts, {
        kind: cmd.platform,
      });
      await state.appendEvent('artifacts.uploaded', {
        count: (result.artifacts || []).length,
      });
    });

    // 7) Optional publishing. When manifest.publishTargets is set and
    //    we had signing set up, run the matching fastlane lane against
    //    the freshly-built .ipa. Failures here don't retract the build
    //    — the artifact is still valid, the upload just didn't happen.
    const targets = normalizePublishTargets(job.manifest?.publishTargets);
    if (targets.length) {
      if (!signingEnv.APP_STORE_CONNECT_API_KEY_PATH) {
        await state.appendEvent('publish.skipped', {
          reason: 'no_app_store_connect_api_key',
          targets,
        });
      } else {
        const ipa = artifacts.find((a) => a.name.endsWith('.ipa'));
        if (!ipa) {
          await state.appendEvent('publish.skipped', {
            reason: 'no_ipa_artifact',
            targets,
          });
        } else {
          for (const t of targets) {
            const lane = publishLaneFor(cmd.platform, t);
            if (!lane) {
              await state.appendEvent('publish.unknown_target', { target: t });
              continue;
            }
            await step(state, `publish.${t}`, () =>
              runLane({
                platform: cmd.platform === 'ios' ? 'ios' : 'mac',
                lane,
                cwd: srcDir,
                env: {
                  ...signingEnv,
                  ARTIFACT_IPA_PATH: ipa.path,
                },
                state,
                signal,
              })
            );
          }
        }
      }
    }

    await state.transition('succeeded');
    await state.publishGlobal('job.succeeded', 'info');
  } catch (err) {
    const isAbort = err.name === 'AbortError' || signal?.aborted;
    await state.appendEvent('runner.error', { message: err.message, aborted: !!isAbort });
    await state.transition(isAbort ? 'canceled' : 'failed', {
      reason: err.message,
    }).catch(() => {});
    await state.publishGlobal(
      isAbort ? 'job.canceled' : 'job.failed',
      isAbort ? 'warn' : 'error',
      { reason: err.message }
    );
    throw err;
  } finally {
    if (signingTeardown) {
      try { await signingTeardown(); } catch (err) {
        logErr(`signing teardown failed for ${jobId}: ${err.message}`);
      }
    }
    try { await fsp.rm(scratch, { recursive: true, force: true }); } catch (_) {}
  }
}

async function step(state, name, fn) {
  await state.appendEvent(`step.${name}.started`);
  const t0 = Date.now();
  try {
    await fn();
    await state.appendEvent(`step.${name}.ok`, { durationMs: Date.now() - t0 });
  } catch (err) {
    await state.appendEvent(`step.${name}.failed`, { durationMs: Date.now() - t0, message: err.message });
    throw err;
  }
}

async function stageFastlaneIntoWorkspace(srcDir) {
  // Drop our shared Fastfile into the workspace unless the customer's
  // repo already ships a fastlane/ dir. Their config wins.
  const target = path.join(srcDir, 'fastlane');
  const targetFastfile = path.join(target, 'Fastfile');
  try {
    await fsp.access(targetFastfile);
    return; // customer supplied their own Fastfile
  } catch (_) { /* not present, stage ours */ }
  await fsp.mkdir(target, { recursive: true });
  const src = path.join(FASTLANE_TEMPLATE_DIR, 'Fastfile');
  await fsp.copyFile(src, targetFastfile);
}

function normalizePublishTargets(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String);
  if (typeof input === 'string') return input.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function publishLaneFor(platform, target) {
  if (platform !== 'ios') return null;
  switch (target) {
    case 'testflight': return 'testflight_upload';
    case 'app_store': return 'app_store_upload';
    default: return null;
  }
}

function spawnInto(argv, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = argv;
    const child = spawn(cmd, args, { stdio: 'inherit' });
    const onAbort = () => { try { child.kill('SIGTERM'); } catch (_) {} };
    if (signal) signal.addEventListener('abort', onAbort);
    child.on('error', reject);
    child.on('close', (code) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

// ─── Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`${signal} received — waiting for active jobs to settle (${active.size})`);

  // Soft-wait up to 30s for active jobs to finish. Then exit and let
  // launchd restart us; active jobs survive as-is (the runner dies, the
  // state machine eventually transitions via watchdog or retry).
  const start = Date.now();
  while (active.size > 0 && Date.now() - start < 30_000) {
    await sleep(500);
  }

  try { await writer.del(HEARTBEAT_KEY); } catch (_) {}
  try { await reader.quit(); } catch (_) {}
  try { await writer.quit(); } catch (_) {}
  process.exit(0);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function log(...args) { console.log(`[mac-runner ${cfg.runnerId}]`, ...args); }
function logErr(...args) { console.error(`[mac-runner ${cfg.runnerId}]`, ...args); }

main().catch((err) => { logErr('fatal:', err); process.exit(1); });
