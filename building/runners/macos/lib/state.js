/**
 * KeyDB state helpers for the Mac runner. Shape matches the per-job
 * conventions enforced by building/api/services/JobService.js.
 *
 * This is duplicated with the Linux/Android agents' inline helpers. When
 * the third runner type shows up with the same pattern, extract to
 * building/runners/shared/.
 */

const os = require('os');

const JOB_EVENTS_MAXLEN = 5_000;
const JOB_LOG_MAXLEN = 10_000;
const PLATFORM_EVENTS = 'platform:events';
const TERMINAL = new Set(['succeeded', 'failed', 'canceled', 'timeout']);

function makeState(redis, jobId, extra = {}) {
  return {
    async get() {
      const raw = await redis.get(`job:${jobId}`);
      return raw ? JSON.parse(raw) : null;
    },

    async transition(newStatus, patch = {}) {
      const raw = await redis.get(`job:${jobId}`);
      if (!raw) throw new Error(`job ${jobId} not found in keydb`);
      const job = JSON.parse(raw);
      const now = new Date().toISOString();
      const next = { ...job, ...patch, status: newStatus, updatedAt: now };
      if (newStatus === 'running' && !job.startedAt) next.startedAt = now;
      if (TERMINAL.has(newStatus)) {
        next.completedAt = now;
        if (job.startedAt) {
          next.metrics = {
            ...(job.metrics || {}),
            durationSec: Math.round((new Date(now) - new Date(job.startedAt)) / 1000),
          };
        }
      }
      await redis.set(`job:${jobId}`, JSON.stringify(next));
      await this.appendEvent(`job.${newStatus}`, patch);
      return next;
    },

    async appendEvent(type, context = {}) {
      await redis.xAdd(
        `job:${jobId}:events`,
        '*',
        { type, ts: new Date().toISOString(), context: JSON.stringify(context).slice(0, 2000) },
        { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: JOB_EVENTS_MAXLEN } }
      );
    },

    async appendLog(streamName, line) {
      if (!line) return;
      await redis.xAdd(
        `job:${jobId}:log`,
        '*',
        { stream: streamName, line: String(line).slice(0, 8000) },
        { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: JOB_LOG_MAXLEN } }
      );
    },

    async publishGlobal(type, severity, ctx = {}) {
      try {
        await redis.xAdd(
          PLATFORM_EVENTS,
          '*',
          {
            type,
            subject: jobId,
            severity,
            source: os.hostname(),
            ts: new Date().toISOString(),
            context: JSON.stringify({ ...extra, ...ctx }).slice(0, 2000),
          },
          { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 10_000 } }
        );
      } catch (_) {}
    },
  };
}

module.exports = { makeState, TERMINAL };
