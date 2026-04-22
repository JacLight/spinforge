#!/usr/bin/env node
/**
 * SpinBuild — artifact + workspace retention sweep.
 *
 * Ceph would fill within a week of launch if nothing ever cleaned up build
 * outputs. This script is the janitor. It runs as a Nomad `batch` / `periodic`
 * job (see infra/nomad/jobs/artifact-retention.nomad.hcl) every night at
 * 03:00 UTC, and can also be kicked on demand via
 * POST /api/admin/retention/run.
 *
 * Policy knobs consulted (CustomerPolicyService.DEFAULT_POLICY.build):
 *   - keepSuccessfulBuilds     : keep N most-recent succeeded jobs' files
 *   - keepFailedBuildsHours    : keep failed jobs' files for this many hours
 *   - workspaceRetentionHours  : delete workspace after job ends + N hours
 *
 * Safety contract:
 *   - Only TERMINAL jobs are swept. A job whose status is still `queued`,
 *     `assigned`, or `running` is never touched — even if its createdAt is
 *     ancient, because a stuck watchdog might still resurrect it. Operators
 *     should cancel or fail stuck jobs first.
 *   - Job records themselves are kept. Only the bulky files under
 *     /data/artifacts/<jobId>/ and /data/workspaces/<jobId>{.zip,/} are
 *     reclaimed. The record picks up artifactsReclaimed / workspaceReclaimed
 *     flags + timestamps so the UI can render "artifacts pruned" instead of
 *     "oops, 404".
 *   - Dry-run mode (--dry-run flag or DRY_RUN env) logs what *would* be
 *     deleted and touches nothing. Always run dry against the live cluster
 *     before handing the cron job to Nomad.
 *   - One summary event is published to `platform:events` per run
 *     (retention.run) with aggregate counts + bytes reclaimed, so the
 *     admin UI's event timeline shows when the sweep ran.
 *
 * Exit codes:
 *   0  success (even if nothing was deleted — empty cluster is fine)
 *   1  fatal error before any work could be performed (KeyDB unreachable etc.)
 *
 * Per-customer / per-job errors are logged and counted, but don't fail the
 * whole run — next day's sweep retries the same jobs.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const logger = require('../utils/logger');
const redis = require('../utils/redis');
const CustomerPolicyService = require('../services/CustomerPolicyService');
const EventStream = require('../services/EventStream');
const { DATA_ROOT, WORKSPACES_ROOT, ARTIFACTS_ROOT } = require('../utils/constants');

// Terminal states — see JobService.TERMINAL_STATES. Duplicated here so the
// sweep can run even if the service module fails to load for any reason.
const TERMINAL = new Set(['succeeded', 'failed', 'canceled', 'timeout']);
const SUCCEEDED = new Set(['succeeded']);
const FAILED_LIKE = new Set(['failed', 'timeout', 'canceled']);

// ─── Options ──────────────────────────────────────────────────────────

const DRY_RUN =
  process.argv.includes('--dry-run') ||
  /^(1|true|yes)$/i.test(process.env.DRY_RUN || '');

// Hard cap on customers scanned in a single run. Defensive — prevents a
// runaway scan if customer:*:policy balloons unexpectedly. Real fleets
// will never hit this.
const MAX_CUSTOMERS = Number(process.env.RETENTION_MAX_CUSTOMERS || 10_000);

// Hard cap on jobs scanned per customer per run. Anything beyond will be
// picked up by subsequent runs.
const MAX_JOBS_PER_CUSTOMER = Number(process.env.RETENTION_MAX_JOBS || 5_000);

// ─── Helpers ──────────────────────────────────────────────────────────

function parseTs(s) {
  if (!s) return 0;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : 0;
}

async function pathSizeBytes(p) {
  // Recursively size a directory OR a single file. Used for bytesReclaimed
  // accounting. Errors are non-fatal — we still proceed to delete.
  try {
    const st = await fsp.lstat(p);
    if (st.isFile() || st.isSymbolicLink()) return st.size;
    if (!st.isDirectory()) return 0;
    let total = 0;
    let entries;
    try {
      entries = await fsp.readdir(p);
    } catch { return 0; }
    for (const name of entries) {
      total += await pathSizeBytes(path.join(p, name));
    }
    return total;
  } catch (err) {
    if (err.code === 'ENOENT') return 0;
    return 0;
  }
}

async function rmPath(p, { dryRun, log }) {
  // Defensive: refuse to remove anything outside DATA_ROOT. A bug in the
  // job record that caused the path to resolve to '/' must not take out
  // the container.
  const resolved = path.resolve(p);
  const resolvedRoot = path.resolve(DATA_ROOT);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    log.warn(`refusing to rm outside DATA_ROOT: ${resolved}`);
    return { removed: false, bytes: 0 };
  }
  let bytes = 0;
  try {
    bytes = await pathSizeBytes(resolved);
  } catch (_) {}
  if (dryRun) {
    log.info(`[dry-run] would rm ${resolved} (${bytes} bytes)`);
    return { removed: false, bytes };
  }
  try {
    await fsp.rm(resolved, { recursive: true, force: true });
    return { removed: true, bytes };
  } catch (err) {
    log.warn(`rm failed for ${resolved}: ${err.message}`);
    return { removed: false, bytes: 0 };
  }
}

async function getJob(jobId) {
  const raw = await redis.get(`job:${jobId}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function markJobReclaimed(jobId, patch, { dryRun, log }) {
  // Keep the job record, but note that the big files are gone. This makes
  // the admin UI render "artifacts pruned by retention" instead of a 404.
  if (dryRun) return;
  try {
    const current = await getJob(jobId);
    if (!current) return;
    const next = {
      ...current,
      ...patch,
      artifacts: patch.artifactsReclaimed ? [] : current.artifacts || [],
    };
    await redis.set(`job:${jobId}`, JSON.stringify(next));
  } catch (err) {
    log.warn(`[job ${jobId}] markJobReclaimed failed: ${err.message}`);
  }
}

/**
 * Discover and delete the per-job metadata the task description expects,
 * even though current code stores artifacts inline on the job record.
 * Defensive — if/when that migrates to `artifact:<id>:<name>` hashes and a
 * `job:<id>:artifacts` SET, this picks them up without a code change.
 */
