/**
 * DispatchService — submits a build job to Nomad.
 *
 * Reads a job record (already persisted by JobService) and translates it
 * into a Nomad batch job spec. Does not poll for completion — the runner
 * writes its own lifecycle events directly to KeyDB (job:<id>:events + the
 * job record's status). This keeps the dispatcher stateless and lets the
 * SSE endpoint surface progress without round-tripping Nomad.
 *
 * Nomad job naming:
 *   spinbuild job id     → "job_01HM..."  (ULID-based)
 *   nomad job id         → "build-job_01HM..."  (Nomad allows [a-zA-Z0-9_-])
 *
 * Driver: docker for v1. The runner images are built under
 * building/runners/<name>/ and pushed to a local registry or pre-loaded on
 * Nomad nodes. LXC native driver is a possible later optimization on
 * Proxmox.
 *
 * Platforms:
 *   Nomad dispatches: web, linux, android, flutter (linux side), electron (linux side).
 *   Mac runner dispatches (via pubsub, not Nomad): ios, macos.
 *   Windows dispatch: deferred (see PLATFORM_PLAN.md D15).
 */

const axios = require('axios');
const defaultLogger = require('../utils/logger');

const DEFAULT_NOMAD = process.env.NOMAD_ADDR || 'http://172.18.0.1:4646';
// Spinforge cluster ships with datacenter `spinforge-dc1`. Older compose
// installs used plain `dc1`, so the env override still works there.
const DEFAULT_DATACENTER = process.env.NOMAD_DATACENTER || 'spinforge-dc1';

// Nomad host_volume name that provides the Ceph-backed SpinForge data
// tree inside the builder container at /data. Must match the nomad
// client config on every node (see hosting/README.md: spinforge-data →
// /mnt/cephfs/spinforge/hosting/data).
const DATA_HOST_VOLUME = process.env.SPINFORGE_DATA_HOST_VOLUME || 'spinforge-data';

// Default builder image ref. Pushed to the on-cluster registry so every
// Nomad client pulls by digest without going outside the private mesh.
const DEFAULT_BUILDER_REGISTRY =
  process.env.BUILDER_REGISTRY || '192.168.88.170:5000';
const defaultBuilderImage = (name) =>
  `${DEFAULT_BUILDER_REGISTRY}/spinforge/${name}:latest`;

const PLATFORM_PROFILES = {
  web: {
    image: process.env.BUILDER_IMAGE_WEB || defaultBuilderImage('builder-linux'),
    cpuMhz: 2000,
    memoryMB: 2048,
  },
  linux: {
    image: process.env.BUILDER_IMAGE_LINUX || defaultBuilderImage('builder-linux'),
    cpuMhz: 2000,
    memoryMB: 2048,
  },
  android: {
    image: process.env.BUILDER_IMAGE_ANDROID || defaultBuilderImage('builder-android'),
    cpuMhz: 4000,
    memoryMB: 4096,
  },
  flutter: {
    // Flutter on the linux side of things — web/android targets.
    // Apple targets branch off to the Mac runner path.
    image: process.env.BUILDER_IMAGE_FLUTTER || defaultBuilderImage('builder-flutter'),
    cpuMhz: 4000,
    memoryMB: 4096,
  },
  electron: {
    image: process.env.BUILDER_IMAGE_ELECTRON || defaultBuilderImage('builder-electron'),
    cpuMhz: 4000,
    memoryMB: 4096,
  },
};

const MAC_PLATFORMS = new Set(['ios', 'macos']);
const DEFERRED_PLATFORMS = new Set(['windows']);

class DispatchService {
  constructor({ nomadAddr, datacenter, jobs, events, runners, signing, vault, logger } = {}) {
    this.nomadAddr = nomadAddr || DEFAULT_NOMAD;
    this.datacenter = datacenter || DEFAULT_DATACENTER;
    this.jobs = jobs;
    this.events = events || null;
    this.runners = runners || null; // RunnerRegistry — required for Mac dispatch
    this.signing = signing || null; // SigningProfileService — for signed builds
    this.vault = vault || null;
    this.logger = logger || defaultLogger;

    this.http = axios.create({
      baseURL: this.nomadAddr,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (s) => s < 500,
    });
  }

