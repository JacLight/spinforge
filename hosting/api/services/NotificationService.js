/**
 * SpinForge - Notification dispatcher.
 *
 * Callers emit semantic events ("site_created", "cert_renewal_failed");
 * this module looks up the template, renders it, and pushes a send job
 * onto the Redis queue. EmailWorker picks up the job and actually talks
 * to SES. Separating dispatch from send keeps the request path fast —
 * the HTTP handler returns as soon as the job lands in Redis.
 *
 * Add a new event:
 *   1. Add the event name to EVENTS below.
 *   2. Add a default template in email-templates.default.js.
 *   3. Call notify('your_event', { to, context }) from wherever it fires.
 */

const EmailTemplateService = require('./EmailTemplateService');

// Known event types. Listed here so callers + the admin UI have a single
// source of truth and typos fail loudly.
const EVENTS = [
  'site_created',
  'custom_domain_added',
  'cert_renewal_failed',
  'container_crashed',
];

const QUEUE = 'email:queue';
const LOG_LIST = 'email:log';
const LOG_CAP = 500;

class NotificationService {
  constructor(redis, { logger } = {}) {
    this.redis = redis;
    this.logger = logger || console;
    this.templates = new EmailTemplateService(redis);
  }

  /**
   * Fire an event. Always non-throwing — notification failures should
   * never break the operation that triggered them. Returns whether the
   * email was queued.
   */
  async notify(event, { to, context = {} } = {}) {
    try {
      if (!EVENTS.includes(event)) {
        this.logger.warn(`[notify] unknown event: ${event}`);
        return false;
      }
      if (!to) {
        this.logger.warn(`[notify] event=${event} skipped — no recipient`);
        return false;
      }

      const tmpl = await this.templates.get(event);
      if (!tmpl || tmpl.enabled === false) return false;

      const rendered = this.templates.render(tmpl, context);
      const job = {
        event,
        to,
        subject: rendered.subject,
        html:    rendered.html,
        text:    rendered.text,
        queuedAt: new Date().toISOString(),
        attempts: 0,
      };
      await this.redis.rPush(QUEUE, JSON.stringify(job));
      return true;
    } catch (err) {
      this.logger.error(`[notify] event=${event} enqueue failed:`, err.message);
      return false;
    }
  }

  /**
   * Read recent log entries for the admin UI. Newest first.
   */
  async recentLog(limit = 50) {
    const raw = await this.redis.lRange(LOG_LIST, 0, Math.max(0, limit - 1));
    return raw.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
  }
}

NotificationService.EVENTS = EVENTS;
NotificationService.QUEUE = QUEUE;
NotificationService.LOG_LIST = LOG_LIST;
NotificationService.LOG_CAP = LOG_CAP;

module.exports = NotificationService;