async function purgeJobArtifactMetadata(jobId, { dryRun, log }) {
  if (dryRun) return { keysDeleted: 0 };
  let keysDeleted = 0;
  try {
    // SET of artifact names, if present.
    const setKey = `job:${jobId}:artifacts`;
    const type = await redis.type(setKey).catch(() => 'none');
    if (type && type !== 'none') {
      await redis.del(setKey);
      keysDeleted += 1;
    }
    // Any artifact:<jobId>:* hashes, if present.
    for await (const key of redis.scanIterator({
      MATCH: `artifact:${jobId}:*`,
      COUNT: 200,
    })) {
      await redis.del(key);
      keysDeleted += 1;
    }
  } catch (err) {
    log.warn(`[job ${jobId}] purgeJobArtifactMetadata failed: ${err.message}`);
  }
  return { keysDeleted };
}

// ─── Candidate collection ────────────────────────────────────────────

async function listCustomerIds() {
  const ids = [];
  for await (const key of redis.scanIterator({
    MATCH: 'customer:*:policy',
    COUNT: 200,
  })) {
    // customer:<id>:policy — take everything between 'customer:' and ':policy'
    const parts = key.split(':');
    if (parts.length < 3) continue;
    const id = parts.slice(1, -1).join(':');
    if (id) ids.push(id);
    if (ids.length >= MAX_CUSTOMERS) break;
  }
  return ids;
}

async function listCustomerJobs(customerId) {
  // job:by-customer:<id> is a ZSET (score=createdAtMs, value=jobId).
  // Read all, hydrate records, skip missing ones.
  const ids = await redis.zRange(
    `job:by-customer:${customerId}`,
    -MAX_JOBS_PER_CUSTOMER,
    -1,
    { REV: true }
  );
  const out = [];
  for (const id of ids || []) {
    const job = await getJob(id);
    if (job) out.push(job);
  }
  return out;
}

// ─── Sweep per customer ──────────────────────────────────────────────

