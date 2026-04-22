/**
 * RunnerRegistry — read-only view over runner heartbeats in KeyDB.
 *
 * Runners (Mac bare-metal, LXC-hosted, anything else that isn't spawned
 * per-job by Nomad) publish their state to `platform:runner:<kind>:<id>`
 * with a short TTL. This service scans those keys for dispatch selection.
 *
 * Mac runner heartbeat shape (see building/runners/macos/agent.js):
 *   {
 *     runnerId, hostname, tailscaleIp, updatedAt,
 *     status: "idle" | "busy",
 *     slots, activeJobs, currentJobIds: [...],
 *     capabilities: ["ios", "macos"],
 *     xcodeVersions: ["15.3", ...],
 *     macosVersion: "14.4"
 *   }
 *
 * Key convention (shared with NodeHeartbeat-style services):
 *   platform:runner:mac:<hostname>     TTL 90s, refreshed every 30s
 */

const KEY_PREFIX = 'platform:runner:';

class RunnerRegistry {
  constructor(redis, { logger } = {}) {
    this.redis = redis;
    this.logger = logger || console;
  }

  /**
   * List active runners of a given kind. Expired heartbeats are dropped
   * automatically by KeyDB TTL, so whatever this returns is live.
   */
  async list(kind) {
    const pattern = `${KEY_PREFIX}${kind}:*`;
    const out = [];
    // KEYS is fine at small scale; switch to SCAN if the fleet grows large.
    const keys = await this.redis.keys(pattern);
    for (const k of keys) {
      try {
        const raw = await this.redis.get(k);
        if (raw) out.push({ key: k, ...JSON.parse(raw) });
      } catch (err) {
        this.logger.error(`[runner-registry] parse ${k}: ${err.message}`);
      }
    }
    return out;
  }

  /**
   * Pick a runner for a job. Strategy: prefer idle, then least-loaded,
   * with a capability filter. Returns null if nothing matches.
   */
  async pick(kind, { require: required = [], exclude = new Set() } = {}) {
    const all = await this.list(kind);
    const candidates = all.filter((r) => {
      if (exclude.has(r.runnerId)) return false;
      if (!r.slots || r.activeJobs >= r.slots) return false;
      for (const cap of required) {
        if (!(r.capabilities || []).includes(cap)) return false;
      }
      return true;
    });
    if (!candidates.length) return null;

    candidates.sort((a, b) => {
      const aFree = (a.slots || 1) - (a.activeJobs || 0);
      const bFree = (b.slots || 1) - (b.activeJobs || 0);
      if (aFree !== bFree) return bFree - aFree;
      // Tiebreak by recency of heartbeat (prefer fresher runner).
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
    return candidates[0];
  }

  commandChannel(kind, runnerId) {
    return `runner:${kind}:${runnerId}:commands`;
  }

  async sendCommand(kind, runnerId, command) {
    const channel = this.commandChannel(kind, runnerId);
    const payload = JSON.stringify({
      id: command.id || randomId(),
      ts: new Date().toISOString(),
      ...command,
    });
    const n = await this.redis.publish(channel, payload);
    return { channel, delivered: n };
  }
}

function randomId() {
  return `cmd_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

module.exports = RunnerRegistry;
module.exports.KEY_PREFIX = KEY_PREFIX;
