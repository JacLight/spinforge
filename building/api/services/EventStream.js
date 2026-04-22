/**
 * Platform event stream (building-api copy).
 *
 * This is a verbatim copy of hosting/api/services/EventStream.js. Both
 * subsystems write to the same `platform:events` Redis stream so operators
 * see hosting + building activity in one timeline.
 *
 * M8 (platform/ extraction) collapses this duplicate into a single shared
 * implementation. Until then, keep the two files byte-identical.
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

  async publish(type, subject = '', contextOrOpts = {}) {
    try {
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

  async recent(limit = 200) {
    try {
      const rows = await this.redis.xRevRange(STREAM, '+', '-', { COUNT: limit });
      return (rows || []).map((r) => ({ id: r.id, ...r.message }));
    } catch (err) {
      this.logger.error(`[events] recent() failed: ${err.message}`);
      return [];
    }
  }

  async tailFrom(lastId = '$', limit = 500, blockMs = 5000) {
    try {
      const res = await this.redis.xRead(
        { key: STREAM, id: lastId },
        { COUNT: limit, BLOCK: blockMs }
      );
      if (!res) return { events: [], lastId };
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
