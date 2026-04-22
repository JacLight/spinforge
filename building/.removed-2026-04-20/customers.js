/**
 * Customer-plan + usage routes scoped to SpinBuild.
 *
 * Auth: admin-gated once O4 lands (see PLATFORM_PLAN.md). The `PUT plan`
 * endpoint in particular is never customer-facing.
 */

const express = require('express');

const router = express.Router();

// ─── Plans ───────────────────────────────────────────────────────────

router.get('/plans', (req, res) => {
  const plans = req.app.locals.plans;
  res.json({
    tiers: plans.listTiers().map((t) => plans.getTier(t)),
  });
});

router.get('/:customerId/plan', async (req, res, next) => {
  try {
    const plan = await req.app.locals.plans.resolve(req.params.customerId);
    res.json({ customerId: req.params.customerId, plan });
  } catch (err) { next(err); }
});

router.put('/:customerId/plan', async (req, res, next) => {
  try {
    const { tier, overrides } = req.body || {};
    if (!tier) return res.status(400).json({ error: 'tier is required' });
    const plan = await req.app.locals.plans.setTier(req.params.customerId, tier, { overrides });
    res.json({ customerId: req.params.customerId, plan });
  } catch (err) { next(err); }
});

// ─── Usage ───────────────────────────────────────────────────────────
// Query params:
//   from       YYYY-MM (inclusive). Default: current month.
//   to         YYYY-MM (inclusive). Default: from.
//   projectId  narrow to one project.

router.get('/:customerId/usage', async (req, res, next) => {
  try {
    const { from, to, projectId } = req.query;
    const usage = await req.app.locals.billing.getUsage(req.params.customerId, {
      from, to, projectId,
    });
    res.json({
      customerId: req.params.customerId,
      projectId: projectId || null,
      ...usage,
    });
  } catch (err) { next(err); }
});

router.get('/:customerId/projects/:projectId/usage', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const usage = await req.app.locals.billing.getUsage(req.params.customerId, {
      from, to, projectId: req.params.projectId,
    });
    res.json({
      customerId: req.params.customerId,
      projectId: req.params.projectId,
      ...usage,
    });
  } catch (err) { next(err); }
});

// List all billing months we have data for. Useful when the admin UI
// wants to render a dropdown without guessing.
router.get('/:customerId/usage/months', async (req, res, next) => {
  try {
    const customerId = req.params.customerId;
    const months = await req.app.locals.redis.zRange(
      `usage:index:${customerId}`, 0, -1, { REV: true }
    );
    res.json({ customerId, months });
  } catch (err) { next(err); }
});

// Current in-flight jobs for concurrency visibility.
router.get('/:customerId/usage/active', async (req, res, next) => {
  try {
    const count = await req.app.locals.billing.getActiveBuildCount(req.params.customerId);
    res.json({ customerId: req.params.customerId, activeBuilds: count });
  } catch (err) { next(err); }
});

module.exports = router;
