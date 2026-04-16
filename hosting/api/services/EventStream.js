/**
 * SpinForge - Platform event stream.
 *
 * A single Redis stream (platform:events, capped at ~10k entries) that
 * everything interesting in the cluster flows through. The Platform UI
 * subscribes to it live; operators use it as the "what just happened"
 * timeline.
 *
 * Event shape (all fields are strings, Redis stream convention):
 *   type     — dotted namespace: node.up, site.created, cert.issued,
 *              partner.auth.failed, container.crashed, ...
 *   subject  — the primary entity affected (hostname, domain, customer id)
 *   severity — info | warn | error
 *   source   — who published (hostname of the api replica)
 *   context  — JSON blob with anything structured (small, <1KB ideally)
 *
 * Keep it lean: we write a LOT of events. No stack traces in the
 * stream — those go to logs. The stream is for "operator needs to
 * notice this" signal.
 */

const os = require('os');

const STREAM = 'platform:events';
const MAXLEN = 10_000;
const KNOWN_SEVERITIES = new Set(['info', 'warn', 'error']);

class EventStream {
  constructor(redis, { logger } = {}) {
    this.redis = redis;
    this.logger = logger || console;
    this.source = os.hostname();
  }

  /**
   * Publish an event. Always best-effort — if Redis is down we log
   * and move on, never throw back to the caller. Observability must
   * never break the thing it's observing.
   */
  async publish(type, subject = '', contextOrOpts = {}) {
    try {
      // Accept either (type, subject, context) or (type, subject, { severity, context })
      let severity = 'info';
      let context = contextOrOpts || {};
      if (context && typeof context === 'object' && 'severity' in context && 'context' in context) {
        severity = context.severity;
        context = context.context;
      }
      if (!KNOWN_SEVERITIES.has(severity)) severity = 'info';

      const fields = {
        type: String(type || ''),
        subject: String(subject || ''),
        severity,
        source: this.source,
        ts: new Date().toISOString(),
        context: typeof context === 'string' ? context : JSON.stringify(context || {}).slice(0, 2000),
      };

      await this.redis.xAdd(STREAM, '*', fields, {
        TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: MAXLEN },
      });
    } catch (err) {
      this.logger.error(`[events] publish(${type}) failed: ${err.message}`);
    }
  }

  /**
   * Fetch the most recent N events, newest first. Used by the REST
   * snapshot endpoint before the UI swaps to live subscription.
   */
  async recent(limit = 200) {
    try {
      const rows = await this.redis.xRevRange(STREAM, '+', '-', { COUNT: limit });
      return (rows || []).map((r) => ({ id: r.id, ...r.message }));
    } catch (err) {
      this.logger.error(`[events] recent() failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Starting at `lastId` (a stream id string like "1707420000000-0"),
   * return any events newer than that, up to `limit`. The WebSocket
   * bridge loops on this. Also returns the new lastId so the caller
   * can keep paging forward.
   *
   * Uses XREAD with a short BLOCK so an idle stream wakes the caller
   * within a few seconds of a new event.
   */
  async tailFrom(lastId = '$', limit = 500, blockMs = 5000) {
    try {
      const res = await this.redis.xRead(
        { key: STREAM, id: lastId },
        { COUNT: limit, BLOCK: blockMs }
      );
      if (!res) return { events: [], lastId };
      // node-redis v4 returns [{name, messages: [{id, message}, ...]}]
      const messages = (res[0] && res[0].messages) || [];
      const events = messages.map((m) => ({ id: m.id, ...m.message }));
      const newLast = events.length ? events[events.length - 1].id : lastId;
      return { events, lastId: newLast };
    } catch (err) {
      this.logger.error(`[events] tailFrom(${lastId}) failed: ${err.message}`);
      return { events: [], lastId };
    }
  }
}

module.exports = EventStream;
module.exports.STREAM = STREAM;
module.exports.MAXLEN = MAXLEN;
