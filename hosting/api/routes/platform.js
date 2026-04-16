/**
 * SpinForge - Platform read API.
 *
 * Snapshot endpoints the UI fetches on load. After this first read,
 * it swaps to the WebSocket at /_admin/platform/subscribe for live
 * updates. No polling from the client; these REST calls exist to
 * seed the UI, not to be called on a timer.
 *
 * All routes are admin-gated by the parent /_admin mount in
 * server-openresty.js + the per-request authenticateAdmin middleware.
 */

const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis');
const NodeHeartbeat = require('../services/NodeHeartbeat');
const EventStream = require('../services/EventStream');
const sitesIndex = require('../utils/sites-index');

const events = new EventStream(redisClient);

/**
 * GET /_admin/platform/nodes
 *
 * Every currently-registered node with its last-known state. Any
 * node whose heartbeat TTL expired is absent — the client can treat
 * absence as "gone" without additional signals.
 */
router.get('/nodes', async (req, res) => {
  try {
    const keys = [];
    for await (const key of redisClient.scanIterator({
      MATCH: NodeHeartbeat.KEY_PREFIX + '*',
      COUNT: 100,
    })) {
      keys.push(key);
    }
    const nodes = [];
    for (const key of keys) {
      const raw = await redisClient.get(key);
      if (!raw) continue;
      try { nodes.push(JSON.parse(raw)); } catch (_) {}
    }
    nodes.sort((a, b) => (a.hostname || '').localeCompare(b.hostname || ''));
    res.json({
      nodes,
      heartbeatTtlSec: NodeHeartbeat.TTL_SECONDS,
      heartbeatIntervalMs: NodeHeartbeat.INTERVAL_MS,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /_admin/platform/events?limit=200
 *
 * Recent entries from the platform:events stream, newest first.
 * The UI keeps this as its scrollback buffer and appends new
 * events arriving over the WebSocket.
 */
router.get('/events', async (req, res) => {
  try {
    const limit = Math.min(1000, parseInt(req.query.limit, 10) || 200);
    const rows = await events.recent(limit);
    res.json({ events: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /_admin/platform/workloads
 *
 * Every customer site in the cluster, enriched with its owning
 * customer and (for container/node types) the Nomad allocation
 * status. Heavy on one call — fine for load, re-read every 30s is
 * overkill so the UI should subscribe to events for deltas.
 */
router.get('/workloads', async (req, res) => {
  try {
    const domains = await sitesIndex.listAllDomains();
    const out = [];
    for (const domain of domains) {
      const raw = await redisClient.get(`site:${domain}`);
      if (!raw) continue;
      let site;
      try { site = JSON.parse(raw); } catch { continue; }
      out.push({
        domain: site.domain,
        type: site.type,
        customerId: site.customerId,
        enabled: site.enabled !== false,
        sslEnabled: site.ssl_enabled === true,
        orchestrator: site.orchestrator || null,
        nomadJobId: site.nomadJobId || null,
        updatedAt: site.updatedAt,
      });
    }
    // Group: container workloads first (they're where operational
    // attention usually goes), then proxy/static/lb.
    out.sort((a, b) => {
      const rank = (s) => s === 'container' || s === 'node' ? 0 : 1;
      return rank(a.type) - rank(b.type) || a.domain.localeCompare(b.domain);
    });
    res.json({ workloads: out, total: out.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
