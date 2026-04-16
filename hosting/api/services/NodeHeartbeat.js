/**
 * SpinForge - Node heartbeat + registry.
 *
 * Every api replica publishes its own state to Redis at a steady
 * cadence. The Platform UI (and anything else that wants to know
 * who's alive in the cluster) reads from this registry instead of
 * scanning docker or SSHing around.
 *
 * Shape:
 *   key:   platform:node:<hostname>           TTL 90s, refreshed every 30s
 *   value: JSON
 *     {
 *       hostname, ip, role,
 *       spinforgeVersion,    // commit sha short
 *       startedAt,           // when this api process started
 *       updatedAt,           // when this heartbeat was written
 *       nodeUptimeSec,       // OS uptime
 *       loadAvg: [1m,5m,15m],
 *       memBytes: { total, free },
 *       docker: {
 *         containers: [{name, image, status, health}]
 *       }
 *     }
 *
 * TTL 90s means any node that stops publishing for 3 missed
 * heartbeats drops off the registry automatically — the UI sees it
 * disappear without us having to write a "node died" detector.
 *
 * Also writes one event to platform:events on first boot + on
 * graceful shutdown so operators see the transitions in the event
 * timeline.
 */

const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

const KEY_PREFIX = 'platform:node:';
const TTL_SECONDS = 90;
const INTERVAL_MS = 30_000;

class NodeHeartbeat {
  constructor(redis, { logger, eventStream } = {}) {
    this.redis = redis;
    this.logger = logger || console;
    this.eventStream = eventStream || null;
    this.hostname = os.hostname();
    this.key = KEY_PREFIX + this.hostname;
    this.startedAt = new Date().toISOString();
    this.version = this._readVersion();
    this._timer = null;
    this._running = false;
  }

  async start() {
    if (this._running) return;
    this._running = true;
    // Emit immediately so the UI sees us within one round-trip of boot,
    // not after the first interval.
    await this._tick();
    this._timer = setInterval(() => {
      this._tick().catch((err) => {
        this.logger.error('[heartbeat] tick failed:', err.message);
      });
    }, INTERVAL_MS);
    if (this.eventStream) {
      this.eventStream.publish('node.up', this.hostname, { ip: this._primaryIp() }).catch(() => {});
    }
    this.logger.info(`[heartbeat] started for ${this.hostname} (TTL ${TTL_SECONDS}s, interval ${INTERVAL_MS}ms)`);
  }

  async stop() {
    if (!this._running) return;
    this._running = false;
    if (this._timer) clearInterval(this._timer);
    try {
      await this.redis.del(this.key);
    } catch (_) {}
    if (this.eventStream) {
      try { await this.eventStream.publish('node.down', this.hostname, { graceful: true }); }
      catch (_) {}
    }
    this.logger.info(`[heartbeat] stopped for ${this.hostname}`);
  }

  async _tick() {
    const state = {
      hostname: this.hostname,
      ip: this._primaryIp(),
      role: process.env.SPINFORGE_ROLE || 'node',
      spinforgeVersion: this.version,
      startedAt: this.startedAt,
      updatedAt: new Date().toISOString(),
      nodeUptimeSec: Math.round(os.uptime()),
      loadAvg: os.loadavg(),
      memBytes: {
        total: os.totalmem(),
        free: os.freemem(),
      },
      cpus: os.cpus().length,
      // Container state is a best-effort enumeration — if docker
      // CLI isn't reachable (e.g. api runs in its own container
      // without docker.sock), we skip it. No docker.sock is the
      // correct posture — Nomad schedules on the node, not docker.
      docker: await this._dockerState(),
    };
    await this.redis.set(this.key, JSON.stringify(state), { EX: TTL_SECONDS });
  }

  _primaryIp() {
    // Try env first — setup-node.sh sets NODE_IP / PUBLIC_IP
    const fromEnv = process.env.NODE_IP || process.env.PUBLIC_IP;
    if (fromEnv) return fromEnv;
    // Fall back to the first non-internal IPv4 we find
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const n of nets[name] || []) {
        if (n.family === 'IPv4' && !n.internal) return n.address;
      }
    }
    return null;
  }

  _readVersion() {
    // Two options: env-provided (set at build or by orchestrator) or
    // read from the running git tree. For container builds we set
    // SPINFORGE_COMMIT; otherwise try git.
    if (process.env.SPINFORGE_COMMIT) return process.env.SPINFORGE_COMMIT;
    try {
      const sha = execSync('git rev-parse --short HEAD', { cwd: '/app', stdio: ['ignore', 'pipe', 'ignore'] });
      return String(sha).trim();
    } catch (_) {}
    try {
      return fs.readFileSync('/app/.commit', 'utf8').trim();
    } catch (_) {}
    return 'unknown';
  }

  async _dockerState() {
    // In the default compose, api doesn't have docker.sock mounted
    // (we removed it earlier). That means this path won't work from
    // inside the api container — the spinforge-agent (task #99) is
    // the one with local docker/systemd access. Leave the hook here
    // so the agent can populate it later via a different write path.
    return null;
  }
}

module.exports = NodeHeartbeat;
module.exports.KEY_PREFIX = KEY_PREFIX;
module.exports.TTL_SECONDS = TTL_SECONDS;
module.exports.INTERVAL_MS = INTERVAL_MS;
