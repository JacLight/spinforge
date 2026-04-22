/**
 * Job model + state machine + per-job event/log streams.
 *
 * Record shape: see PLATFORM_PLAN.md §5.
 * KeyDB keys owned by this service:
 *   job:<id>              JSON record (the durable state)
 *   job:<id>:events       capped stream — lifecycle + progress (SSE source)
 *   job:<id>:log          capped stream — stdout lines only (high volume)
 *   job:by-customer:<id>  sorted set of jobIds by createdAt
 *
 * The service also publishes high-level transitions to the shared
 * `platform:events` stream via the injected EventStream, so operators
 * see hosting + building activity in one timeline.
 */

const { ulid } = require('ulid');
const UsageEventEmitter = require('./UsageEventEmitter');
const metrics = require('../utils/metrics');

const JOB_EVENTS_MAXLEN = 5_000;
const JOB_LOG_MAXLEN = 10_000;

// Monthly usage hash TTL. 90 days gives partners a window to reconcile
// after month-end before the record disappears. Policy enforcement only
// reads the current month's row, so older rows are advisory.
const USAGE_HASH_TTL_SEC = 90 * 24 * 3600;

// Infer a coarse runner class for usage events / logs. Nomad Mac path
// covers ios/macos; Proxmox LXC surfaces via job.dispatchRoute once the
// dispatcher writes it; everything else is the Nomad docker path.
function inferRunnerClass(job) {
  if (job.platform === 'ios' || job.platform === 'macos') return 'macos';
  if (job.dispatchRoute === 'proxmox-lxc') return 'lxc';
  if (job.dispatchRoute === 'nomad') return 'nomad-docker';
  return 'lxc';
}

function currentYyyymm() {
  return new Date().toISOString().slice(0, 7).replace('-', '');
}

// Status transitions allowed. Terminal states have no outgoing edges.
const ALLOWED = {
  queued:    new Set(['assigned', 'canceled', 'failed']),
  assigned:  new Set(['running', 'canceled', 'failed']),
  running:   new Set(['succeeded', 'failed', 'timeout', 'canceled']),
  succeeded: new Set(),
  failed:    new Set(),
  canceled:  new Set(),
  timeout:   new Set(),
};

const TERMINAL = new Set(['succeeded', 'failed', 'canceled', 'timeout']);

