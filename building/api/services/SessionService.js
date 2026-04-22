/**
 * SessionService — Vibe Studio session VM allocation.
 *
 * Reuses the Nomad dispatcher primitive for a very different workload:
 * long-lived dev-environment VMs (or containers) that session-manager
 * attaches Socket.IO to. Isolation primitive is shared (Nomad + Proxmox);
 * workload profile differs (service, not batch; KVM, not docker).
 *
 * See PLATFORM_PLAN.md §7 for the parallel-track context.
 *
 * KeyDB keys:
 *   session:<id>                    record
 *   session:by-user:<userId>        sorted set of sessionIds by createdAt
 *
 * Nomad job ids:
 *   session-<id>                    (service type, no ReschedulePolicy limits)
 */

const axios = require('axios');
const { ulid } = require('ulid');

const DEFAULT_NOMAD = process.env.NOMAD_ADDR || 'http://172.18.0.1:4646';
const DEFAULT_DATACENTER = process.env.NOMAD_DATACENTER || 'dc1';
const DATA_HOST_PATH = process.env.SPINFORGE_DATA_ROOT_HOST || '/data';

// Templates: named VM profiles session-manager can request. Each template
// maps to an image + resources + driver. Drivers:
//   docker   — dev-mode fallback, container on any Nomad node
//   qemu     — production, full KVM VM on a Proxmox-hosting Nomad client
// The template name flows in as-is from session-manager's POST body.
const SESSION_PROFILES = {
  'flutter-dev': {
    driver: process.env.SESSION_DRIVER || 'docker',
    image: process.env.SESSION_IMAGE_FLUTTER || 'spinforge/session-flutter:latest',
    cpuMhz: 2000,
    memoryMB: 4096,
    diskMB: 20 * 1024,
  },
  'node-dev': {
    driver: process.env.SESSION_DRIVER || 'docker',
    image: process.env.SESSION_IMAGE_NODE || 'spinforge/session-node:latest',
    cpuMhz: 1500,
    memoryMB: 2048,
    diskMB: 10 * 1024,
  },
  'default': {
    driver: process.env.SESSION_DRIVER || 'docker',
    image: process.env.SESSION_IMAGE_DEFAULT || 'spinforge/session-default:latest',
    cpuMhz: 1500,
    memoryMB: 2048,
    diskMB: 10 * 1024,
  },
};

const TERMINAL = new Set(['destroyed', 'failed']);

class SessionService {
  constructor(redis, { logger, events, nomadAddr, datacenter } = {}) {
    this.redis = redis;
    this.logger = logger || console;
    this.events = events || null;
    this.nomadAddr = nomadAddr || DEFAULT_NOMAD;
    this.datacenter = datacenter || DEFAULT_DATACENTER;
    this.http = axios.create({
      baseURL: this.nomadAddr,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (s) => s < 500,
    });
  }

  async allocate({ userId, template = 'default', metadata = {} }) {
    if (!userId) throw bad('userId is required');
    const profile = SESSION_PROFILES[template] || SESSION_PROFILES.default;

    const id = `ses_${ulid()}`;
    const record = {
      id,
      userId,
      template,
      profile: { driver: profile.driver, image: profile.image },
      status: 'allocating',
      nomadJobId: sessionNomadId(id),
      tailscaleIp: null,
      port: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      destroyedAt: null,
      metadata,
    };
    await this.redis.set(`session:${id}`, JSON.stringify(record));
    await this.redis.zAdd(`session:by-user:${userId}`, { score: Date.now(), value: id });
    // Global index — powers the admin UI's "all sessions" view. Kept in
    // sync on every create; pruned on destroy.
    await this.redis.zAdd('sessions:recent', { score: Date.now(), value: id });

    const spec = this._buildSpec(record, profile);
    try {
      const res = await this.http.post('/v1/jobs', { Job: spec });
      if (res.status >= 400) {
        throw new Error(`Nomad register failed (${res.status}): ${JSON.stringify(res.data)}`);
      }
      const evalId = res.data?.EvalID;
      const next = { ...record, status: 'running', evalId, startedAt: new Date().toISOString() };
      await this.redis.set(`session:${id}`, JSON.stringify(next));
      if (this.events) {
        this.events.publish('session.created', id, {
          context: { userId, template, driver: profile.driver },
        }).catch(() => {});
      }
      return next;
    } catch (err) {
      const failed = { ...record, status: 'failed', failureReason: err.message };
      await this.redis.set(`session:${id}`, JSON.stringify(failed));
      if (this.events) {
        this.events.publish('session.failed', id, {
          severity: 'error',
          context: { reason: err.message },
        }).catch(() => {});
      }
      throw err;
    }
  }

  async get(id) {
    const raw = await this.redis.get(`session:${id}`);
    return raw ? JSON.parse(raw) : null;
  }

  async listByUser(userId, { limit = 50, offset = 0 } = {}) {
    const ids = await this.redis.zRange(
      `session:by-user:${userId}`,
      -(offset + limit),
      -(offset + 1),
      { REV: true }
    );
    const out = [];
    for (const id of ids) {
      const s = await this.get(id);
      if (s) out.push(s);
    }
    return out;
  }

