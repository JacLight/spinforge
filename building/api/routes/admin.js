/**
 * Operator-facing admin endpoints that aren't CRUD on a business entity.
 *
 * Right now this is just the retention sweep trigger, but the mount
 * exists so future "big red button" endpoints (emergency cache flush,
 * rotate sfa tokens, etc.) have an obvious home.
 *
 * Auth: inherits from the `/api` mount in server.js — admin Bearer JWT
 * or X-API-Key with `write` role. No extra gating here.
 */

const express = require('express');
const logger = require('../utils/logger');
const retention = require('../bin/artifact-retention');

const router = express.Router();

// ─── POST /api/admin/retention/run ────────────────────────────────────
// Run the retention sweep inline and return the summary. Useful for:
//   - operators manually reclaiming space between the nightly runs
//   - the admin UI "purge old artifacts" button
//   - smoke-testing new retention knobs without waiting for 03:00 UTC
//
// Body (optional): { "dryRun": true } — log-only, touches nothing.
//
// Runs in the same process as the API. A full sweep on a real cluster
// completes in seconds (mostly KeyDB hops + small rm calls); no need
// for a child process or background job. If a cluster ever grows to the
// point where this blocks the event loop noticeably, swap the handler
// to child_process.fork() and stream progress over SSE.
router.post('/retention/run', async (req, res, next) => {
  try {
    const dryRun = !!(req.body && req.body.dryRun);
    const caller = (req.admin && (req.admin.email || req.admin.name || req.admin.id)) || 'unknown';
    logger.info(`[admin] retention run triggered by ${caller} dryRun=${dryRun}`);
    const summary = await retention.run({ dryRun, log: logger });
    res.json({
      ok: true,
      triggeredBy: caller,
      dryRun,
      summary,
    });
  } catch (err) {
    logger.error(`[admin] retention run failed: ${err.message}`);
    next(err);
  }
});

module.exports = router;