class JobService {
  constructor(redis, { logger, events } = {}) {
    this.redis = redis;
    this.logger = logger || console;
    this.events = events || null;
    // Optional callback fired once per job on terminal transitions. Used
    // by DeploymentService to react to build completion without subscribing
    // to the platform:events stream. Signature:
    //   onTerminal(jobId, status, { error, job })
    // Always invoked fire-and-forget; errors are caught and logged.
    this.onTerminal = null;
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────

  async create({ customerId, projectId, platform, targets, framework, signingProfileId, source, manifest }) {
    if (!customerId) throw new Error('customerId is required');
    if (!platform) throw new Error('platform is required');

    const id = `job_${ulid()}`;
    const record = {
      id,
      customerId,
      projectId: projectId || null,
      source: source || 'api',
      platform,
      targets: targets || [],
      framework: framework || null,
      signingProfileId: signingProfileId || null,
      manifest: manifest || {},
      workspaceUri: `file:///data/workspaces/${id}.zip`,
      status: 'queued',
      runnerId: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      artifacts: [],
      metrics: { durationSec: null, bytesOut: null },
      // Per-job usage snapshot. Written by task 122 (policy enforcement)
      // when terminal transitions fire. Left null at create time.
      usage: null,
    };

    await this.redis.set(`job:${id}`, JSON.stringify(record));
    await this.redis.zAdd(`job:by-customer:${customerId}`, {
      score: Date.now(),
      value: id,
    });
    if (projectId) {
      await this.redis.zAdd(`job:by-project:${customerId}:${projectId}`, {
        score: Date.now(),
        value: id,
      });
    }
    // Global recent-jobs index (for the admin UI list). Capped at 1000 —
    // anything beyond that gets trimmed on the next create.
    await this.redis.zAdd('jobs:recent', { score: Date.now(), value: id });
    await this.redis.zRemRangeByRank('jobs:recent', 0, -1001);

    await this._appendEvent(id, 'job.created', { platform, customerId });
    if (this.events) {
      this.events.publish('job.created', id, {
        context: { customerId, platform },
      }).catch(() => {});
    }

    // Prometheus: a new queued job joined the pipeline. Duration is
    // computed at terminal from record timestamps (timers can't persist
    // across process restarts, so we observe the histogram on transition
    // using the already-stored createdAt/completedAt — same basis as the
    // in-record durationSec).
    try {
      metrics.queueDepth.inc({ platform });
    } catch (err) {
      this.logger.warn(`[job ${id}] metrics queueDepth.inc failed: ${err.message}`);
    }

    return record;
  }

  async get(id) {
    const raw = await this.redis.get(`job:${id}`);
    return raw ? JSON.parse(raw) : null;
  }

  async listRecent({ limit = 50 } = {}) {
    const ids = await this.redis.zRange('jobs:recent', -limit, -1, { REV: true });
    const jobs = [];
    for (const id of ids) {
      const job = await this.get(id);
      if (job) jobs.push(job);
    }
    return jobs;
  }

  /**
   * Paginated list with optional filters. Drives GET /api/jobs for the
   * admin UI. Reads the chronological `jobs:recent` ZSET (newest first)
   * and, when filters are supplied, walks a sliding window to gather
   * enough matches to satisfy limit.
   *
   * If `customerId` is given, we use `job:by-customer:<id>` instead —
   * same ZSET shape, already indexed per-customer.
   *
   * Returns { jobs, total } where total is:
   *   - ZCARD of the source index (unfiltered counts only), or
   *   - the count of matches we were able to find within a reasonable
   *     scan window when post-filters are applied.
   */
  async list({ customerId = null, status = null, platform = null, limit = 50, offset = 0 } = {}) {
    const lim = Math.max(1, Math.min(Number(limit) || 50, 500));
    const off = Math.max(0, Number(offset) || 0);

    const sourceKey = customerId
      ? `job:by-customer:${customerId}`
      : 'jobs:recent';

    const total = await this.redis.zCard(sourceKey);

    // Fast path: no post-filters. Slice directly from the ZSET.
    if (!status && !platform) {
      // zRange newest-first: REV + BYSCORE not needed — we just reverse rank.
      // Use negative indexing: [-(off+lim) .. -(off+1)] with REV.
      const start = -(off + lim);
      const stop = -(off + 1);
      if (total === 0 || off >= total) return { jobs: [], total };
      const ids = await this.redis.zRange(sourceKey, start, stop, { REV: true });
      const jobs = [];
      for (const id of ids) {
        const job = await this.get(id);
        if (job) jobs.push(job);
      }
      return { jobs, total };
    }

    // Filtered path: scan newest-first in pages until we have enough matches
    // to satisfy offset + limit. Cap total scanned so an unindexed filter
    // can't sweep the whole index on each call.
    const PAGE = 200;
    const MAX_SCAN = 2000;
    const wanted = off + lim;
    const matched = [];
    let seen = 0;
    while (seen < MAX_SCAN && matched.length < wanted) {
      const ids = await this.redis.zRange(
        sourceKey,
        -(seen + PAGE),
        -(seen + 1),
        { REV: true }
      );
      if (!ids || ids.length === 0) break;
      for (const id of ids) {
        const job = await this.get(id);
        if (!job) continue;
        if (status && job.status !== status) continue;
        if (platform && job.platform !== platform) continue;
        matched.push(job);
        if (matched.length >= wanted) break;
      }
      seen += ids.length;
      if (ids.length < PAGE) break;
    }
    return { jobs: matched.slice(off, off + lim), total: matched.length };
  }

  async listByCustomer(customerId, { limit = 50, offset = 0 } = {}) {
    const ids = await this.redis.zRange(
      `job:by-customer:${customerId}`,
      -(offset + limit),
      -(offset + 1),
      { REV: true }
    );
    const jobs = [];
    for (const id of ids) {
      const job = await this.get(id);
      if (job) jobs.push(job);
    }
    return jobs;
  }

  /**
   * Shallow-merge arbitrary fields into the persisted job record.
   *
   * Used by the dispatch path to record nomadJobId / evalId / route
   * without running a status transition (those aren't state-machine
   * events). Does NOT validate the shape — callers are expected to pass
   * safe keys. Status changes must still go through transition().
   */
  async update(id, patch = {}) {
    const current = await this.get(id);
    if (!current) {
      const err = new Error(`job ${id} not found`);
      err.status = 404;
      throw err;
    }
    if (!patch || typeof patch !== 'object') return current;
    // Don't let callers slip a status change through here — it would
    // bypass the transition validator, usage hooks, and metrics.
    const safe = { ...patch };
    delete safe.status;
    const next = { ...current, ...safe, updatedAt: new Date().toISOString() };
    await this.redis.set(`job:${id}`, JSON.stringify(next));
    return next;
  }

  // ─── State machine ─────────────────────────────────────────────────────

  async transition(id, newStatus, extra = {}) {
    const current = await this.get(id);
    if (!current) {
      const err = new Error(`job ${id} not found`);
      err.status = 404;
      throw err;
    }

    const allowed = ALLOWED[current.status];
    if (!allowed) {
      const err = new Error(`job ${id} has unknown status "${current.status}"`);
      err.status = 500;
      throw err;
    }
    if (!allowed.has(newStatus)) {
      const err = new Error(
        `invalid transition: ${current.status} → ${newStatus} for job ${id}`
      );
      err.status = 409;
      throw err;
    }

    const now = new Date().toISOString();
    const patch = { status: newStatus, updatedAt: now, ...extra };
    if (newStatus === 'running' && !current.startedAt) patch.startedAt = now;
    if (TERMINAL.has(newStatus)) {
      patch.completedAt = now;
      if (current.startedAt) {
        patch.metrics = {
          ...(current.metrics || {}),
          durationSec: Math.round(
            (new Date(now) - new Date(current.startedAt)) / 1000
          ),
        };
      }
    }

    const next = { ...current, ...patch };
    await this.redis.set(`job:${id}`, JSON.stringify(next));

    const eventType = `job.${newStatus}`;
    await this._appendEvent(id, eventType, extra);
    if (this.events) {
      const severity = newStatus === 'failed' || newStatus === 'timeout'
        ? 'error'
        : newStatus === 'canceled' ? 'warn' : 'info';
      this.events.publish(eventType, id, {
        severity,
        context: { customerId: current.customerId, platform: current.platform, ...extra },
      }).catch(() => {});
    }

    // Policy / usage hook (task 122).
    // - On "running": emit job.started so partners see live activity.
    // - On terminal: release the concurrency slot, update the monthly
    //   usage hash CustomerPolicyService.checkJobDispatch reads, and
    //   emit a job.<status> event with cpu_seconds / build_seconds /
    //   artifact_bytes totals. Errors are swallowed — the state
    //   transition itself already succeeded, and losing a usage event
    //   must not corrupt the job record.
    try {
      if (newStatus === 'running') {
        await UsageEventEmitter.emit({
          customerId: next.customerId,
          type: 'job.started',
          jobId: id,
          platform: next.platform,
          runnerClass: inferRunnerClass(next),
          runnerId: next.runnerId || null,
        });
      } else if (TERMINAL.has(newStatus)) {
        await this._recordTerminalUsage(next, extra);
      }
    } catch (err) {
      this.logger.error(`[job ${id}] usage hook (${newStatus}) failed: ${err.message}`);
    }

    // Prometheus: mirror the lifecycle onto metrics. Kept in its own
    // try/except block because a metric failure must never corrupt the
    // transition or cascade into the usage hook above.
    try {
      const platform = next.platform;
      const runnerClass = inferRunnerClass(next);

      // Leaving the queue (first transition out of 'queued') — bookkeep
      // queueDepth and record wait time from created → dispatch.
      if (current.status === 'queued' && newStatus !== 'queued') {
        metrics.queueDepth.dec({ platform });
        if (current.createdAt) {
          const waitSec = (new Date(now) - new Date(current.createdAt)) / 1000;
          metrics.jobQueueWait.observe(
            { platform, runner_class: runnerClass },
            Math.max(0, waitSec)
          );
        }
      }

      // Entering running — active gauge goes up. A job can pass through
      // `assigned` without ever reaching running (e.g. canceled early),
      // so we only inc on the running transition itself.
      if (newStatus === 'running') {
        metrics.activeJobs.inc({ platform });
      }

      // Terminal: tally jobsTotal, observe durationSec (from the patch we
      // just applied — not the timer), dec activeJobs if we had inc'd it
      // on running, and credit artifact bytes that are already recorded.
      if (TERMINAL.has(newStatus)) {
        metrics.jobsTotal.inc({ platform, status: newStatus, runner_class: runnerClass });
        const durationSec = patch.metrics && typeof patch.metrics.durationSec === 'number'
          ? patch.metrics.durationSec
          : (current.metrics && typeof current.metrics.durationSec === 'number'
            ? current.metrics.durationSec
            : null);
        if (durationSec !== null && durationSec >= 0) {
          metrics.jobDuration.observe(
            { platform, status: newStatus, runner_class: runnerClass },
            durationSec
          );
        }
        // Only dec activeJobs if the job actually ran. Jobs that went
        // queued→canceled never entered the active gauge.
        if (current.startedAt) {
          metrics.activeJobs.dec({ platform });
        }
        // artifactBytes is credited in recordArtifact() — each artifact
        // is counted once at registration, independent of terminal state.
      }
    } catch (err) {
      this.logger.warn(`[job ${id}] prom metrics (${newStatus}) failed: ${err.message}`);
    }

    // Terminal-only extensibility hook. Wired by server.js so a build
    // job that belongs to a Deployment can advance its parent's state
    // machine. Kept separate from the usage + metrics blocks so a
    // misbehaving consumer can never corrupt those.
    if (TERMINAL.has(newStatus) && typeof this.onTerminal === 'function') {
      try {
        Promise.resolve(this.onTerminal(id, newStatus, { error: extra?.reason || extra?.error, job: next }))
          .catch((err) => this.logger.warn(`[job ${id}] onTerminal(${newStatus}) rejected: ${err.message}`));
      } catch (err) {
        this.logger.warn(`[job ${id}] onTerminal(${newStatus}) threw: ${err.message}`);
      }
    }

    return next;
  }

  /**
   * Terminal-transition side effects: release the concurrency slot,
   * bump monthly counters, and emit the per-job usage event.
   *
   * cpu_seconds: prefer extra.cpu_seconds reported by the allocator
   * (Nomad alloc stats, Proxmox rrddata). Fall back to durationSec ×
   * requested cores as a proxy so quotas still advance in test/dev.
   *
   * build_seconds: wall-clock durationSec from the transition patch.
   *
   * artifact_bytes: sum of recorded artifact.bytes on the job record.
   * Artifacts recorded after terminal transition (should not happen) are
   * accounted for separately by recordArtifact's own event.
   */
  async _recordTerminalUsage(job, extra = {}) {
    const { customerId, id: jobId } = job;
    if (!customerId) return;

    // 1. Release the concurrency slot. Symmetric with SADD in the POST
    //    handler — every create that succeeds adds; every terminal
    //    transition removes.
    try {
      await this.redis.sRem(`customer:${customerId}:active`, jobId);
    } catch (err) {
      this.logger.warn(`[job ${jobId}] sRem active set failed: ${err.message}`);
    }

    // 2. Compute usage.
    const durationSec = job.metrics?.durationSec ?? 0;
    const durationMs = durationSec * 1000;
    const requestedCores =
      Number(job.manifest?.cpuCores) ||
      Number(job.resources?.cpuCores) ||
      1;
    const reportedCpuSec =
      Number(extra.cpu_seconds) ||
      Number(job.alloc?.cpu_seconds) ||
      0;
    const cpuSeconds = reportedCpuSec > 0
      ? reportedCpuSec
      : durationSec * requestedCores;
    const buildSeconds = durationSec;
    const artifactBytes = Array.isArray(job.artifacts)
      ? job.artifacts.reduce((sum, a) => sum + (Number(a.bytes) || 0), 0)
      : 0;
    const status = job.status;

    // 3. Persist the per-job usage snapshot on the record itself so
    //    GET /api/jobs/:id/usage returns a stable view.
    try {
      const withUsage = {
        ...job,
        usage: {
          cpu_seconds: Math.ceil(cpuSeconds),
          build_seconds: Math.ceil(buildSeconds),
          duration_ms: durationMs,
          artifact_bytes: artifactBytes,
          runnerClass: inferRunnerClass(job),
          runnerId: job.runnerId || null,
          recordedAt: new Date().toISOString(),
        },
      };
      await this.redis.set(`job:${jobId}`, JSON.stringify(withUsage));
    } catch (err) {
      this.logger.warn(`[job ${jobId}] usage snapshot write failed: ${err.message}`);
    }

    // 4. Atomic monthly counters. CustomerPolicyService reads these at
    //    the next dispatch check for this customer.
    try {
      const yyyymm = currentYyyymm();
      const key = `customer:${customerId}:usage:${yyyymm}`;
      await this.redis.hIncrBy(key, 'cpu_seconds', Math.ceil(cpuSeconds));
      await this.redis.hIncrBy(key, 'build_seconds', Math.ceil(buildSeconds));
      await this.redis.hIncrBy(key, 'artifact_bytes', artifactBytes);
      await this.redis.hIncrBy(key, 'jobs_total', 1);
      await this.redis.hIncrBy(key, `jobs_${status}`, 1);
      await this.redis.expire(key, USAGE_HASH_TTL_SEC);
    } catch (err) {
      this.logger.warn(`[job ${jobId}] usage HINCRBY failed: ${err.message}`);
    }

    // 5. Stream event for partners. Schema matches UsageEventEmitter —
    //    every field is stringified on the wire.
    try {
      await UsageEventEmitter.emit({
        customerId,
        type: `job.${status}`,
        jobId,
        platform: job.platform,
        cpu_seconds: Math.ceil(cpuSeconds),
        build_seconds: Math.ceil(buildSeconds),
        artifact_bytes: artifactBytes,
        duration_ms: durationMs,
        runnerClass: inferRunnerClass(job),
        runnerId: job.runnerId || null,
      });
    } catch (err) {
      this.logger.warn(`[job ${jobId}] usage emit failed: ${err.message}`);
    }
  }

  async recordArtifact(id, { path, sha256, bytes, kind }) {
    const current = await this.get(id);
    if (!current) throw Object.assign(new Error('not_found'), { status: 404 });
    const artifact = { path, sha256, bytes, kind, createdAt: new Date().toISOString() };
    const next = { ...current, artifacts: [...(current.artifacts || []), artifact] };
    await this.redis.set(`job:${id}`, JSON.stringify(next));
    await this._appendEvent(id, 'job.artifact', artifact);

    // Partner meter event — artifact storage bytes. Independent of the
    // terminal job.<status> event so partners can track per-artifact
    // storage even for jobs that produce several over a single run.
    try {
      await UsageEventEmitter.emit({
        customerId: current.customerId,
        type: 'artifact.recorded',
        jobId: id,
        platform: current.platform,
        bytes: Number(bytes) || 0,
        kind: kind || null,
      });
    } catch (err) {
      this.logger.warn(`[job ${id}] artifact usage emit failed: ${err.message}`);
    }

    // Prometheus: each artifact contributes its bytes exactly once. The
    // terminal transition doesn't re-sum, so jobs with multiple artifacts
    // still land on the real total.
    try {
      const n = Number(bytes) || 0;
      if (n > 0) metrics.artifactBytes.inc({ platform: current.platform }, n);
    } catch (err) {
      this.logger.warn(`[job ${id}] metrics artifactBytes.inc failed: ${err.message}`);
    }

    return artifact;
  }

  // ─── Streams ───────────────────────────────────────────────────────────

  async appendLog(id, line, { stream = 'stdout' } = {}) {
    if (!line) return;
    try {
      await this.redis.xAdd(
        `job:${id}:log`,
        '*',
        { stream: String(stream), line: String(line).slice(0, 8_000) },
        { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: JOB_LOG_MAXLEN } }
      );
    } catch (err) {
      this.logger.error(`[job ${id}] appendLog failed: ${err.message}`);
    }
  }

