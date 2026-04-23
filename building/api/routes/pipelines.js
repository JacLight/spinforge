/**
 * Pipeline HTTP surface.
 *
 *   POST   /api/pipelines             create
 *   GET    /api/pipelines              list (optional customerId filter)
 *   GET    /api/pipelines/:id          fetch
 *   PUT    /api/pipelines/:id          update
 *   DELETE /api/pipelines/:id          delete
 *   POST   /api/pipelines/validate     dry-run schema validation (body == pipeline spec)
 *
 * Auth is inherited from the parent /api mount (admin token or API key).
 */

const express = require('express');
const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const p = await req.app.locals.pipelines.create(req.body || {});
    res.status(201).json(p);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { customerId, limit, offset } = req.query;
    const out = await req.app.locals.pipelines.list({
      customerId: customerId || null,
      limit: Math.min(500, parseInt(limit, 10) || 50),
      offset: Math.max(0, parseInt(offset, 10) || 0),
    });
    res.json(out);
  } catch (err) { next(err); }
});

// Validate without persisting. Used by the UI's save-preflight and by
// any AI authoring tool that wants to pre-check its work.
router.post('/validate', async (req, res, next) => {
  try {
    const stages = (req.body && req.body.stages) || [];
    const result = req.app.locals.pipelines.validateStages(stages);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const p = await req.app.locals.pipelines.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'pipeline_not_found' });
    res.json(p);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const p = await req.app.locals.pipelines.update(req.params.id, req.body || {});
    res.json(p);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ok = await req.app.locals.pipelines.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'pipeline_not_found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
