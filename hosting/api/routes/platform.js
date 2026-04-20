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
 *
 * Migration note (Apr 2026): `/nodes` reads Nomad /v1/nodes directly
 * — the hand-rolled NodeHeartbeat is dead. `/allocations` is new and
 * exposes Nomad allocation state for the Workloads page to merge with
 * KeyDB site metadata.
 */

const express = require('express');
const http = require('http');
const router = express.Router();
const redisClient = require('../utils/redis');
const EventStream = require('../services/EventStream');
const sitesIndex = require('../utils/sites-index');

const events = new EventStream(redisClient);

const NOMAD_ADDR = process.env.NOMAD_ADDR || 'http://127.0.0.1:4646';

// Tiny HTTP wrapper — avoids adding a dep just for this. Nomad runs on
// the host so localhost is reachable from within the api container via
// the CNI bridge's default gateway (which for the `attr.unique.network.ip-address`
// env we already set is the node IP).
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

/**
 * GET /_admin/platform/nodes
 *
 * The three actual cluster VMs (one per Nomad client). Shape matches
 * what the admin UI's Nodes page expects: a flat array with hostname,
 * ip, load, memory, uptime — but those are now derived from Nomad's
 * node attributes rather than a hand-rolled heartbeat.
 */
router.get('/nodes', async (req, res) => {
  try {
    const stubs = await nomadGet('/v1/nodes');
    // Fetch detail for each (resources, attrs) in parallel.
    const details = await Promise.all(
      stubs.map((s) => nomadGet(`/v1/node/${s.ID}`).catch(() => null))
    );
    const nodes = details
      .filter(Boolean)
      .map((n) => ({
        hostname:    n.Name,
        nodeId:      n.ID,
        ip:          n.Attributes?.['unique.network.ip-address'] || n.HTTPAddr || null,
        datacenter:  n.Datacenter,
        nodeClass:   n.NodeClass || null,
        status:      n.Status,          // "ready" / "down" / "disconnected"
        eligibility: n.SchedulingEligibility, // "eligible" / "ineligible"
        drain:       !!n.Drain,
        cpuCores:    parseInt(n.Attributes?.['cpu.numcores'] || '0', 10) || null,
        cpuMHz:      parseInt(n.Attributes?.['cpu.frequency'] || '0', 10) || null,
        memoryBytes: parseInt(n.Attributes?.['memory.totalbytes'] || '0', 10) || null,
        kernel:      n.Attributes?.['kernel.version'] || null,
        os:          n.Attributes?.['os.name'] || null,
        dockerVersion: n.Attributes?.['driver.docker.version'] || null,
        lastHeartbeat: n.StatusUpdatedAt
          ? new Date(n.StatusUpdatedAt * 1000).toISOString() : null,
      }))
      .sort((a, b) => (a.hostname || '').localeCompare(b.hostname || ''));

    res.json({
      nodes,
      source: 'nomad',
      nomadAddr: NOMAD_ADDR,
    });
  } catch (error) {
    res.status(500).json({ error: error.message, source: 'nomad' });
  }
});

/**
 * GET /_admin/platform/allocations
 *
 * Nomad allocations (containers) currently placed on the cluster. Used
 * by the Workloads page to show where each site's containers live.
 */