  /**
   * Tail the per-job event stream. Blocking reads stall whichever client
   * runs them, so SSE handlers must pass a dedicated `client`
   * (`redis.duplicate()`); the shared client must not block.
   */
  async tailEvents(id, lastId = '$', { limit = 200, blockMs = 5000, client } = {}) {
    const r = client || this.redis;
    try {
      const res = await r.xRead(
        { key: `job:${id}:events`, id: lastId },
        { COUNT: limit, BLOCK: blockMs }
      );
      if (!res) return { events: [], lastId };
      const messages = (res[0] && res[0].messages) || [];
      const events = messages.map((m) => ({ id: m.id, ...m.message }));
      const newLast = events.length ? events[events.length - 1].id : lastId;
      return { events, lastId: newLast };
    } catch (err) {
      this.logger.error(`[job ${id}] tailEvents failed: ${err.message}`);
      return { events: [], lastId };
    }
  }

  async recentEvents(id, limit = 200) {
    try {
      const rows = await this.redis.xRevRange(`job:${id}:events`, '+', '-', { COUNT: limit });
      return (rows || []).map((r) => ({ id: r.id, ...r.message })).reverse();
    } catch (err) {
      this.logger.error(`[job ${id}] recentEvents failed: ${err.message}`);
      return [];
    }
  }

