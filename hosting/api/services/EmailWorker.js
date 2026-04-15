/**
 * SpinForge - Email send worker.
 *
 * Pulls jobs from the Redis queue (NotificationService enqueues), sends
 * them through SES, and records the outcome in a capped log list that
 * the admin UI reads. Runs inside the api process, not a separate
 * container — one less moving piece and the job volume is tiny.
 *
 * Retry policy:
 *   - Transient send errors (throttling, 5xx) push the job back with
 *     attempts++, up to 5 tries.
 *   - Permanent errors (bad address, message rejected) are logged and
 *     dropped.
 *
 * Concurrency: single worker loop is enough for expected volume. If
 * this becomes a bottleneck, we promote the worker to its own process
 * and scale horizontally — the queue itself is already multi-reader-safe
 * (LPOP/BLPOP are atomic).
 */

const { sendEmail } = require('../utils/ses');
const { QUEUE, LOG_LIST, LOG_CAP } = require('./NotificationService');

const MAX_ATTEMPTS = 5;
const IDLE_SLEEP_MS = 2000;     // poll gap when the queue is empty
const RETRY_BACKOFF_MS = 30_000; // re-queue delay for transient failures

class EmailWorker {
  constructor(redis, { logger } = {}) {
    this.redis = redis;
    this.logger = logger || console;
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._loop().catch((err) => {
      this.logger.error('[email-worker] loop died:', err);
      this._running = false;
    });
  }

  stop() { this._running = false; }

  async _loop() {
    while (this._running) {
      const raw = await this.redis.lPop(QUEUE).catch(() => null);
      if (!raw) {
        await sleep(IDLE_SLEEP_MS);
        continue;
      }

      let job;
      try { job = JSON.parse(raw); }
      catch {
        this.logger.warn('[email-worker] dropped malformed job');
        continue;
      }

      await this._send(job);
    }
  }

  async _send(job) {
    const started = Date.now();
    try {
      const messageId = await sendEmail({
        to: job.to,
        subject: job.subject,
        html: job.html,
        text: job.text,
      });
      await this._log({
        ...job,
        status: 'sent',
        messageId,
        sentAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      });
      this.logger.info(`[email-worker] sent event=${job.event} to=${job.to} msg=${messageId}`);
    } catch (err) {
      const permanent = isPermanent(err);
      const attempts = (job.attempts || 0) + 1;

      if (!permanent && attempts < MAX_ATTEMPTS) {
        this.logger.warn(`[email-worker] transient fail event=${job.event} to=${job.to} attempt=${attempts} err=${err.message}`);
        setTimeout(() => {
          this.redis.rPush(QUEUE, JSON.stringify({ ...job, attempts }))
            .catch((e) => this.logger.error('[email-worker] requeue failed:', e));
        }, RETRY_BACKOFF_MS);
      } else {
        this.logger.error(`[email-worker] giving up event=${job.event} to=${job.to} attempt=${attempts} err=${err.message}`);
        await this._log({
          ...job,
          status: permanent ? 'failed_permanent' : 'failed_retries_exhausted',
          error: err.message,
          attempts,
          failedAt: new Date().toISOString(),
          durationMs: Date.now() - started,
        });
      }
    }
  }

  async _log(entry) {
    try {
      await this.redis.lPush(LOG_LIST, JSON.stringify(entry));
      await this.redis.lTrim(LOG_LIST, 0, LOG_CAP - 1);
    } catch (err) {
      this.logger.error('[email-worker] log write failed:', err.message);
    }
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// SES errors that indicate the message will never deliver. Anything else
// we assume is worth retrying. The specific codes are from the AWS SDK
// error names / HTTP status codes.
function isPermanent(err) {
  const name = err.name || '';
  const code = err.$metadata?.httpStatusCode;
  if (name === 'MessageRejected') return true;
  if (name === 'InvalidParameterValue') return true;
  if (code === 400) return true;
  return false;
}

module.exports = EmailWorker;