async function sweepCustomer(customerId, policy, nowMs, log, dryRun) {
  const build = (policy && policy.build) || {};
  const keepSuccessful = Number(build.keepSuccessfulBuilds);
  const failedHours = Number(build.keepFailedBuildsHours);
  const wsHours = Number(build.workspaceRetentionHours);

  const jobs = await listCustomerJobs(customerId);
  if (!jobs.length) return { artifactsDeletedCount: 0, workspacesDeletedCount: 0, bytesReclaimed: 0, errors: 0 };

  // Bucket jobs by terminal class. Non-terminal jobs are collected but never
  // touched — they may still be running.
  const succeeded = [];
  const failedLike = [];
  const other = [];
  for (const j of jobs) {
    if (SUCCEEDED.has(j.status)) succeeded.push(j);
    else if (FAILED_LIKE.has(j.status)) failedLike.push(j);
    else other.push(j);
  }

  // Newest first by completedAt, fall back to createdAt so rows with
  // missing timestamps still sort consistently.
  const byEndedDesc = (a, b) =>
    (parseTs(b.completedAt) || parseTs(b.createdAt)) -
    (parseTs(a.completedAt) || parseTs(a.createdAt));
  succeeded.sort(byEndedDesc);

  const toDelete = new Map(); // jobId → reason

  // 1) Succeeded: keep N newest, sweep rest.
  if (Number.isFinite(keepSuccessful) && keepSuccessful >= 0) {
    const excess = succeeded.slice(keepSuccessful);
    for (const j of excess) toDelete.set(j.id, 'succeeded_over_keep_count');
  }

  // 2) Failed-like: sweep anything older than the hours threshold.
  if (Number.isFinite(failedHours) && failedHours >= 0) {
    const cutoffMs = nowMs - failedHours * 3600 * 1000;
    for (const j of failedLike) {
      const endedMs = parseTs(j.completedAt) || parseTs(j.createdAt);
      if (endedMs && endedMs < cutoffMs) {
        toDelete.set(j.id, `failed_older_than_${failedHours}h`);
      }
    }
  }

  // 3) Workspaces: separate pass — applies to ALL terminal jobs regardless
  //    of the two knobs above. The workspace is only needed during a
  //    build; once terminal it's just ballast.
  const workspacesToDelete = [];
  if (Number.isFinite(wsHours) && wsHours >= 0) {
    const cutoffMs = nowMs - wsHours * 3600 * 1000;
    for (const j of jobs) {
      if (!TERMINAL.has(j.status)) continue; // never touch live jobs
      const endedMs = parseTs(j.completedAt) || parseTs(j.createdAt);
      if (endedMs && endedMs < cutoffMs) {
        workspacesToDelete.push(j.id);
      }
    }
  }

  // ─── Execute artifact sweep ────────────────────────────────────────
  let artifactsDeletedCount = 0;
  let bytesReclaimed = 0;
  let errors = 0;

  for (const [jobId, reason] of toDelete) {
    try {
      const artifactDir = path.join(ARTIFACTS_ROOT, jobId);
      const { removed, bytes } = await rmPath(artifactDir, { dryRun, log });
      bytesReclaimed += bytes;
      if (removed || bytes > 0) artifactsDeletedCount += 1;
      await purgeJobArtifactMetadata(jobId, { dryRun, log });
      await markJobReclaimed(jobId, {
        artifactsReclaimed: true,
        artifactsReclaimedAt: new Date(nowMs).toISOString(),
        artifactsReclaimedReason: reason,
      }, { dryRun, log });
    } catch (err) {
      errors += 1;
      log.warn(`[${customerId}] artifact sweep ${jobId} failed: ${err.message}`);
    }
  }

  // ─── Execute workspace sweep ───────────────────────────────────────
  let workspacesDeletedCount = 0;
  for (const jobId of workspacesToDelete) {
    try {
      // Current code writes workspaces as flat files: /data/workspaces/<jobId>.zip
      // Task description mentions dir: /data/workspaces/<jobId>/
      // Handle both — sweep whichever exists.
      const candidates = [
        path.join(WORKSPACES_ROOT, `${jobId}.zip`),
        path.join(WORKSPACES_ROOT, jobId),
      ];
      let jobBytes = 0;
      let anyRemoved = false;
      for (const c of candidates) {
        let exists = false;
        try {
          await fsp.access(c);
          exists = true;
        } catch { /* not present */ }
        if (!exists) continue;
        const { removed, bytes } = await rmPath(c, { dryRun, log });
        jobBytes += bytes;
        if (removed || bytes > 0) anyRemoved = true;
      }
      bytesReclaimed += jobBytes;
      if (anyRemoved) workspacesDeletedCount += 1;
      if (anyRemoved) {
        await markJobReclaimed(jobId, {
          workspaceReclaimed: true,
          workspaceReclaimedAt: new Date(nowMs).toISOString(),
        }, { dryRun, log });
      }
    } catch (err) {
      errors += 1;
      log.warn(`[${customerId}] workspace sweep ${jobId} failed: ${err.message}`);
    }
  }

  log.info(
    `[${customerId}] swept ` +
    `artifacts=${artifactsDeletedCount} workspaces=${workspacesDeletedCount} ` +
    `bytes=${bytesReclaimed} jobs_seen=${jobs.length} ` +
    `succeeded=${succeeded.length} failed=${failedLike.length} other=${other.length} ` +
    `dry_run=${dryRun}`
  );

  return { artifactsDeletedCount, workspacesDeletedCount, bytesReclaimed, errors };
}