  /**
   * One-time backfill for the `jobs:recent` ZSET. Walks all existing
   * `job:by-customer:*` sorted sets and re-adds their members to the
   * global index with their original score. Safe to run repeatedly
   * (ZADD is idempotent by member). Skips work if the global index is
   * already populated.
   *
   * Called once at startup from server.js — no-op after the first
   * successful run.
   */
  async backfillRecentIndex({ logger } = {}) {
    const log = logger || this.logger;
    try {
      const existing = await this.redis.zCard('jobs:recent');
      if (existing > 0) return { added: 0, skipped: true };
      let added = 0;
      for await (const key of this.redis.scanIterator({
        MATCH: 'job:by-customer:*',
        COUNT: 500,
      })) {
        // Each entry: member=jobId, score=createdAtMs. Keep scores intact
        // so newest-first ordering survives the migration.
        const withScores = await this.redis.zRangeWithScores(key, 0, -1);
        for (const { value, score } of withScores) {
          await this.redis.zAdd('jobs:recent', { score, value });
          added++;
        }
      }
      // Cap to 1000 just like create() does.
      await this.redis.zRemRangeByRank('jobs:recent', 0, -1001);
      log.info(`[jobs] backfillRecentIndex added ${added} jobs`);
      return { added, skipped: false };
    } catch (err) {
      log.warn(`[jobs] backfillRecentIndex failed: ${err.message}`);
      return { added: 0, skipped: false, error: err.message };
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  async _appendEvent(id, type, context = {}) {
    try {
      await this.redis.xAdd(
        `job:${id}:events`,
        '*',
        {
          type: String(type),
          ts: new Date().toISOString(),
          context: JSON.stringify(context).slice(0, 2000),
        },
        { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: JOB_EVENTS_MAXLEN } }
      );
    } catch (err) {
      this.logger.error(`[job ${id}] _appendEvent(${type}) failed: ${err.message}`);
    }
  }
}

module.exports = JobService;
module.exports.ALLOWED_TRANSITIONS = ALLOWED;
module.exports.TERMINAL_STATES = TERMINAL;
module.exports.JOB_EVENTS_MAXLEN = JOB_EVENTS_MAXLEN;
module.exports.JOB_LOG_MAXLEN = JOB_LOG_MAXLEN;
