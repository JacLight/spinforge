/**
 * Customer-scoped HTTP surface for building-api.
 *
 * Mounted at /_api/customer behind authenticateCustomer (utils/customer-auth.js).
 * The shape mirrors the admin routes (pipelines / actions / builds) but every
 * list/create call is forced to req.customerId, and every fetch/cancel/etc.
 * asserts the resource belongs to the caller. Customer-supplied customerId
 * fields in the request body are ignored.
 *
 *   GET    /_api/customer/actions
 *   GET    /_api/customer/actions/:id
 *   GET    /_api/customer/actions/:id/schema
 *   POST   /_api/customer/pipelines/validate
 *   GET    /_api/customer/pipelines
 *   POST   /_api/customer/pipelines
 *   GET    /_api/customer/pipelines/:id
 *   PUT    /_api/customer/pipelines/:id
 *   DELETE /_api/customer/pipelines/:id
 *   GET    /_api/customer/builds
 *   POST   /_api/customer/builds
 *   GET    /_api/customer/builds/:id
 *   POST   /_api/customer/builds/:id/cancel
 *   POST   /_api/customer/builds/:id/resume
 *   POST   /_api/customer/builds/:id/stages/:stageId/retry
 *   GET    /_api/customer/builds/:id/events
 *   GET    /_api/customer/builds/:id/stages/:stageId
 *   GET    /_api/customer/builds/:id/artifacts/:stageId/:key
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const router = express.Router();

const ARTIFACT_KEYS = new Set([
  'artifactPath', 'artifactZip', 'ipaPath', 'aab', 'apkPath',
  'signedPath', 'archivePath', 'imageRef', 'url',
]);

// ─── Actions (read-only, not customer-scoped) ────────────────────────────

router.get('/actions', (req, res) => {
  const all = req.app.locals.actions.list();
  const byCategory = {};
  for (const a of all) (byCategory[a.category] ||= []).push(a);
  res.json({ count: all.length, actions: all, byCategory });
});

router.get('/actions/:id', (req, res) => {
  const action = req.app.locals.actions.get(req.params.id);
  if (!action) return res.status(404).json({ error: 'action_not_found', id: req.params.id });
  const { _validateInputs, _validateOutputs, ...safe } = action;
  res.json(safe);
});

router.get('/actions/:id/schema', (req, res) => {
  const action = req.app.locals.actions.get(req.params.id);
  if (!action) return res.status(404).json({ error: 'action_not_found', id: req.params.id });
  res.json({
    id: action.id, version: action.version,
    inputs: action.inputs, outputs: action.outputs,
  });
});

// ─── Manifest ────────────────────────────────────────────────────────────
// Declarative hosting: POST a spinforge.json and SpinForge derives the
// pipeline, wires the repo as the source, and (unless autoDeploy is false)
// starts the build. Idempotent per (customer, manifest.name) so CI can call
// it on every push. Ownership comes from the sfc_ token, not the body.

// The JSON Schema the manifest is validated against. Developers point their
// editor's `$schema` at this for completion and inline errors.
router.get('/manifest/schema', (req, res) => {
  res.type('application/schema+json').json(req.app.locals.manifests.schema());
});

router.post('/manifest/validate', async (req, res, next) => {
  try {
    const manifests = req.app.locals.manifests;

    // Same code path a real deploy takes, stopping short of the first write:
    // same ownership check, same app-type resolution, same stages. Anything
    // computed separately here would be free to drift from what apply() does.
    const plan = await manifests.plan(manifests.parse(req.body, req.get('content-type')), {
      customerId: req.customerId,
    });

    res.json({
      valid: true,
      appId: plan.appId,
      domain: plan.domain,
      url: `https://${plan.domain}`,
      type: plan.type,
      stages: plan.stages.map((s) => ({ id: s.id, action: s.action })),
      unsupported: plan.unsupported,
      warnings: plan.warnings,
    });
  } catch (err) { next(err); }
});

router.post('/manifest', async (req, res, next) => {
  try {
    const manifests = req.app.locals.manifests;
    const out = await manifests.apply(manifests.parse(req.body, req.get('content-type')), {
      customerId: req.customerId,
      userEmail: req.userEmail,
    });
    res.status(out.created ? 201 : 200).json(out);
  } catch (err) { next(err); }
});

// ─── Pipelines ───────────────────────────────────────────────────────────

router.post('/pipelines/validate', async (req, res, next) => {
  try {
    const stages = (req.body && req.body.stages) || [];
    res.json(req.app.locals.pipelines.validateStages(stages));
  } catch (err) { next(err); }
});

router.get('/pipelines', async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const out = await req.app.locals.pipelines.list({
      customerId: req.customerId,
      limit: Math.min(500, parseInt(limit, 10) || 50),
      offset: Math.max(0, parseInt(offset, 10) || 0),
    });
    res.json(out);
  } catch (err) { next(err); }
});

// Inspect a repository and report what SpinForge would build from it.
// Read-only: shallow clone into a temp dir, Railpack analysis, nothing
// written and nothing scheduled.
router.post('/pipelines/detect', async (req, res, next) => {
  try {
    const { url, ref, rootDir, token } = req.body || {};
    const result = await req.app.locals.repoDetect.detect({ url, ref, rootDir, token });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

// Auto pipeline: point at a repo, get a working pipeline.
//
// Pipelines already carry a git source, so making someone then choose a
// project type and hand-write build stages is asking them to restate what
// the repository already says. Railpack reads it and the stages are
// derived from that — the same derivation a manifest apply uses, so both
// entry points produce identical pipelines.
router.post('/pipelines/auto', async (req, res, next) => {
  try {
    const { url, ref, rootDir, token, domain, name } = req.body || {};
    if (!domain) return res.status(400).json({ error: 'domain_required', message: 'Choose the app this repository deploys to' });

    const detected = await req.app.locals.repoDetect.detect({ url, ref, rootDir, token });
    if (!detected.ok) return res.status(400).json(detected);

    const manifests = req.app.locals.manifests;
    const stages = manifests.toStages({
      type: detected.type,
      domain,
      rootDir: rootDir || '.',
      aliases: [],
    });

    const pipeline = await req.app.locals.pipelines.create({
      customerId: req.customerId,
      name: name || domain,
      type: detected.type,
      source: { type: 'git', url, ref: ref || undefined, depth: 1, token: token || undefined },
      stages,
      metadata: {
        autoDetected: true,
        detectedAt: new Date().toISOString(),
        runtime: detected.runtime,
        packageManager: detected.packageManager,
        providers: detected.providers,
        outputDir: detected.outputDir,
        startCommand: detected.startCommand,
      },
    });

    res.status(201).json({ pipeline, detected });
  } catch (err) { next(err); }
});

router.post('/pipelines', async (req, res, next) => {
  try {
    const body = req.body || {};
    const p = await req.app.locals.pipelines.create({ ...body, customerId: req.customerId });
    res.status(201).json(p);
  } catch (err) { next(err); }
});

async function loadOwnedPipeline(req, res) {
  const p = await req.app.locals.pipelines.get(req.params.id);
  if (!p) { res.status(404).json({ error: 'pipeline_not_found' }); return null; }
  if (p.customerId !== req.customerId) { res.status(404).json({ error: 'pipeline_not_found' }); return null; }
  return p;
}

router.get('/pipelines/:id', async (req, res, next) => {
  try {
    const p = await loadOwnedPipeline(req, res); if (!p) return;
    res.json(p);
  } catch (err) { next(err); }
});

router.put('/pipelines/:id', async (req, res, next) => {
  try {
    const p = await loadOwnedPipeline(req, res); if (!p) return;
    const patch = { ...(req.body || {}) };
    delete patch.customerId; // PipelineService freezes it anyway, but be explicit.
    const next2 = await req.app.locals.pipelines.update(req.params.id, patch);
    res.json(next2);
  } catch (err) { next(err); }
});

router.delete('/pipelines/:id', async (req, res, next) => {
  try {
    const p = await loadOwnedPipeline(req, res); if (!p) return;
    const ok = await req.app.locals.pipelines.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'pipeline_not_found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Builds ──────────────────────────────────────────────────────────────

router.get('/builds', async (req, res, next) => {
  try {
    const { pipelineId, status, limit, offset } = req.query;
    const out = await req.app.locals.builds.list({
      customerId: req.customerId,
      pipelineId: pipelineId || null,
      status: status || null,
      limit: Math.min(500, parseInt(limit, 10) || 50),
      offset: Math.max(0, parseInt(offset, 10) || 0),
    });
    res.json(out);
  } catch (err) { next(err); }
});

router.post('/builds', async (req, res, next) => {
  try {
    const { pipelineId, trigger, inputs } = req.body || {};
    // Confirm the pipeline belongs to this customer before kicking off a build.
    const pipeline = pipelineId ? await req.app.locals.pipelines.get(pipelineId) : null;
    if (!pipeline) return res.status(404).json({ error: 'pipeline_not_found' });
    if (pipeline.customerId !== req.customerId) {
      return res.status(404).json({ error: 'pipeline_not_found' });
    }
    const build = await req.app.locals.builds.create({
      pipelineId, trigger, inputs, customerId: req.customerId,
    });
    res.status(201).json(build);
  } catch (err) { next(err); }
});

async function loadOwnedBuild(req, res) {
  const b = await req.app.locals.builds.get(req.params.id);
  if (!b) { res.status(404).json({ error: 'build_not_found' }); return null; }
  if (b.customerId !== req.customerId) { res.status(404).json({ error: 'build_not_found' }); return null; }
  return b;
}

router.get('/builds/:id', async (req, res, next) => {
  try {
    const b = await loadOwnedBuild(req, res); if (!b) return;
    res.json(b);
  } catch (err) { next(err); }
});

router.post('/builds/:id/cancel', async (req, res, next) => {
  try {
    const b = await loadOwnedBuild(req, res); if (!b) return;
    const out = await req.app.locals.builds.cancel(req.params.id, {
      reason: (req.body && req.body.reason) || 'canceled_by_user',
    });
    res.json(out);
  } catch (err) { next(err); }
});

router.post('/builds/:id/resume', async (req, res, next) => {
  try {
    const b = await loadOwnedBuild(req, res); if (!b) return;
    const out = await req.app.locals.builds.resume(req.params.id);
    res.json(out);
  } catch (err) { next(err); }
});

router.post('/builds/:id/stages/:stageId/retry', async (req, res, next) => {
  try {
    const b = await loadOwnedBuild(req, res); if (!b) return;
    const overrides = req.body && (req.body.with || req.body.overrides);
    const out = await req.app.locals.builds.retryStage(req.params.id, req.params.stageId, { overrides });
    res.json(out);
  } catch (err) { next(err); }
});

router.get('/builds/:id/events', async (req, res, next) => {
  try {
    const b = await loadOwnedBuild(req, res); if (!b) return;
    const limit = Math.min(1000, parseInt(req.query.limit, 10) || 200);
    const events = await req.app.locals.builds.recentBuildEvents(req.params.id, limit);
    res.json({ buildId: req.params.id, events });
  } catch (err) { next(err); }
});

router.get('/builds/:id/stages/:stageId', async (req, res, next) => {
  try {
    const b = await loadOwnedBuild(req, res); if (!b) return;
    const stage = b.stages.find((s) => s.id === req.params.stageId);
    if (!stage) return res.status(404).json({ error: 'stage_not_found' });
    const [events, log] = await Promise.all([
      req.app.locals.builds.recentStageEvents(req.params.id, req.params.stageId, 200),
      req.app.locals.builds.recentStageLog(req.params.id, req.params.stageId, 500),
    ]);
    res.json({ buildId: req.params.id, stage, events, log });
  } catch (err) { next(err); }
});

// Identical to the admin /api/builds artifact route, but ownership-checked.
router.get('/builds/:id/artifacts/:stageId/:key', async (req, res, next) => {
  try {
    const { stageId, key } = req.params;
    if (!ARTIFACT_KEYS.has(key)) {
      return res.status(400).json({ error: 'unsupported_artifact_key', key });
    }
    const b = await loadOwnedBuild(req, res); if (!b) return;
    const stage = b.stages.find((s) => s.id === stageId);
    if (!stage) return res.status(404).json({ error: 'stage_not_found' });
    const value = stage.outputs && stage.outputs[key];
    if (!value || typeof value !== 'string') {
      return res.status(404).json({ error: 'artifact_not_found', stageId, key });
    }

    if (/^https?:\/\//i.test(value)) return res.redirect(302, value);
    if (key === 'imageRef') {
      return res.status(400).json({
        error: 'not_downloadable',
        hint: 'imageRef is a container image coordinate, not a file. Pull it with your container runtime.',
        imageRef: value,
      });
    }

    let st;
    try { st = fs.statSync(value); }
    catch { return res.status(404).json({ error: 'artifact_missing_on_disk', path: value }); }

    if (st.isFile()) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(value)}"`);
      res.setHeader('Content-Length', String(st.size));
      fs.createReadStream(value).on('error', next).pipe(res);
      return;
    }
    if (st.isDirectory()) {
      const name = `${stage.id}-${path.basename(value)}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      const zip = spawn('zip', ['-r', '-q', '-', '.'], { cwd: value });
      zip.stdout.pipe(res);
      zip.on('error', next);
      zip.on('close', (code) => { if (code !== 0 && !res.headersSent) res.status(500).end(); });
      return;
    }
    return res.status(400).json({ error: 'artifact_unsupported_type', path: value });
  } catch (err) { next(err); }
});

module.exports = router;
