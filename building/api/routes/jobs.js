/**
 * Job HTTP surface.
 *
 * SECURITY NOTE: No auth middleware is wired yet. See PLATFORM_PLAN.md §9
 * open decision O4 — customer-facing auth (JWT via hosting gateway, or a
 * dedicated build token) is being decided. Until then, do NOT expose this
 * service publicly. The edge (OpenResty) should only route to building-api
 * from trusted admin origins.
 */

const express = require('express');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const logger = require('../utils/logger');
const redis = require('../utils/redis');
const { TERMINAL_STATES } = require('../services/JobService');
const {
  UPLOADS_TMP,
  WORKSPACES_ROOT,
  MAX_UPLOAD_BYTES,
} = require('../utils/constants');
const { parseManifest } = require('../utils/manifest');
const CustomerPolicyService = require('../services/CustomerPolicyService');
const metrics = require('../utils/metrics');

const router = express.Router();

fsSync.mkdirSync(UPLOADS_TMP, { recursive: true });
fsSync.mkdirSync(WORKSPACES_ROOT, { recursive: true });

const ALLOWED_EXT = ['.zip', '.tar', '.tar.gz', '.tgz'];
const upload = multer({
  dest: UPLOADS_TMP,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok = ALLOWED_EXT.some((ext) => name.endsWith(ext));
    if (!ok) {
      cb(Object.assign(new Error('workspace must be .zip, .tar, .tar.gz, or .tgz'), {
        status: 400, expose: true,
      }));
      return;
    }
    cb(null, true);
  },
});

// ─── POST /api/jobs ────────────────────────────────────────────────────
// multipart: workspace=<file>, manifest=<JSON string>
router.post('/', upload.single('workspace'), async (req, res, next) => {
  let tempPath = req.file && req.file.path;
  try {
    if (!req.file) {
      throw Object.assign(new Error('workspace file is required (field: workspace)'), {
        status: 400, expose: true,
      });
    }

    const manifest = parseManifest(req.body.manifest);

    // Policy enforcement (task 122). Runs BEFORE job creation so the
    // workspace upload and job record never happen for denied requests.
    // We already have the uploaded file on disk (multer), so use its
    // size for maxArtifactMB. Active-set membership and quota hash live
    // in KeyDB under customer:<id>:active and customer:<id>:usage:<yyyymm>.
    const workspaceBytes = req.file?.size ?? 0;
    const decision = await CustomerPolicyService.checkJobDispatch(
      manifest.customerId,
      manifest,
      workspaceBytes
    );
    if (!decision.allowed) {
      const { allowed: _a, status, ...payload } = decision;
      // Prom counter — one label per denial reason so a spike in
      // concurrent_jobs_exceeded vs monthly_cpu_exceeded stands out on
      // the dashboard without drilling into logs.
      try {
        metrics.policyRejects.inc({ error: payload.error || 'unknown' });
      } catch (_) {}
      return res.status(status || 403).json(payload);
    }
    const policy = decision.policy;

    const job = await req.app.locals.jobs.create({
      customerId: manifest.customerId,
      projectId: manifest.projectId,
      platform: manifest.platform,
      targets: manifest.targets,
      framework: manifest.framework,
      signingProfileId: manifest.signingProfileId,
      source: manifest.source,
      manifest: {
        buildCommand: manifest.buildCommand,
        outputDir: manifest.outputDir,
        env: manifest.env,
      },
    });

    // Claim a concurrency slot. Done AFTER create succeeds so a failed
    // create doesn't leak a slot. The slot is released in JobService's
    // terminal transition hook (SREM on succeeded/failed/canceled/timeout).
    try {
      await redis.sAdd(`customer:${manifest.customerId}:active`, job.id);
    } catch (err) {
      logger.warn(`[POST /jobs] failed to SADD active set for ${job.id}: ${err.message}`);
    }

    const finalPath = path.join(WORKSPACES_ROOT, `${job.id}.zip`);
    // Both tempPath and finalPath live under DATA_ROOT (Ceph), so this is a
    // same-device rename — atomic, no copy.
    await fs.rename(tempPath, finalPath);
    tempPath = null;

    const bytes = (await fs.stat(finalPath)).size;

    // Fire-and-forget dispatch. If it fails synchronously (Nomad down,
    // unknown platform), transition the job to failed and surface the
    // reason in the response. The job record exists either way.
    // `policy` is still threaded through in case a future DispatchRouter
    // needs it, but the current implementation is a nomad-only passthrough.
    let dispatchInfo = null;
    let dispatchError = null;
    try {
      dispatchInfo = await req.app.locals.dispatch.dispatch(job, { policy });
      if (dispatchInfo) {
        await req.app.locals.jobs.update(job.id, {
          nomadJobId: dispatchInfo.nomadJobId || null,
          dispatchRoute: dispatchInfo.route,
          dispatchEvalId: dispatchInfo.evalId || null,
          dispatchedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      dispatchError = err.message;
      logger.error(`[POST /jobs] dispatch failed for ${job.id}: ${err.message}`);
      await req.app.locals.jobs.transition(job.id, 'failed', {
        reason: `dispatch_failed: ${err.message}`,
      }).catch(() => {});
    }

    res.status(201).json({
      jobId: job.id,
      status: dispatchError ? 'failed' : job.status,
      workspaceBytes: bytes,
      dispatch: dispatchInfo,
      dispatchError,
      statusUrl: `/api/jobs/${job.id}`,
      streamUrl: `/api/jobs/${job.id}/stream`,
    });
  } catch (err) {
    if (tempPath) {
      fs.unlink(tempPath).catch(() => {});
    }
    next(err);
  }
});

// ─── GET /api/jobs ─────────────────────────────────────────────────────
// List jobs with optional filters. Admin-only surface.
// Query: customerId, status, platform, limit (default 50, max 500), offset.
router.get('/', async (req, res, next) => {
  try {
    const { jobs, total } = await req.app.locals.jobs.list({
      customerId: req.query.customerId || null,
      status: req.query.status || null,
      platform: req.query.platform || null,
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ jobs, total });
  } catch (err) { next(err); }
});

// ─── GET /api/jobs/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const job = await req.app.locals.jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'job_not_found' });
    res.json(job);
  } catch (err) { next(err); }
});

