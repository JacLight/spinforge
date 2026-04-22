/**
 * BillingService — usage metering + quota enforcement.
 *
 * No payment processor, no invoices. Just accurate, queryable usage
 * counts per (customer, project, job) so operators can bill externally
 * and quotas can gate dispatch.
 *
 * Key hierarchy in KeyDB:
 *
 *   Customer monthly rollup
 *     usage:<customerId>:<YYYY-MM>                hash
 *       buildCount, buildDurationSec,
 *       macBuildDurationSec, linuxBuildDurationSec,
 *       androidBuildDurationSec,
 *       artifactBytes, sessionDurationSec,
 *       buildsSucceeded, buildsFailed, buildsCanceled
 *
 *   Project monthly rollup (subset of above)
 *     usage:<customerId>:<projectId>:<YYYY-MM>    hash
 *
 *   Sorted index of recent months (for dashboard enumeration)
 *     usage:index:<customerId>                    zset (score = month-as-int)
 *
 *   Immutable per-job usage snapshot (written on terminal transition)
 *     stored ON the job record (`job.usage = {...}`) so reads are a
 *     single GET. Also appended as a `billing.job` event on
 *     platform:events for the audit trail.
 *
 *   Active-build count for concurrency quota
 *     usage:active:<customerId>                   set of jobIds (SADD on
 *       running, SREM on terminal). Cardinality = concurrency.
 *
 * All writes use HINCRBY / SADD / SREM — atomic under KeyDB multi-master
 * (no Lua scripts that depend on single-master semantics).
 */

const MAC_PLATFORMS = new Set(['ios', 'macos']);
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'canceled', 'timeout']);

class BillingService {
  constructor(redis, { plans, events, logger } = {}) {
    this.redis = redis;
    this.plans = plans || null; // PlanService, required for quota checks
    this.events = events || null;
    this.logger = logger || console;
  }

  // ─── Metering ─────────────────────────────────────────────────────────

  /**
   * Called by JobService on every state transition. Only the terminal
   * transitions increment the monthly counters; running just marks the
   * job active for concurrency accounting.
   */
  async recordJobTransition(job, oldStatus) {
    if (!job) return;
    const customerId = job.customerId;
    if (!customerId) return;

    try {
      if (job.status === 'running' && oldStatus !== 'running') {
        await this.redis.sAdd(`usage:active:${customerId}`, job.id);
      }

      if (TERMINAL_STATUSES.has(job.status) && !TERMINAL_STATUSES.has(oldStatus)) {
        await this.redis.sRem(`usage:active:${customerId}`, job.id);
        await this._recordTerminalJob(job);
      }
    } catch (err) {
      // Never break job flow because billing failed.
      this.logger.error(`[billing] recordJobTransition ${job.id}: ${err.message}`);
    }
  }

  async recordArtifactBytes(job, bytes) {
    if (!job || !bytes || bytes <= 0) return;
    const period = monthOf(new Date());
    await this._hincr(job.customerId, job.projectId, period, {
      artifactBytes: bytes,
    });
  }

  async recordSessionEnded(session) {
    if (!session || !session.userId) return;
    const duration = session.startedAt && session.destroyedAt
      ? Math.max(0, Math.round(
          (new Date(session.destroyedAt) - new Date(session.startedAt)) / 1000
        ))
      : 0;
    const period = monthOf(new Date());
    // Sessions live under the user — we treat the session userId as
    // "customerId" for usage accounting unless session-manager passes
    // a customerId in metadata.
    const customerId = session.metadata?.customerId || session.userId;
    await this._hincr(customerId, session.metadata?.projectId, period, {
      sessionDurationSec: duration,
      sessionCount: 1,
    });
    if (this.events) {
      this.events.publish('billing.session_ended', session.id, {
        context: {
          customerId,
          projectId: session.metadata?.projectId || null,
          durationSec: duration,
        },
      }).catch(() => {});
    }
  }

  // ─── Queries ──────────────────────────────────────────────────────────

  async getUsage(customerId, { from, to, projectId } = {}) {
    const months = monthsBetween(from, to);
    const out = {
      from: months[0],
      to: months[months.length - 1],
      months: {},
      totals: emptyTotals(),
    };
    for (const m of months) {
      const key = projectId
        ? `usage:${customerId}:${projectId}:${m}`
        : `usage:${customerId}:${m}`;
      const raw = await this.redis.hGetAll(key);
      const asNumbers = {};
      for (const [k, v] of Object.entries(raw)) asNumbers[k] = Number(v) || 0;
      out.months[m] = asNumbers;
      for (const [k, v] of Object.entries(asNumbers)) {
        out.totals[k] = (out.totals[k] || 0) + v;
      }
    }
    return out;
  }

  async getActiveBuildCount(customerId) {
    return this.redis.sCard(`usage:active:${customerId}`);
  }

  // ─── Quota enforcement ───────────────────────────────────────────────

