/**
 * Customer policy routes.
 *
 * One policy doc per customer. Partners (the billing/ops surface) write
 * quotas and feature flags here; SpinBuild + SpinForge enforcement code
 * reads them at decision points via CustomerPolicyService.get().
 *
 * Auth: admin-gated once O4 lands (see PLATFORM_PLAN.md). The PUT is
 * never customer-facing.
 */

const express = require('express');
const CustomerPolicyService = require('../services/CustomerPolicyService');
const logger = require('../utils/logger');
const redis = require('../utils/redis');

const router = express.Router();

// Cap responses to keep the payload sane; warn past this so operators see
// when the customer set outgrows the assumption.
const LIST_CAP = 200;

function currentYyyymm() {
  return new Date().toISOString().slice(0, 7).replace('-', '');
}

// ─── GET /api/customers ────────────────────────────────────────────────
// List all customers that have a policy doc, with live counters. Drives
// the admin UI's Customers page. Safe upper bound at LIST_CAP.
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || LIST_CAP, LIST_CAP);
    const ids = [];
    for await (const key of redis.scanIterator({
      MATCH: 'customer:*:policy',
      COUNT: 200,
    })) {
      // Key shape: customer:<id>:policy — extract the middle segment.
      const parts = key.split(':');
      if (parts.length < 3) continue;
      // Rejoin everything between 'customer:' and ':policy' so ids
      // containing ':' (unlikely, but cheap to handle) survive.
      const id = parts.slice(1, -1).join(':');
      if (id) ids.push(id);
    }
    if (ids.length > LIST_CAP) {
      logger.warn(`[customers] ${ids.length} customers found; truncating to ${LIST_CAP}`);
    }
    const selected = ids.slice(0, limit);
    const yyyymm = currentYyyymm();

    const customers = [];
    for (const id of selected) {
      try {
        const [policy, activeJobs, monthlyUsage] = await Promise.all([
          CustomerPolicyService.get(id),
          redis.sCard(`customer:${id}:active`),
          redis.hGetAll(`customer:${id}:usage:${yyyymm}`),
        ]);
        customers.push({
          id,
          policy,
          activeJobs: Number(activeJobs) || 0,
          monthlyUsage: monthlyUsage || {},
        });
      } catch (err) {
        logger.warn(`[customers] failed to load ${id}: ${err.message}`);
      }
    }

    res.json({ customers, total: ids.length });
  } catch (err) { next(err); }
});

// ─── GET /api/customers/:id/policy ────────────────────────────────────
router.get('/:id/policy', async (req, res, next) => {
  try {
    const policy = await CustomerPolicyService.get(req.params.id);
    res.json({ customerId: req.params.id, policy });
  } catch (err) { next(err); }
});

// ─── PUT /api/customers/:id/policy ────────────────────────────────────
router.put('/:id/policy', async (req, res, next) => {
  try {
    const policy = await CustomerPolicyService.put(req.params.id, req.body);
    res.json({ customerId: req.params.id, policy });
  } catch (err) {
    // Validation errors from CustomerPolicyService surface as 400.
    if (err && /must (be|have)|required/.test(err.message)) {
      return res.status(400).json({ error: 'invalid_policy', message: err.message });
    }
    next(err);
  }
});

module.exports = router;
