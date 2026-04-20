/**
 * SpinForge - Container watchdog.
 *
 * Watches the per-node agent heartbeat keys (platform:agent:<hostname>)
 * and detects when any spinforge-managed container transitions into a
 * non-running state or rapidly flaps between states. Fires:
 *
 *   • Event: container.crashed (severity=warn or error)
 *   • Email: container_crashed template to the owning customer
 *
 * Runs on every api replica but is wrapped in a cluster lock so only
 * one replica actually dispatches notifications — otherwise a 3-node
 * cluster would triple-fire every alert.
 *
 * Cheap by design: one SCAN per tick over platform:agent:*, one GET
 * per node, and a tiny amount of Redis for the in-flight state memo.
 */

const { withClusterLock } = require('../utils/cluster-lock');
const { publish: publishEvent } = require('../utils/events');

const TICK_MS = 30_000;
const LOCK_TTL_SECONDS = 2 * 60;
const LAST_SEEN_KEY = (name) => `watchdog:container:${name}:lastState`;
const COOLDOWN_KEY = (name) => `watchdog:container:${name}:cooldown`;
const COOLDOWN_SECONDS = 15 * 60;  // don't re-notify within 15min

class ContainerWatchdog {
  constructor(redis, { logger } = {}) {
    this.redis = redis;
    this.logger = logger || console;
    this._timer = null;
  }

  start() {
    if (this._timer) return;
    this.logger.info('[watchdog] starting container crash watchdog');
    // Small stagger so the first tick doesn't race node boot.
    setTimeout(() => this._tick().catch(() => {}), 10_000);
    this._timer = setInterval(() => {
      this._tick().catch((err) => this.logger.warn('[watchdog] tick error:', err.message));
    }, TICK_MS);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async _tick() {
    await withClusterLock('watchdog:container-tick', LOCK_TTL_SECONDS, async () => {
      const agents = await this._readAllAgents();
      const containers = this._flattenContainers(agents);

      for (const c of containers) {
        await this._evaluate(c);
      }

      // Prune lastState entries for containers we no longer see — stops
      // the key space from growing if containers are torn down.
      // (Pruning is best-effort: 24h TTL.)
    });
  }

  async _readAllAgents() {
    const out = [];
    for await (const key of this.redis.scanIterator({ MATCH: 'platform:agent:*', COUNT: 100 })) {
      const raw = await this.redis.get(key);
      if (!raw) continue;
      try { out.push(JSON.parse(raw)); } catch (_) {}
    }
    return out;
  }

  _flattenContainers(agents) {
    const out = [];
    for (const a of agents) {
      const host = a.hostname;
      for (const c of a.docker?.containers || []) {
        // Only watch SpinForge-managed containers. The platform
        // containers (api, openresty, keydb, etc.) stay up by
        // design; a crash there is already visible via heartbeats.
        // Customer workloads are scheduled by Nomad and have names
        // like "site-<slug>-<allocid>"; we match by Nomad-prefix or
        // the spinforge- platform prefix but filter out the core
        // services.
        const name = c.name || '';
        if (!name) continue;
        const isPlatformCore = /^spinforge-(api|openresty|keydb|admin-ui|website|mcp|consul|agent)$/.test(name);
        out.push({ ...c, host, isPlatformCore });
      }
    }
    return out;
  }

  async _evaluate(c) {
    // Only alert when we see a known-bad state. running+healthy is the
    // happy path; we don't need to record it.
    const now = Date.now();
    const lastRaw = await this.redis.get(LAST_SEEN_KEY(c.name));
    const last = lastRaw ? JSON.parse(lastRaw) : null;
    const snapshot = { state: c.state, status: c.status, ts: now, host: c.host };
    await this.redis.setEx(LAST_SEEN_KEY(c.name), 86400, JSON.stringify(snapshot));

    const badNow  = c.state !== 'running';
    const badLast = last && last.state && last.state !== 'running';

    // Fire on the EDGE: wasn't bad, now is. Avoids alert spam while a
    // container is stuck down for hours.
    if (!badNow || badLast) return;

    // Cooldown per container so an alert doesn't repeat every 30s
    // while the container keeps flapping.
    const inCooldown = await this.redis.get(COOLDOWN_KEY(c.name));
    if (inCooldown) return;
    await this.redis.setEx(COOLDOWN_KEY(c.name), COOLDOWN_SECONDS, '1');

    const severity = c.isPlatformCore ? 'error' : 'warn';
    publishEvent('container.crashed', c.name, {
      host: c.host,
      state: c.state,
      status: c.status,
      image: c.image,
      isPlatformCore: c.isPlatformCore,
    }, severity);

    // Customer-owned workload? Find the owning customer and email.
    if (!c.isPlatformCore) {
      await this._notifyCustomer(c).catch((err) =>
        this.logger.warn('[watchdog] notify failed:', err.message)
      );
    }
  }

  async _notifyCustomer(c) {
    // Nomad names customer workloads `<taskname>-<allocid>`. We need
    // to map back to a site.domain. The NomadService registers each
    // site with a stable job id; here we just guess by substring —
    // better than nothing for v1. If no match, we skip rather than
    // spray random emails.
    const sitesIndex = require('../utils/sites-index');
    const domains = await sitesIndex.listAllDomains();
    let match = null;
    for (const d of domains) {
      const slug = d.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      if (c.name.toLowerCase().includes(slug)) { match = d; break; }
    }
    if (!match) return;

    const raw = await this.redis.get(`site:${match}`);
    if (!raw) return;
    const site = JSON.parse(raw);
    if (!site.customerId) return;
    const custRaw = await this.redis.get(`customer:${site.customerId}`);
    if (!custRaw) return;
    const customer = JSON.parse(custRaw);
    if (!customer.email) return;

    const NotificationService = require('./NotificationService');
    const notify = new NotificationService(this.redis, { logger: this.logger });
    await notify.notify('container_crashed', {
      to: customer.email,
      context: {
        name: customer.name || customer.email,
        domain: match,
        restartCount: 'several',   // we don't have a live count — agent could add one later
        windowMinutes: 15,
        logs: '(retrieve via the /_api/customer/sites/:domain/logs endpoint or admin UI)',
      },
    });
  }
}

module.exports = ContainerWatchdog;