// ─── Orphan sweep ─────────────────────────────────────────────────────
//
// A job can land on Ceph without ever making it onto job:by-customer (e.g.
// runner crashed before recordArtifact, or a partner nuked the customer).
// Catch those by walking the artifacts + workspaces dirs directly and
// cross-checking against the job record. Files whose jobs are gone or
// terminal-for-more-than-a-day are swept under the global orphan rule.

const ORPHAN_TERMINAL_HOURS = Number(process.env.RETENTION_ORPHAN_HOURS || 24);

async function sweepOrphans(nowMs, log, dryRun) {
  let artifactsDeletedCount = 0;
  let workspacesDeletedCount = 0;
  let bytesReclaimed = 0;
  let errors = 0;

  // Orphan artifact dirs
  try {
    const entries = await fsp.readdir(ARTIFACTS_ROOT, { withFileTypes: true }).catch(() => []);
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const jobId = ent.name;
      if (!/^job_[A-Za-z0-9]{6,}$/.test(jobId)) continue;
      const job = await getJob(jobId);
      // Delete if: no record at all, OR record is terminal + older than the
      // orphan horizon (the per-customer sweep should have caught it; if
      // it's still here the record's probably out of the ZSET somehow).
      let eligible = false;
      if (!job) eligible = true;
      else if (TERMINAL.has(job.status)) {
        const endedMs = parseTs(job.completedAt) || parseTs(job.createdAt);
        if (endedMs && endedMs < nowMs - ORPHAN_TERMINAL_HOURS * 3600 * 1000) {
          // Only orphan-sweep if the record says it was ALREADY reclaimed,
          // i.e. per-customer sweep missed removing the dir but did the
          // bookkeeping. Avoids double-sweeping live-but-slow customer sweep.
          if (job.artifactsReclaimed) eligible = true;
        }
      }
      if (!eligible) continue;
      try {
        const dir = path.join(ARTIFACTS_ROOT, jobId);
        const { removed, bytes } = await rmPath(dir, { dryRun, log });
        bytesReclaimed += bytes;
        if (removed || bytes > 0) artifactsDeletedCount += 1;
      } catch (err) {
        errors += 1;
        log.warn(`orphan artifact sweep ${jobId} failed: ${err.message}`);
      }
    }
  } catch (err) {
    log.warn(`orphan artifact walk failed: ${err.message}`);
  }

  // Orphan workspaces. Files look like <jobId>.zip, dirs like <jobId>/.
  try {
    const entries = await fsp.readdir(WORKSPACES_ROOT, { withFileTypes: true }).catch(() => []);
    for (const ent of entries) {
      const name = ent.name;
      const jobId = name.endsWith('.zip') ? name.slice(0, -4) : name;
      if (!/^job_[A-Za-z0-9]{6,}$/.test(jobId)) continue;
      const job = await getJob(jobId);
      let eligible = false;
      if (!job) eligible = true;
      else if (TERMINAL.has(job.status)) {
        const endedMs = parseTs(job.completedAt) || parseTs(job.createdAt);
        if (endedMs && endedMs < nowMs - ORPHAN_TERMINAL_HOURS * 3600 * 1000) {
          eligible = true; // terminal + old → fair game
        }
      }
      if (!eligible) continue;
      try {
        const p = path.join(WORKSPACES_ROOT, name);
        const { removed, bytes } = await rmPath(p, { dryRun, log });
        bytesReclaimed += bytes;
        if (removed || bytes > 0) workspacesDeletedCount += 1;
      } catch (err) {
        errors += 1;
        log.warn(`orphan workspace sweep ${name} failed: ${err.message}`);
      }
    }
  } catch (err) {
    log.warn(`orphan workspace walk failed: ${err.message}`);
  }

  log.info(
    `[orphans] swept artifacts=${artifactsDeletedCount} workspaces=${workspacesDeletedCount} ` +
    `bytes=${bytesReclaimed} errors=${errors} dry_run=${dryRun}`
  );
  return { artifactsDeletedCount, workspacesDeletedCount, bytesReclaimed, errors };
}

