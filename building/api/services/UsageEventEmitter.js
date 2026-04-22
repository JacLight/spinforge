/**
 * Emits usage events to the shared `platform:usage` Redis stream.
 * Partners subscribe to this stream, aggregate, and bill. SpinForge
 * itself never reads from it for billing purposes — only for policy
 * enforcement of monthly quotas (monthlyCpuSeconds, monthlyEgressGB).
 *
 * Schema (per-event fields, all stringified on the wire):
 *   customerId   required
 *   type         required  (e.g. "job.completed", "egress.sampled", "session.ended")
 *   platform     optional  (e.g. "web", "ios", "android")
 *   jobId        optional
 *   cpu_seconds  optional  cumulative CPU seconds consumed
 *   mem_mb_sec   optional  memory usage integrated over time
 *   bytes        optional  artifact bytes, egress bytes, etc.
 *   duration_ms  optional
 *   ts           auto-added — emitter timestamp in ms
 *
 * Uses node-redis v4 xAdd with approximate MAXLEN trimming. The trim is
 * approximate (~) so Redis can free whole nodes rather than exact-count
 * and is effectively free on every write.
 */
const redis = require('../utils/redis');

const STREAM = 'platform:usage';
const MAXLEN = 100_000;

async function emit(event) {
  if (!event || !event.customerId || !event.type) {
    throw new Error('UsageEvent requires customerId + type');
  }
  const message = {};
  for (const [k, v] of Object.entries(event)) {
    if (v == null) continue;
    message[k] = String(v);
  }
  message.ts = String(Date.now());
  return redis.xAdd(STREAM, '*', message, {
    TRIM: {
      strategy: 'MAXLEN',
      strategyModifier: '~',
      threshold: MAXLEN,
    },
  });
}

module.exports = { emit, STREAM, MAXLEN };
