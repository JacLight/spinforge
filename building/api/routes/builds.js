/**
 * Build HTTP surface.
 *
 *   POST   /api/builds                                   trigger a build from a pipeline
 *   GET    /api/builds                                   list (filter: pipelineId | customerId | status)
 *   GET    /api/builds/:id                               full record
 *   POST   /api/builds/:id/cancel                        cancel in-flight
 *   POST   /api/builds/:id/resume                        re-run from first non-succeeded stage
 *   POST   /api/builds/:id/stages/:stageId/retry         overrides optional { with: {...} }
 *   GET    /api/builds/:id/events                        last N build-level events
 *   GET    /api/builds/:id/stages/:stageId               stage state + recent events + recent log
 *   GET    /api/builds/:id/stages/:stageId/stream        SSE — combined stage events + log
 *   GET    /api/builds/:id/artifacts/:stageId/:key       download one artifact produced by the stage
 *
 * Auth inherited from the parent /api mount.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const router = express.Router();

// Outputs we treat as user-facing artifacts. Must match what the
// PipelineDetailDrawer Artifacts tab surfaces.
const ARTIFACT_KEYS = new Set([
  'artifactPath', 'artifactZip', 'ipaPath', 'aab', 'apkPath',
  'signedPath', 'archivePath', 'imageRef', 'url',
]);

router.post('/', async (req, res, next) => {
  try {
    const { pipelineId, trigger, inputs, customerId } = req.body || {};
    const build = await req.app.locals.builds.create({
      pipelineId, trigger, inputs, customerId,
    });
    res.status(201).json(build);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { pipelineId, customerId, status, limit, offset } = req.query;
    const out = await req.app.locals.builds.list({
      pipelineId: pipelineId || null,
      customerId: customerId || null,
      status: status || null,
      limit: Math.min(500, parseInt(limit, 10) || 50),
      offset: Math.max(0, parseInt(offset, 10) || 0),
    });
    res.json(out);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const b = await req.app.locals.builds.get(req.params.id);
    if (!b) return res.status(404).json({ error: 'build_not_found' });
    res.json(b);
  } catch (err) { next(err); }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const b = await req.app.locals.builds.cancel(req.params.id, {
      reason: (req.body && req.body.reason) || 'canceled_by_user',
    });
    res.json(b);
  } catch (err) { next(err); }
});

router.post('/:id/resume', async (req, res, next) => {
  try {
    const b = await req.app.locals.builds.resume(req.params.id);
    res.json(b);
  } catch (err) { next(err); }
});

router.post('/:id/stages/:stageId/retry', async (req, res, next) => {
  try {
    const overrides = req.body && (req.body.with || req.body.overrides);
    const b = await req.app.locals.builds.retryStage(req.params.id, req.params.stageId, { overrides });
    res.json(b);
  } catch (err) { next(err); }
});

router.get('/:id/events', async (req, res, next) => {
  try {
    const limit = Math.min(1000, parseInt(req.query.limit, 10) || 200);
    const events = await req.app.locals.builds.recentBuildEvents(req.params.id, limit);
    res.json({ buildId: req.params.id, events });
  } catch (err) { next(err); }
});

router.get('/:id/stages/:stageId', async (req, res, next) => {
  try {
    const b = await req.app.locals.builds.get(req.params.id);
    if (!b) return res.status(404).json({ error: 'build_not_found' });
    const stage = b.stages.find((s) => s.id === req.params.stageId);
    if (!stage) return res.status(404).json({ error: 'stage_not_found' });
    const [events, log] = await Promise.all([
      req.app.locals.builds.recentStageEvents(req.params.id, req.params.stageId, 200),
      req.app.locals.builds.recentStageLog(req.params.id, req.params.stageId, 500),
    ]);
    res.json({ buildId: req.params.id, stage, events, log });
  } catch (err) { next(err); }
});

// Download one of the artifacts produced by a stage. The value must
// already be referenced from stage.outputs[key] — we never accept an
// arbitrary path from the client. Behavior by output type:
//   - url         → 302 redirect to the URL
//   - imageRef    → 400 (container images aren't downloadable as files)
//   - file path   → stream the file with Content-Disposition
//   - directory   → stream a zip of the directory on the fly
router.get('/:id/artifacts/:stageId/:key', async (req, res, next) => {
  try {
    const { id, stageId, key } = req.params;
    if (!ARTIFACT_KEYS.has(key)) {
      return res.status(400).json({ error: 'unsupported_artifact_key', key });
    }
    const b = await req.app.locals.builds.get(id);
    if (!b) return res.status(404).json({ error: 'build_not_found' });
    const stage = b.stages.find((s) => s.id === stageId);
    if (!stage) return res.status(404).json({ error: 'stage_not_found' });
    const value = stage.outputs && stage.outputs[key];
    if (!value || typeof value !== 'string') {
      return res.status(404).json({ error: 'artifact_not_found', stageId, key });
    }

    // External URL — just bounce the browser.
    if (/^https?:\/\//i.test(value)) {
      return res.redirect(302, value);
    }
    // Container image ref — no download semantics.
    if (key === 'imageRef') {
      return res.status(400).json({
        error: 'not_downloadable',
        hint: 'imageRef is a container image coordinate, not a file. Pull it with your container runtime.',
        imageRef: value,
      });
    }

    // Everything else is a filesystem path on the build host.
    let st;
    try { st = fs.statSync(value); }
    catch { return res.status(404).json({ error: 'artifact_missing_on_disk', path: value }); }

    if (st.isFile()) {
      const base = path.basename(value);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${base}"`);
      res.setHeader('Content-Length', String(st.size));
      fs.createReadStream(value).on('error', next).pipe(res);
      return;
    }

    if (st.isDirectory()) {
      // Stream a zip over the wire. We use the system `zip` binary so
      // we don't take on a JS zip dep; the builder image already has it.
      const name = `${stage.id}-${path.basename(value)}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      const zip = spawn('zip', ['-r', '-q', '-', '.'], { cwd: value });
      zip.stdout.pipe(res);
      zip.stderr.on('data', (d) => req.log?.warn?.('zip stderr', d.toString()));
      zip.on('error', next);
      zip.on('close', (code) => {
        if (code !== 0 && !res.headersSent) res.status(500).end();
      });
      return;
    }

    return res.status(400).json({ error: 'artifact_unsupported_type', path: value });
  } catch (err) { next(err); }
});

module.exports = router;
