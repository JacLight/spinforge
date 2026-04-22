const express = require('express');
const http = require('http');
const logger = require('../utils/logger');

const router = express.Router();

const NOMAD_ADDR = process.env.NOMAD_ADDR || 'http://127.0.0.1:4646';

// Tiny HTTP wrapper — mirrors hosting/api/routes/platform.js. Avoids pulling
// in a new dep just to talk to Nomad on the same host.
function nomadGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, NOMAD_ADDR);
    const req = http.get(url, { timeout: 4000 }, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => {
        if (r.statusCode >= 200 && r.statusCode < 300) {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
          catch (e) { reject(new Error('bad json from nomad: ' + e.message)); }
        } else {
          reject(new Error(`nomad ${r.statusCode} on ${path}`));
        }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('nomad timeout')); });
    req.on('error', reject);
  });
}

// GET /api/runners?kind=mac — list live runners of a kind (default mac).
router.get('/', async (req, res, next) => {
  try {
    const kind = (req.query.kind || 'mac').toString();
    const runners = await req.app.locals.runners.list(kind);
    res.json({ kind, runners });
  } catch (err) { next(err); }
});

// GET /api/runners/all — every known kind merged into one response.
router.get('/all', async (req, res, next) => {
  try {
    const kinds = ['mac', 'lxc'];
    const out = {};
    for (const k of kinds) out[k] = await req.app.locals.runners.list(k);
    res.json({ runners: out });
  } catch (err) { next(err); }
});

// GET /api/runners/nomad — live Nomad client nodes. Reads Nomad's /v1/nodes
// + /v1/node/:id for the attribute detail the UI needs. Same shape hosting's
// /_admin/platform/nodes uses, so the Runners page can render without a
// bespoke mapper.
router.get('/nomad', async (_req, res) => {
  try {
    const stubs = await nomadGet('/v1/nodes');
    const details = await Promise.all(
      stubs.map((s) => nomadGet(`/v1/node/${s.ID}`).catch(() => null))
    );
    const nodes = details
      .filter(Boolean)
      .map((n) => ({
        hostname:     n.Name,
        nodeId:       n.ID,
        ip:           n.Attributes?.['unique.network.ip-address'] || n.HTTPAddr || null,
        datacenter:   n.Datacenter,
        nodeClass:    n.NodeClass || null,
        status:       n.Status,
        eligibility:  n.SchedulingEligibility,
        drain:        !!n.Drain,
        cpuCores:     parseInt(n.Attributes?.['cpu.numcores'] || '0', 10) || null,
        cpuMHz:       parseInt(n.Attributes?.['cpu.frequency'] || '0', 10) || null,
        memoryBytes:  parseInt(n.Attributes?.['memory.totalbytes'] || '0', 10) || null,
        kernel:       n.Attributes?.['kernel.version'] || null,
        os:           n.Attributes?.['os.name'] || null,
        dockerVersion: n.Attributes?.['driver.docker.version'] || null,
        lastHeartbeat: n.StatusUpdatedAt
          ? new Date(n.StatusUpdatedAt * 1000).toISOString() : null,
      }))
      .sort((a, b) => (a.hostname || '').localeCompare(b.hostname || ''));

    res.json({ nodes, source: 'nomad', nomadAddr: NOMAD_ADDR });
  } catch (err) {
    logger.warn(`[runners/nomad] ${err.message}`);
    res.status(500).json({ error: err.message, source: 'nomad' });
  }
});

module.exports = router;
