/**
 * PlanService — subscription tiers + feature gates + limits.
 *
 * Reads and writes the `plan` field on the shared `customer:<id>` record
 * (same key hosting/api/services/CustomerService.js owns). SpinForge's
 * hosting side doesn't care about the plan; it's SpinBuild-owned
 * metadata on a shared identity.
 *
 * No payment processor integration — operators set plans by hand via
 * PUT /api/customers/:id/plan (admin).
 *
 * Features unlock dispatcher behaviors. Current set:
 *   lxc_direct         route Nomad-eligible platforms to Proxmox LXC for
 *                      faster startup + dedicated isolation
 *   priority_dispatch  jump queue if Nomad is congested (future)
 *   mac_concurrent     allow >1 concurrent Mac build per customer (future)
 *   app_store_upload   permit publishTargets including app_store / play_production
 *
 * Limits gate quota enforcement. Null = unlimited.
 */

const PLANS = {
  free: {
    tier: 'free',
    features: [],
    limits: {
      buildsPerMonth: 50,
      macBuildMinutesPerMonth: 30,
      sessionHoursPerMonth: 10,
      artifactStorageGB: 1,
      signingProfiles: 1,
      concurrentBuilds: 1,
    },
  },
  indie: {
    tier: 'indie',
    features: ['app_store_upload'],
    limits: {
      buildsPerMonth: 500,
      macBuildMinutesPerMonth: 300,
      sessionHoursPerMonth: 50,
      artifactStorageGB: 10,
      signingProfiles: 3,
      concurrentBuilds: 2,
    },
  },
  team: {
    tier: 'team',
    features: ['app_store_upload', 'priority_dispatch'],
    limits: {
      buildsPerMonth: 3_000,
      macBuildMinutesPerMonth: 2_000,
      sessionHoursPerMonth: 300,
      artifactStorageGB: 100,
      signingProfiles: 20,
      concurrentBuilds: 5,
    },
  },
  scale: {
    tier: 'scale',
    features: ['app_store_upload', 'priority_dispatch', 'lxc_direct', 'mac_concurrent'],
    limits: {
      buildsPerMonth: null, // unlimited
      macBuildMinutesPerMonth: 10_000,
      sessionHoursPerMonth: null,
      artifactStorageGB: 1_000,
      signingProfiles: null,
      concurrentBuilds: 20,
    },
  },
  enterprise: {
    tier: 'enterprise',
    features: ['app_store_upload', 'priority_dispatch', 'lxc_direct', 'mac_concurrent'],
    limits: {
      buildsPerMonth: null,
      macBuildMinutesPerMonth: null,
      sessionHoursPerMonth: null,
      artifactStorageGB: null,
      signingProfiles: null,
      concurrentBuilds: null,
    },
  },
};

const DEFAULT_TIER = 'free';

class PlanService {
  constructor(redis, { logger } = {}) {
    this.redis = redis;
    this.logger = logger || console;
  }

  listTiers() {
    return Object.keys(PLANS);
  }

  getTier(tier) {
    return PLANS[tier] || null;
  }

  /**
   * Resolve the effective plan for a customer. Falls back to `free` if
   * the customer record doesn't exist or has no plan set. Never throws.
   */
  async resolve(customerId) {
    if (!customerId) return PLANS[DEFAULT_TIER];
    try {
      const raw = await this.redis.get(`customer:${customerId}`);
      if (!raw) return PLANS[DEFAULT_TIER];
      const customer = JSON.parse(raw);
      const tier = customer?.plan?.tier || DEFAULT_TIER;
      const base = PLANS[tier] || PLANS[DEFAULT_TIER];
      // Overrides: let an admin set per-customer bumps without changing
      // the tier (e.g. extra mac minutes for one customer). Shallow merge.
      const overrides = customer?.plan?.overrides || {};
      return {
        ...base,
        limits: { ...base.limits, ...(overrides.limits || {}) },
        features: Array.from(new Set([...(base.features || []), ...(overrides.features || [])])),
        overrides,
      };
    } catch (err) {
      this.logger.warn(`[plan] resolve ${customerId} failed: ${err.message}`);
      return PLANS[DEFAULT_TIER];
    }
  }

  hasFeature(plan, feature) {
    return !!plan && Array.isArray(plan.features) && plan.features.includes(feature);
  }

  /**
   * Set a customer's tier. Creates a minimal customer record if none
   * exists (SpinBuild + SpinForge share the customer:<id> key, so a
   * bare record is fine).
   */
  async setTier(customerId, tier, { overrides } = {}) {
    if (!PLANS[tier]) {
      throw Object.assign(new Error(`unknown tier: ${tier}`), { status: 400, expose: true });
    }
    const raw = await this.redis.get(`customer:${customerId}`);
    const customer = raw ? JSON.parse(raw) : {
      id: customerId,
      createdAt: new Date().toISOString(),
      isActive: true,
      metadata: {},
      limits: {},
    };
    customer.plan = {
      tier,
      overrides: overrides || customer.plan?.overrides || {},
      updatedAt: new Date().toISOString(),
    };
    customer.updatedAt = new Date().toISOString();
    await this.redis.set(`customer:${customerId}`, JSON.stringify(customer));
    if (!raw) await this.redis.sAdd('customers', customerId);
    return this.resolve(customerId);
  }
}

module.exports = PlanService;
module.exports.PLANS = PLANS;
module.exports.DEFAULT_TIER = DEFAULT_TIER;
