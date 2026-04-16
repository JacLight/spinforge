/**
 * Lazy singleton accessor for the shared EventStream instance.
 *
 * Anywhere in the api can `require('../utils/events').publish(...)`
 * without having to thread app.locals around. The actual EventStream
 * object is created once, on first use, and shares the main redis
 * client.
 *
 * publish() is fire-and-forget (returns a promise you can ignore).
 * EventStream itself never throws, so callers don't need try/catch.
 */

const EventStream = require('../services/EventStream');
const redisClient = require('./redis');

let _stream = null;
function stream() {
  if (!_stream) _stream = new EventStream(redisClient);
  return _stream;
}

/**
 * Fire an event. severity defaults to "info".
 *
 *   publish('site.created', 'foo.spinforge.dev', { customerId, type: 'static' })
 *   publish('partner.auth.denied', partnerId, { reason }, 'warn')
 */
function publish(type, subject = '', context = {}, severity = 'info') {
  return stream().publish(type, subject, { severity, context });
}

module.exports = { publish, stream };