  /**
   * Cluster-wide listing — every session across every user. Used by the
   * admin UI's Sessions page. Reads from sessions:recent (newest first).
   * Missing records (race) are silently skipped.
   */
  async listAll({ limit = 100, offset = 0 } = {}) {
    const ids = await this.redis.zRange('sessions:recent',
      -(offset + limit), -(offset + 1), { REV: true });
    const out = [];
    for (const id of ids) {
      const s = await this.get(id);
      if (s) out.push(s);
    }
    return out;
  }

  async destroy(id) {
    const session = await this.get(id);
    if (!session) return null;
    if (TERMINAL.has(session.status)) return session;

    const nomadId = session.nomadJobId || sessionNomadId(id);
    const res = await this.http.delete(
      `/v1/job/${encodeURIComponent(nomadId)}?purge=true`
    );
    if (res.status >= 400 && res.status !== 404) {
      this.logger.warn(`[session] destroy nomad ${nomadId} → ${res.status}`);
    }

    const next = { ...session, status: 'destroyed', destroyedAt: new Date().toISOString() };
    await this.redis.set(`session:${id}`, JSON.stringify(next));
    if (this.events) {
      this.events.publish('session.destroyed', id, {
        context: { userId: session.userId },
      }).catch(() => {});
    }
    // TODO: policy check — wired in task 122
    // Session destruction should emit a usage event (session duration,
    // cpu_seconds, mem integral). Hook goes here.
    return next;
  }

  /**
   * Update session state based on info that only the VM/container can
   * provide (Tailscale IP assignment, port advertising, etc.). Called by
   * the VM's cloud-init / startup hook once it's up. Not admin-facing.
   */
  async reportReady(id, { tailscaleIp, port, metadata = {} } = {}) {
    const session = await this.get(id);
    if (!session) return null;
    const next = {
      ...session,
      status: 'running',
      tailscaleIp: tailscaleIp || session.tailscaleIp,
      port: port || session.port,
      metadata: { ...(session.metadata || {}), ...metadata },
      readyAt: new Date().toISOString(),
    };
    await this.redis.set(`session:${id}`, JSON.stringify(next));
    if (this.events) {
      this.events.publish('session.ready', id, {
        context: { tailscaleIp: next.tailscaleIp, port: next.port },
      }).catch(() => {});
    }
    return next;
  }

  // ─── Nomad spec ───────────────────────────────────────────────────────

  _buildSpec(session, profile) {
    const id = session.nomadJobId;
    const env = {
      SPINFORGE_SESSION_ID: session.id,
      SPINFORGE_USER_ID: session.userId,
      SPINFORGE_API_URL: process.env.SPINFORGE_API_URL_INTERNAL || 'http://172.18.0.16:8090',
    };

    const task = profile.driver === 'qemu'
      ? this._qemuTask(id, session, profile, env)
      : this._dockerTask(id, session, profile, env);

    return {
      ID: id,
      Name: id,
      Type: 'service',
      Datacenters: [this.datacenter],
      TaskGroups: [{
        Name: 'session',
        Count: 1,
        // Sessions are long-lived but restartable. Let Nomad try a few
        // times on crash before declaring dead.
        RestartPolicy: { Attempts: 3, Mode: 'fail', Interval: 60_000_000_000 },
        ReschedulePolicy: { Attempts: 3, Interval: 3_600_000_000_000 },
        EphemeralDisk: { SizeMB: profile.diskMB || 10_240 },
        Tasks: [task],
      }],
      Meta: {
        spinforge_session_id: session.id,
        user_id: session.userId,
        template: session.template,
      },
    };
  }

  _dockerTask(id, session, profile, env) {
    return {
      Name: 'session',
      Driver: 'docker',
      Config: {
        image: profile.image,
        // /data shared — session has access to its user's workspace under
        // /data/sessions/<userId>/ (session-manager provisions the subdir).
        volumes: [`${DATA_HOST_PATH}:/data`],
        // Session servers typically expose ssh + a bridge port; let
        // Nomad assign dynamic host ports and surface them via env.
        ports: ['session'],
      },
      Env: env,
      Resources: {
        CPU: profile.cpuMhz,
        MemoryMB: profile.memoryMB,
      },
    };
  }

  _qemuTask(id, session, profile, env) {
    // Nomad qemu driver: runs a QEMU VM from an image on the client host.
    // Requires the image to be reachable (artifact URL, HTTP, or local
    // path on the Nomad client). Real bring-up on Proxmox may swap this
    // for a raw_exec wrapper that calls `qm clone` / `qm start` — kept
    // here as a scaffold; fill in the image path + networking once the
    // Proxmox plumbing is decided.
    return {
      Name: 'session',
      Driver: 'qemu',
      Config: {
        image_path: profile.image,
        accelerator: 'kvm',
        args: ['-nographic'],
      },
      Env: env,
      Resources: {
        CPU: profile.cpuMhz,
        MemoryMB: profile.memoryMB,
      },
    };
  }
}

function sessionNomadId(sessionId) {
  return `session-${String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function bad(message) {
  return Object.assign(new Error(message), { status: 400, expose: true });
}

module.exports = SessionService;
module.exports.SESSION_PROFILES = SESSION_PROFILES;
module.exports.sessionNomadId = sessionNomadId;