// ─── GET /api/jobs/:id/events ──────────────────────────────────────────
// Snapshot of recent events (for client warm-up before switching to SSE).
router.get('/:id/events', async (req, res, next) => {
  try {
    const job = await req.app.locals.jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'job_not_found' });
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const events = await req.app.locals.jobs.recentEvents(req.params.id, limit);
    res.json({ jobId: req.params.id, events });
  } catch (err) { next(err); }
});

// ─── GET /api/jobs/:id/stream ──────────────────────────────────────────
// Server-Sent Events live tail of job:<id>:events.
// Query params:
//   lastId  stream offset to start at. Default "$" (live-only). Use "0" to
//           replay from the beginning.
//   replay  if "1" (default when lastId is not set), send a snapshot of the
//           job record + the last 200 events before switching to live.
router.get('/:id/stream', async (req, res, next) => {
  const jobId = req.params.id;
  const jobs = req.app.locals.jobs;

  const current = await jobs.get(jobId);
  if (!current) return res.status(404).json({ error: 'job_not_found' });

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    // nginx/openresty: disable response buffering so events flush to the
    // client immediately. Without this, SSE looks frozen until the buffer
    // fills (~4KB).
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  const comment = (text) => res.write(`: ${text}\n\n`);

  let closed = false;
  const onClose = () => { closed = true; };
  req.on('close', onClose);

  // Heartbeat keeps proxies from dropping idle SSE sockets.
  const heartbeat = setInterval(() => {
    if (!closed) comment('hb');
  }, 15_000);

  // Dedicated blocking client — shared redis can't block without stalling
  // the whole service.
  const blocker = redis.duplicate();

  try {
    await blocker.connect();

    const replay = req.query.replay !== '0' && !req.query.lastId;
    if (replay) {
      send({ kind: 'snapshot', job: current });
      const recent = await jobs.recentEvents(jobId, 200);
      for (const ev of recent) send({ kind: 'event', ...ev });
      // Close immediately if the job is already terminal — nothing more coming.
      if (TERMINAL_STATES.has(current.status)) {
        send({ kind: 'end', reason: 'job_terminal', status: current.status });
        closed = true;
      }
    }

    let lastId = req.query.lastId || '$';
    while (!closed) {
      const { events, lastId: newLast } = await jobs.tailEvents(jobId, lastId, {
        client: blocker,
        blockMs: 5000,
        limit: 200,
      });
      lastId = newLast;
      for (const ev of events) {
        if (closed) break;
        send({ kind: 'event', ...ev });
        // Auto-close on terminal event types so clients don't hang.
        const terminal = ev.type && ev.type.startsWith('job.')
          && TERMINAL_STATES.has(ev.type.slice('job.'.length));
        if (terminal) {
          send({ kind: 'end', reason: 'job_terminal', type: ev.type });
          closed = true;
        }
      }
    }
  } catch (err) {
    logger.error(`[sse job=${jobId}] ${err.message}`);
    try { send({ kind: 'error', message: err.message }); } catch (_) {}
  } finally {
    clearInterval(heartbeat);
    req.off('close', onClose);
    try { await blocker.quit(); } catch (_) {}
    try { res.end(); } catch (_) {}
  }
});

router.get('/:id/artifacts', async (req, res, next) => {
  try {
    const job = await req.app.locals.jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'job_not_found' });
    res.json({ jobId: req.params.id, artifacts: job.artifacts || [] });
  } catch (err) { next(err); }
});

// ─── GET /api/jobs/:id/usage ─────────────────────────────────────────
// Per-job immutable usage snapshot. Populated by task 122 (policy
// enforcement) on terminal transitions. Returns null if the job hasn't
// completed yet or if the metering hook hasn't been wired.
router.get('/:id/usage', async (req, res, next) => {
  try {
    const job = await req.app.locals.jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'job_not_found' });
    res.json({
      jobId: req.params.id,
      customerId: job.customerId,
      projectId: job.projectId || null,
      status: job.status,
      usage: job.usage || null,
    });
  } catch (err) { next(err); }
});

module.exports = router;