// ─── Entry point ──────────────────────────────────────────────────────

/**
 * Public entry — callable from bin (CLI) AND from
 * POST /api/admin/retention/run so the operator button doesn't spawn a
 * second process. Returns the summary + exits the caller cleanly.
 */
async function run({ dryRun = DRY_RUN, log = logger } = {}) {
  const startedAt = Date.now();
  log.info(`[retention] starting dry_run=${dryRun}`);

  // Ensure the shared redis client is ready. When imported from server.js
  // this is already connected; when run from bin it's still mid-connect.
  if (redis.isOpen === false) {
    try { await redis.connect(); } catch (err) {
      log.error(`[retention] KeyDB connect failed: ${err.message}`);
      throw err;
    }
  }

  let customers = [];
  try {
    customers = await listCustomerIds();
  } catch (err) {
    log.error(`[retention] customer scan failed: ${err.message}`);
    throw err;
  }
  log.info(`[retention] scanning ${customers.length} customers`);

  const totals = {
    customersScanned: customers.length,
    artifactsDeletedCount: 0,
    workspacesDeletedCount: 0,
    bytesReclaimed: 0,
    errors: 0,
  };

  for (const customerId of customers) {
    let policy;
    try {
      policy = await CustomerPolicyService.get(customerId);
    } catch (err) {
      log.warn(`[retention] load policy for ${customerId} failed: ${err.message}`);
      totals.errors += 1;
      continue;
    }
    try {
      const r = await sweepCustomer(customerId, policy, Date.now(), log, dryRun);
      totals.artifactsDeletedCount += r.artifactsDeletedCount;
      totals.workspacesDeletedCount += r.workspacesDeletedCount;
      totals.bytesReclaimed += r.bytesReclaimed;
      totals.errors += r.errors;
    } catch (err) {
      log.warn(`[retention] sweep for ${customerId} failed: ${err.message}`);
      totals.errors += 1;
    }
  }

  // Orphan pass — catches jobs whose customer policy was deleted or whose
  // ZSET entry is missing. Intentionally conservative: only removes files
  // whose job record is already missing or marked reclaimed.
  try {
    const r = await sweepOrphans(Date.now(), log, dryRun);
    totals.artifactsDeletedCount += r.artifactsDeletedCount;
    totals.workspacesDeletedCount += r.workspacesDeletedCount;
    totals.bytesReclaimed += r.bytesReclaimed;
    totals.errors += r.errors;
  } catch (err) {
    log.warn(`[retention] orphan sweep failed: ${err.message}`);
    totals.errors += 1;
  }

  const durationMs = Date.now() - startedAt;
  const summary = {
    ...totals,
    durationMs,
    dryRun,
    at: new Date(startedAt).toISOString(),
  };
  log.info(`[retention] finished ${JSON.stringify(summary)}`);

  // Publish one platform:events row so the admin UI's event feed picks it
  // up. Skipped on dry-run — pretending it ran would confuse the timeline.
  if (!dryRun) {
    try {
      const events = new EventStream(redis, { logger: log });
      await events.publish('retention.run', 'spinbuild', {
        severity: totals.errors > 0 ? 'warn' : 'info',
        context: summary,
      });
    } catch (err) {
      log.warn(`[retention] emit platform event failed: ${err.message}`);
    }
  }

  return summary;
}

module.exports = { run };

// CLI entry — `node bin/artifact-retention.js` (or `--dry-run` flag).
// Exits the process cleanly so Nomad sees the correct exit code.
if (require.main === module) {
  run()
    .then((summary) => {
      // Brief, parseable final line for the HCL logs.
      console.log(JSON.stringify({ retention: 'ok', ...summary }));
      // Close the shared redis client so the process can exit.
      redis.quit().catch(() => {}).finally(() => process.exit(0));
    })
    .catch((err) => {
      logger.error(`[retention] fatal: ${err.message}`);
      redis.quit().catch(() => {}).finally(() => process.exit(1));
    });
}