router.get('/allocations', async (req, res) => {
  try {
    const allocs = await nomadGet('/v1/allocations');
    const flat = allocs.map((a) => ({
      id:          a.ID,
      shortId:     a.ID.slice(0, 8),
      jobId:       a.JobID,
      taskGroup:   a.TaskGroup,
      nodeId:      a.NodeID,
      nodeName:    a.NodeName,
      clientStatus:a.ClientStatus,
      desiredStatus: a.DesiredStatus,
      createTime:  a.CreateTime ? new Date(a.CreateTime / 1e6).toISOString() : null,
      modifyTime:  a.ModifyTime ? new Date(a.ModifyTime / 1e6).toISOString() : null,
      version:     a.JobVersion,
    }));
    res.json({ allocations: flat, total: flat.length });
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
 * Every customer site in the cluster, merged with Nomad allocation
 * state for container/node types. Static sites are reported as-is
 * (they live on Ceph, no allocations).
 */
router.get('/workloads', async (req, res) => {
  try {
    const domains = await sitesIndex.listAllDomains();
    let allocsByJob = new Map();
    try {
      const allocs = await nomadGet('/v1/allocations');
      for (const a of allocs) {
        if (a.ClientStatus !== 'running') continue;
        const arr = allocsByJob.get(a.JobID) || [];
        arr.push({
          shortId: a.ID.slice(0, 8),
          nodeName: a.NodeName,
          taskGroup: a.TaskGroup,
        });
        allocsByJob.set(a.JobID, arr);
      }
    } catch (_) { /* nomad might be unreachable — continue without alloc data */ }

    const out = [];
    for (const domain of domains) {
      const raw = await redisClient.get(`site:${domain}`);
      if (!raw) continue;
      let site;
      try { site = JSON.parse(raw); } catch { continue; }

      // For container sites the Nomad job id is derived from the site
      // the same way the Consul service name is. See router.lua.
      const slug = String(site.domain || '').toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const expectedJobId = site.type === 'container' || site.type === 'node'
        ? site.nomadJobId || slug.replace(/^site-/, '')
        : null;
      // Best-effort alloc lookup — also check a "site-<slug>" variant.
      const allocs = expectedJobId
        ? (allocsByJob.get(expectedJobId) || allocsByJob.get(`site-${slug}`) || [])
        : [];

      out.push({
        domain: site.domain,
        type: site.type,
        customerId: site.customerId,
        enabled: site.enabled !== false,
        sslEnabled: site.ssl_enabled === true,
        orchestrator: site.orchestrator || null,
        nomadJobId: expectedJobId,
        allocations: allocs,
        updatedAt: site.updatedAt,
      });
    }
    out.sort((a, b) => {
      const rank = (s) => s === 'container' || s === 'node' ? 0 : 1;
      return rank(a.type) - rank(b.type) || a.domain.localeCompare(b.domain);
    });
    res.json({ workloads: out, total: out.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /_admin/platform/jobs
 *
 * Platform-level Nomad jobs (registry, admin-ui, api, website, mcp,
 * and any future infra). Separate from /workloads which is keyed by
 * customer domain; /jobs is keyed by job id and shows jobs that
 * don't have a corresponding KeyDB site entry too.
 */
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await nomadGet('/v1/jobs');
    const flat = jobs.map((j) => ({
      id:          j.ID,
      name:        j.Name,
      type:        j.Type,
      status:      j.Status,
      priority:    j.Priority,
      datacenters: j.Datacenters,
      running:     j.JobSummary?.Summary
        ? Object.values(j.JobSummary.Summary)
            .reduce((acc, g) => acc + (g.Running || 0), 0)
        : 0,
      desired:     j.JobSummary?.Summary
        ? Object.values(j.JobSummary.Summary)
            .reduce((acc, g) => acc + (g.Running || 0) + (g.Queued || 0) + (g.Starting || 0), 0)
        : 0,
      submittedAt: j.SubmitTime
        ? new Date(j.SubmitTime / 1e6).toISOString() : null,
    }));
    res.json({ jobs: flat, total: flat.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /_admin/platform/haproxy
 *
 * Scrapes HAProxy's CSV stats endpoint (http://<LB>:8404/stats;csv)
 * and returns a parsed JSON view. The admin UI renders this with its
 * own styling — we never expose the HAProxy box's private IP to the
 * operator's browser, which matters because we serve operators over
 * Cloudflare from outside the private LAN.
 *
 * HAProxy CSV columns: https://docs.haproxy.org/2.9/management.html#9.1
 * We emit only the fields the dashboard uses.
 */
const HAPROXY_URL  = process.env.HAPROXY_STATS_URL  || 'http://192.168.88.20:8404/stats;csv';
const HAPROXY_USER = process.env.HAPROXY_STATS_USER || 'admin';
const HAPROXY_PASS = process.env.HAPROXY_STATS_PASS || 'admin';

function haproxyGetCsv() {
  return new Promise((resolve, reject) => {
    const url = new URL(HAPROXY_URL);
    const opts = {
      hostname: url.hostname,
      port: url.port || 8404,
      path: url.pathname + (url.search || ''),
      method: 'GET',
      timeout: 4000,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${HAPROXY_USER}:${HAPROXY_PASS}`).toString('base64'),
        'Accept': 'text/csv',
      },
    };
    const req = http.request(opts, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => {
        if (r.statusCode >= 200 && r.statusCode < 300) {
          resolve(Buffer.concat(chunks).toString());
        } else {
          reject(new Error(`haproxy ${r.statusCode}`));
        }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('haproxy timeout')); });
    req.on('error', reject);
    req.end();
  });
}

router.get('/haproxy', async (req, res) => {
  try {
    const csv = await haproxyGetCsv();
    // First row: "# pxname,svname,qcur,qmax,scur,smax,slim,stot,bin,bout,..."
    const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length < 2) return res.json({ backends: [], frontends: [], servers: [] });
    const headerLine = lines[0].replace(/^#\s*/, '');
    const columns = headerLine.split(',');
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(',');
      const obj = {};
      columns.forEach((c, i) => { obj[c] = cells[i]; });
      return obj;
    });

    const frontends = [];
    const backends = [];
    const servers = [];
    for (const r of rows) {
      const shaped = {
        pxname:  r.pxname,
        svname:  r.svname,
        status:  r.status,
        scur:    parseInt(r.scur || '0', 10),
        smax:    parseInt(r.smax || '0', 10),
        slim:    parseInt(r.slim || '0', 10),
        stot:    parseInt(r.stot || '0', 10),
        bin:     parseInt(r.bin || '0', 10),
        bout:    parseInt(r.bout || '0', 10),
        rate:    parseInt(r.rate || '0', 10),
        rate_max:parseInt(r.rate_max || '0', 10),
        weight:  r.weight,
        check_status: r.check_status,
        lastchg: parseInt(r.lastchg || '0', 10),
        // Error counters for quick sniffing
        econ:    parseInt(r.econ || '0', 10),
        eresp:   parseInt(r.eresp || '0', 10),
        hrsp_2xx:parseInt(r.hrsp_2xx || '0', 10),
        hrsp_5xx:parseInt(r.hrsp_5xx || '0', 10),
      };
      if (r.svname === 'FRONTEND')      frontends.push(shaped);
      else if (r.svname === 'BACKEND')  backends.push(shaped);
      else                              servers.push(shaped);
    }
    res.json({
      scrapedAt: new Date().toISOString(),
      frontends, backends, servers,
      lbUrl: HAPROXY_URL,
    });
  } catch (error) {
    res.status(502).json({ error: error.message, url: HAPROXY_URL });
  }
});

/**
 * GET /_admin/platform/storage
 *
 * Storage view for ops: per-node root disk (from Nomad node attributes)
 * plus the Ceph mount at /mnt/cephfs (read once from the api's own mount
 * since every node has the same view) and the KeyDB data footprint.
 */
const fsPromises = require('fs').promises;

async function dfOf(path) {
  // statvfs isn't exposed in pure Node without a native module. Shell out
  // to `df -P -B1 <path>` — bytes, POSIX columns. Cheap, runs on the
  // api container which mounts /data = /mnt/cephfs/spinforge/hosting/data.
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec(`df -P -B1 ${path} 2>/dev/null | tail -1`, { timeout: 3000 }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const cols = stdout.trim().split(/\s+/);
      // Filesystem  1B-blocks  Used  Available  Use%  Mounted on
      if (cols.length < 6) return resolve(null);
      resolve({
        filesystem: cols[0],
        total:  parseInt(cols[1], 10),
        used:   parseInt(cols[2], 10),
        avail:  parseInt(cols[3], 10),
        mount:  cols[5],
      });
    });
  });
}

async function sizeOf(path) {
  // du -sb — bytes, summary. Cap at 10s in case the tree is huge.
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec(`du -sb ${path} 2>/dev/null`, { timeout: 10000 }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const n = parseInt(stdout.split(/\s+/)[0], 10);
      resolve(Number.isFinite(n) ? n : null);
    });
  });
}

router.get('/storage', async (req, res) => {
  try {
    const [stubs, cephMount, staticSize, uploadsSize] = await Promise.all([
      nomadGet('/v1/nodes').catch(() => []),
      dfOf('/data'),
      sizeOf('/data/static'),
      sizeOf('/data/uploads'),
    ]);
    const nodeDetails = await Promise.all(
      stubs.map((s) => nomadGet(`/v1/node/${s.ID}`).catch(() => null))
    );
    const nodes = nodeDetails.filter(Boolean).map((n) => ({
      hostname: n.Name,
      nodeId: n.ID,
      ip: n.Attributes?.['unique.network.ip-address'] || null,
      // Nomad reports the node's root-fs stats via these attributes.
      diskTotalBytes: parseInt(n.Attributes?.['unique.storage.bytestotal'] || '0', 10) || null,
      diskFreeBytes:  parseInt(n.Attributes?.['unique.storage.bytesfree']  || '0', 10) || null,
      diskVolume:     n.Attributes?.['unique.storage.volume'] || null,
      cpuCores:       parseInt(n.Attributes?.['cpu.numcores'] || '0', 10) || null,
      memoryBytes:    parseInt(n.Attributes?.['memory.totalbytes'] || '0', 10) || null,
    })).sort((a, b) => (a.hostname || '').localeCompare(b.hostname || ''));

    // KeyDB footprint — cheap INFO memory.
    let keydbBytes = null;
    try {
      const redisClient = require('../utils/redis');
      const info = await redisClient.info('memory');
      const line = String(info).split('\n').find((l) => l.startsWith('used_memory:'));
      if (line) keydbBytes = parseInt(line.split(':')[1].trim(), 10);
    } catch (_) {}

    res.json({
      nodes,
      ceph: cephMount ? {
        mount:      cephMount.mount,
        filesystem: cephMount.filesystem,
        total:      cephMount.total,
        used:       cephMount.used,
        avail:      cephMount.avail,
      } : null,
      breakdown: {
        staticBytes:  staticSize,
        uploadsBytes: uploadsSize,
        keydbBytes,
      },
      scrapedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