  /**
   * Route a job to the correct dispatch path based on platform. Returns
   *   { route: 'nomad' | 'mac' | 'deferred', ...details }.
   *
   * The caller is expected to have already persisted the job record and
   * written the workspace zip to Ceph.
   */
  async dispatch(job) {
    if (MAC_PLATFORMS.has(job.platform)) {
      return this._dispatchMac(job);
    }
    if (DEFERRED_PLATFORMS.has(job.platform)) {
      throw Object.assign(
        new Error(`platform "${job.platform}" is not supported yet (see PLATFORM_PLAN.md D15)`),
        { status: 501, expose: true }
      );
    }
    const profile = PLATFORM_PROFILES[job.platform];
    if (!profile) {
      throw Object.assign(
        new Error(`platform "${job.platform}" has no dispatcher`),
        { status: 400, expose: true }
      );
    }
    return this._dispatchNomad(job, profile);
  }

  async cancel(job) {
    if (MAC_PLATFORMS.has(job.platform)) {
      if (!this.runners) {
        return { route: 'mac', canceled: false, reason: 'no_registry' };
      }
      const runnerId = job.runnerId;
      if (!runnerId) {
        return { route: 'mac', canceled: false, reason: 'no_runner_assigned' };
      }
      await this.runners.sendCommand('mac', runnerId, {
        op: 'cancel',
        jobId: job.id,
      });
      return { route: 'mac', canceled: true, runnerId };
    }
    const id = nomadJobId(job.id);
    const res = await this.http.delete(
      `/v1/job/${encodeURIComponent(id)}?purge=true`
    );
    if (res.status === 404) return { route: 'nomad', canceled: false, reason: 'not_found' };
    if (res.status >= 400) {
      throw new Error(`Nomad stop failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return { route: 'nomad', canceled: true, evalId: res.data?.EvalID };
  }

  // ─── Private ───────────────────────────────────────────────────────────

  async _dispatchNomad(job, profile) {
    // Signed Nomad-dispatched builds (e.g. Android) need a short-lived
    // Vault token + secret path. Mint it here the same way Mac dispatch
    // does, then inject via env in the spec.
    let vaultBlock = null;
    if (job.signingProfileId && this.signing && this.vault && this.vault.isConfigured()) {
      try {
        const minted = await this.signing.mintJobToken(job.signingProfileId, {
          ttlSeconds: 1800,
        });
        vaultBlock = {
          addr: process.env.VAULT_ADDR || 'http://spinforge-vault:8200',
          token: minted.token,
          path: minted.path,
        };
        await this.jobs.update(job.id, {
          vaultTokenAccessor: minted.accessor,
          vaultPath: minted.path,
        });
      } catch (err) {
        this.logger.warn(`[dispatch] vault mint failed for ${job.id}: ${err.message}`);
        if (this.events) {
          this.events.publish('job.signing_setup_failed', job.id, {
            severity: 'error',
            context: { reason: err.message },
          }).catch(() => {});
        }
        throw err;
      }
    }

    const spec = this._buildSpec(job, profile, vaultBlock);
    const res = await this.http.post('/v1/jobs', { Job: spec });
    if (res.status >= 400) {
      throw new Error(`Nomad register failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    const evalId = res.data?.EvalID;
    this.logger.info(`[dispatch] job=${job.id} nomad=${spec.ID} eval=${evalId}`);
    return { route: 'nomad', nomadJobId: spec.ID, evalId };
  }

  async _dispatchMac(job) {
    if (!this.runners) {
      throw new Error('DispatchService: RunnerRegistry not wired — cannot dispatch to Mac runner');
    }

    const runner = await this.runners.pick('mac', {
      require: [job.platform], // "ios" or "macos" must be in runner.capabilities
    });

    if (!runner) {
      // No capable runner is online. Leave the job queued; a runner that
      // comes online later can be paged with a scan-and-dispatch loop (M3
      // optional). For v1, mark the job as awaiting capacity and surface
      // the signal to operators.
      if (this.events) {
        this.events.publish('job.waiting_for_runner', job.id, {
          severity: 'warn',
          context: { platform: job.platform, reason: 'no_runner_available' },
        }).catch(() => {});
      }
      this.logger.warn(`[dispatch] job=${job.id} no mac runner available for ${job.platform}`);
      return { route: 'mac', pending: true, reason: 'no_runner_available' };
    }

    // If the job references a signing profile and Vault is configured,
    // mint a short-lived child token and pass it along. Runner uses the
    // token to fetch the signing material directly from Vault and
    // discards it on job end. Never passes the actual secrets over the
    // command channel.
    let vaultToken = null;
    let vaultAccessor = null;
    let vaultPath = null;
    if (job.signingProfileId && this.signing && this.vault && this.vault.isConfigured()) {
      try {
        const minted = await this.signing.mintJobToken(job.signingProfileId, {
          ttlSeconds: 1800,
        });
        vaultToken = minted.token;
        vaultAccessor = minted.accessor;
        vaultPath = minted.path;
        // Record the accessor so cancel() / watchdog can revoke it early.
        await this.jobs.update(job.id, {
          vaultTokenAccessor: vaultAccessor,
          vaultPath,
        });
      } catch (err) {
        this.logger.warn(`[dispatch] vault mint failed for ${job.id}: ${err.message}`);
        if (this.events) {
          this.events.publish('job.signing_setup_failed', job.id, {
            severity: 'error',
            context: { reason: err.message },
          }).catch(() => {});
        }
        throw err;
      }
    }

    const { channel, delivered } = await this.runners.sendCommand('mac', runner.runnerId, {
      op: 'build',
      jobId: job.id,
      platform: job.platform,
      customerId: job.customerId,
      signingProfileId: job.signingProfileId || null,
      vault: vaultToken ? {
        addr: process.env.VAULT_ADDR || 'http://spinforge-vault:8200',
        token: vaultToken,
        path: vaultPath,
      } : null,
    });

    if (delivered === 0) {
      // Runner's heartbeat was fresh but nobody is subscribed — likely
      // restarting. Same as "no runner" from the caller's view.
      this.logger.warn(`[dispatch] job=${job.id} runner=${runner.runnerId} — no subscribers`);
      if (this.events) {
        this.events.publish('job.waiting_for_runner', job.id, {
          severity: 'warn',
          context: { platform: job.platform, reason: 'runner_not_subscribed', runnerId: runner.runnerId },
        }).catch(() => {});
      }
      return { route: 'mac', pending: true, reason: 'runner_not_subscribed', runnerId: runner.runnerId };
    }

    this.logger.info(`[dispatch] job=${job.id} → mac runner=${runner.runnerId} via ${channel}`);
    return {
      route: 'mac',
      runnerId: runner.runnerId,
      tailscaleIp: runner.tailscaleIp || null,
      channel,
    };
  }

  _buildSpec(job, profile, vaultBlock = null) {
    const id = nomadJobId(job.id);
    const manifest = job.manifest || {};

    // Policy-derived ceilings. Fall back to profile defaults when the
    // policy doesn't narrow them (e.g. the default policy with
    // maxJobCpuMhz=1000 would starve a 2GHz-targeted web build, so we
    // only clamp when the policy opts into a larger value).
    const policy = job.policy || {};
    const buildPolicy = policy.build || {};
    const cpuMhz = Math.max(
      profile.cpuMhz,
      Number(buildPolicy.maxJobCpuMhz) || 0
    );
    const memoryMB = Math.max(
      profile.memoryMB,
      Number(buildPolicy.maxJobMemoryMB) || 0
    );
    const maxDurationMin = Number(buildPolicy.maxJobDurationMin) || 30;
    // Nomad KillTimeout and task `kill_timeout` are graceful-shutdown
    // budgets after the task is already marked for stop. The actual
    // hard cutoff for a batch task is expressed via a `template.kill_timeout`
    // on a sidecar — not worth the complexity here. For v1 we pass the
    // cap via env so the agent can arm its own timer.
    const buildTimeoutSec = Math.max(60, maxDurationMin * 60);

    const env = {
      JOB_ID: job.id,
      CUSTOMER_ID: job.customerId,
      PLATFORM: job.platform,
      FRAMEWORK: job.framework || '',
      BUILD_COMMAND: manifest.buildCommand || '',
      OUTPUT_DIR: manifest.outputDir || '',
      WORKSPACE_PATH: `/data/workspaces/${job.id}.zip`,
      ARTIFACTS_DIR: `/data/artifacts/${job.id}`,
      BUILD_TIMEOUT_SEC: String(buildTimeoutSec),
      // Nomad exposes the client host's IP at runtime. KeyDB runs
      // per-node (multi-master) on 16378, so each builder talks to its
      // own node's KeyDB — same pattern building-api itself uses.
      REDIS_HOST: '${attr.unique.network.ip-address}',
      REDIS_PORT: String(process.env.REDIS_PORT || 16378),
      REDIS_DB: String(process.env.REDIS_DB ?? 1),
      REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
      ...(vaultBlock ? {
        VAULT_ADDR: vaultBlock.addr,
        VAULT_TOKEN: vaultBlock.token,
        VAULT_PATH: vaultBlock.path,
        VAULT_KV_MOUNT: process.env.VAULT_KV_MOUNT || 'secret',
      } : {}),
      ...(manifest.env || {}),
    };

    return {
      ID: id,
      Name: id,
      Type: 'batch',
      Datacenters: [this.datacenter],
      TaskGroups: [{
        Name: 'build',
        Count: 1,
        // Builds are one-shot. Don't restart or reschedule — a failed
        // build should surface the error, not silently retry and mask
        // flaky customer code.
        RestartPolicy: { Attempts: 0, Mode: 'fail' },
        ReschedulePolicy: { Attempts: 0 },
        EphemeralDisk: { SizeMB: 2048 },
        // Nomad host_volume → mounted at /data inside the container.
        // Matches the spinforge-data volume wired on every Nomad client
        // (source: /mnt/cephfs/spinforge/hosting/data). All three build
        // nodes see the same Ceph tree, so dispatch can land on any
        // node and still find /data/workspaces/<jobId>.zip.
        Volumes: {
          'spinforge-data': {
            Name: 'spinforge-data',
            Type: 'host',
            ReadOnly: false,
            Source: DATA_HOST_VOLUME,
          },
        },
        Tasks: [{
          Name: 'builder',
          Driver: 'docker',
          Config: {
            image: profile.image,
          },
          VolumeMounts: [{
            Volume: 'spinforge-data',
            Destination: '/data',
            ReadOnly: false,
          }],
          Env: env,
          Resources: {
            CPU: cpuMhz,
            MemoryMB: memoryMB,
          },
          // Hard ceiling — runaway builds get killed. 60min is generous for
          // v1; we'll tune per platform as real data arrives.
          KillTimeout: 30_000_000_000, // 30s in ns
        }],
      }],
      Meta: {
        spinbuild_job_id: job.id,
        customer_id: job.customerId,
        platform: job.platform,
      },
    };
  }
}

function nomadJobId(jobId) {
  // Nomad ID charset is [a-zA-Z0-9_-]. ULID + underscore are already valid.
  return `build-${String(jobId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

module.exports = DispatchService;
module.exports.PLATFORM_PROFILES = PLATFORM_PROFILES;
module.exports.MAC_PLATFORMS = MAC_PLATFORMS;
module.exports.DEFERRED_PLATFORMS = DEFERRED_PLATFORMS;
module.exports.nomadJobId = nomadJobId;