  /**
   * Called before dispatch. Returns { ok: true } or
   * { ok: false, reason, resource, current, limit } with 402-worthy
   * details. Does not throw — caller decides how to respond.
   */
  async checkBuildQuota(customerId, { platform } = {}) {
    if (!this.plans) return { ok: true, reason: 'no_plan_service' };
    const plan = await this.plans.resolve(customerId);

    const period = monthOf(new Date());
    const monthly = await this.redis.hGetAll(`usage:${customerId}:${period}`);
    const used = {
      buildCount: Number(monthly.buildCount || 0),
      macBuildDurationSec: Number(monthly.macBuildDurationSec || 0),
    };
    const active = await this.getActiveBuildCount(customerId);

    // buildsPerMonth
    if (plan.limits.buildsPerMonth != null && used.buildCount >= plan.limits.buildsPerMonth) {
      return {
        ok: false,
        reason: 'builds_per_month_exceeded',
        resource: 'buildsPerMonth',
        current: used.buildCount,
        limit: plan.limits.buildsPerMonth,
        tier: plan.tier,
      };
    }

    // macBuildMinutes
    if (MAC_PLATFORMS.has(platform) && plan.limits.macBuildMinutesPerMonth != null) {
      const used_min = used.macBuildDurationSec / 60;
      if (used_min >= plan.limits.macBuildMinutesPerMonth) {
        return {
          ok: false,
          reason: 'mac_build_minutes_exceeded',
          resource: 'macBuildMinutesPerMonth',
          current: Math.round(used_min),
          limit: plan.limits.macBuildMinutesPerMonth,
          tier: plan.tier,
        };
      }
    }

    // concurrentBuilds
    if (plan.limits.concurrentBuilds != null && active >= plan.limits.concurrentBuilds) {
      return {
        ok: false,
        reason: 'concurrent_builds_exceeded',
        resource: 'concurrentBuilds',
        current: active,
        limit: plan.limits.concurrentBuilds,
        tier: plan.tier,
      };
    }

    return { ok: true, plan, active };
  }

  // ─── Private ─────────────────────────────────────────────────────────

  async _recordTerminalJob(job) {
    const now = new Date();
    const period = monthOf(now);
    const durationSec = job.metrics?.durationSec
      || (job.startedAt && job.completedAt
        ? Math.max(0, Math.round((new Date(job.completedAt) - new Date(job.startedAt)) / 1000))
        : 0);

    const platformKey = MAC_PLATFORMS.has(job.platform) ? 'mac'
      : job.platform === 'android' ? 'android'
      : 'linux';

    const outcomeKey = job.status === 'succeeded' ? 'buildsSucceeded'
      : job.status === 'failed' ? 'buildsFailed'
      : 'buildsCanceled';

    const increments = {
      buildCount: 1,
      buildDurationSec: durationSec,
      [`${platformKey}BuildDurationSec`]: durationSec,
      [outcomeKey]: 1,
    };

    await this._hincr(job.customerId, job.projectId, period, increments);

    // Immutable per-job snapshot on the record itself.
    const usage = {
      durationSec,
      platform: job.platform,
      runnerClass: job.dispatchRoute || (job.platform === 'ios' || job.platform === 'macos' ? 'mac' : 'nomad-docker'),
      outcome: job.status,
      recordedAt: now.toISOString(),
      period,
    };
    try {
      const raw = await this.redis.get(`job:${job.id}`);
      if (raw) {
        const rec = JSON.parse(raw);
        rec.usage = usage;
        await this.redis.set(`job:${job.id}`, JSON.stringify(rec));
      }
    } catch (err) {
      this.logger.warn(`[billing] could not persist job.usage on ${job.id}: ${err.message}`);
    }

    if (this.events) {
      this.events.publish('billing.job', job.id, {
        context: {
          customerId: job.customerId,
          projectId: job.projectId || null,
          ...usage,
        },
      }).catch(() => {});
    }
  }

  async _hincr(customerId, projectId, period, increments) {
    const ops = [];
    const customerKey = `usage:${customerId}:${period}`;
    for (const [field, delta] of Object.entries(increments)) {
      if (!delta) continue;
      ops.push(this.redis.hIncrBy(customerKey, field, delta));
    }
    if (projectId) {
      const projKey = `usage:${customerId}:${projectId}:${period}`;
      for (const [field, delta] of Object.entries(increments)) {
        if (!delta) continue;
        ops.push(this.redis.hIncrBy(projKey, field, delta));
      }
    }
    // Index the period so enumerating months for dashboards doesn't need
    // a SCAN. Score is YYYYMM-as-int for range queries.
    ops.push(
      this.redis.zAdd(`usage:index:${customerId}`, {
        score: Number(period.replace('-', '')),
        value: period,
      })
    );
    await Promise.all(ops);
  }
}

function monthOf(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthsBetween(from, to) {
  const now = new Date();
  const fromDate = from ? parseYM(from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const toDate = to ? parseYM(to) : fromDate;
  const result = [];
  const cur = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), 1));
  while (cur <= end) {
    result.push(monthOf(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return result.length ? result : [monthOf(now)];
}

function parseYM(s) {
  const [y, m] = String(s).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1));
}

function emptyTotals() {
  return {
    buildCount: 0,
    buildDurationSec: 0,
    macBuildDurationSec: 0,
    linuxBuildDurationSec: 0,
    androidBuildDurationSec: 0,
    sessionDurationSec: 0,
    sessionCount: 0,
    artifactBytes: 0,
    buildsSucceeded: 0,
    buildsFailed: 0,
    buildsCanceled: 0,
  };
}

module.exports = BillingService;
module.exports.monthOf = monthOf;
module.exports.monthsBetween = monthsBetween;
