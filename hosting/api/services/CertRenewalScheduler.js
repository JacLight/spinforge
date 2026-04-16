/**
 * SpinForge - Certificate Renewal Scheduler
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Periodic task that:
 *   1. Renews certs that will expire in <30 days
 *   2. Backfills certs for sites that have ssl_enabled=true but no cert yet
 *      (so DNS that just propagated gets picked up automatically)
 *   3. Retries failed issuances with simple exponential backoff
 *
 * Three layers of single-flighting:
 *   • in-process `_running` flag — cheap check, skips overlapping ticks on
 *     the same replica
 *   • cluster-wide Redis lock — ensures only one api replica runs a tick
 *     across the whole cluster (critical now that we run N replicas)
 *   • per-domain Redis lock inside AcmeService — ensures a single domain
 *     can only be issued/renewed by one caller at a time
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const { preflight: dnsPreflight } = require('../utils/dns-preflight');
const { withClusterLock } = require('../utils/cluster-lock');
const sitesIndex = require('../utils/sites-index');
const { publish: publishEvent } = require('../utils/events');

// How long one scheduler tick is allowed to hold the cluster lock before
// it's considered dead. Must be longer than a realistic slow tick; the
// watchdog extends it automatically if we're still running.
const TICK_LOCK_TTL_SECONDS = 15 * 60;

class CertRenewalScheduler {
  /**
   * @param {object} opts
   * @param {object} opts.redis
   * @param {object} opts.certStore
   * @param {object} opts.acmeService
   * @param {number} [opts.intervalMs]    how often to run (default 1h)
   * @param {number} [opts.renewWithinDays] renew if expiring within N days
   * @param {object} [opts.logger]
   */
  constructor({ redis, certStore, acmeService, intervalMs, renewWithinDays, logger } = {}) {
    if (!redis || !certStore || !acmeService) {
      throw new Error('CertRenewalScheduler requires redis, certStore, acmeService');
    }
    this.redis = redis;
    this.certStore = certStore;
    this.acmeService = acmeService;
    this.intervalMs = intervalMs || 60 * 60 * 1000; // 1 hour
    this.renewWithinDays = renewWithinDays || 30;
    this.logger = logger || console;
    this._timer = null;
    this._running = false;
  }

  start() {
    if (this._timer) return;
    this.logger.info?.(
      `CertRenewalScheduler: starting (interval=${this.intervalMs}ms, renewWithin=${this.renewWithinDays}d)`
    );

    // Run once after a short delay so server boot isn't blocked, then on
    // a regular interval.
    setTimeout(() => this.runOnce().catch((e) => this.logger.error?.(e)), 30 * 1000);
    this._timer = setInterval(() => {
      this.runOnce().catch((e) => this.logger.error?.(e));
    }, this.intervalMs);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * Run a single tick of the scheduler. Safe to call manually (e.g. for
   * tests or to trigger from an admin endpoint). Three-layer single-flight:
   * local `_running` flag, cluster Redis lock, and per-domain locks inside
   * AcmeService.
   */
  async runOnce() {
    if (this._running) {
      this.logger.info?.('CertRenewalScheduler: tick skipped, previous tick still running (local)');
      return { skipped: true, reason: 'local-inflight' };
    }

    // Cluster-wide lock: ensures only one api replica runs a tick at a time
    // across the whole fleet. `ran: false` means another replica has it —
    // this is a normal, expected outcome, not an error.
    const locked = await withClusterLock(
      'cron:cert-renewal',
      TICK_LOCK_TTL_SECONDS,
      () => this._runOnceInner()
    );

    if (!locked.ran) {
      this.logger.info?.('CertRenewalScheduler: tick skipped, another replica holds the lock');
      return { skipped: true, reason: 'cluster-lock-held' };
    }
    if (locked.error) throw locked.error;
    return locked.result;
  }

  async _runOnceInner() {
    this._running = true;
    const startedAt = Date.now();
    const result = { renewed: [], issued: [], skipped: [], errored: [] };

    try {
      // ─── 1. Renew existing certs that are expiring soon ─────────
      const activeDomains = await this.redis.sMembers('active-certs');
      for (const domain of activeDomains || []) {
        try {
          const desc = await this.certStore.describe(domain);
          if (!desc) continue;
          if (desc.type !== 'letsencrypt' || desc.autoRenew === false) {
            result.skipped.push({ domain, reason: 'autoRenew disabled or not LE' });
            continue;
          }
          if (typeof desc.daysUntilExpiry !== 'number') {
            result.skipped.push({ domain, reason: 'no validTo' });
            continue;
          }
          if (desc.daysUntilExpiry > this.renewWithinDays) {
            continue;
          }

          // DNS preflight: a domain that has moved to another host should
          // not consume LE rate-limit slots on every renewal cycle.
          const pf = await dnsPreflight(domain);
          if (!pf.ok && !pf.skipped) {
            this.logger.info?.(
              `CertRenewalScheduler: ${domain} skipped — ${pf.reason}`
            );
            await this.certStore.putMetadata(domain, {
              lastAttemptAt: new Date().toISOString(),
              lastError: pf.reason,
              preflight: { ...pf, checkedAt: new Date().toISOString() },
            });
            await this.certStore.appendHistory(domain, {
              action: 'preflight:dns-mismatch',
              resolved: pf.resolved,
              expected: pf.expected,
            });
            await this.recordBackoff(domain);
            result.skipped.push({ domain, reason: 'DNS preflight failed' });
            continue;
          }

          this.logger.info?.(
            `CertRenewalScheduler: ${domain} expires in ${desc.daysUntilExpiry}d, renewing`
          );
          await this.acmeService.renew(domain);
          result.renewed.push(domain);
        } catch (err) {
          this.logger.error?.(`CertRenewalScheduler: renew failed for ${domain}: ${err.message}`);
          result.errored.push({ domain, error: err.message });
          publishEvent('cert.renewal.failed', domain, { error: err.message }, 'error');
          await this._notifyCertFailure(domain, err.message, desc?.notAfter).catch(() => {});
        }
      }

      // ─── 2. Backfill missing certs for sites with ssl_enabled ────
      const missing = await this.findSitesNeedingCerts();
      for (const domain of missing) {
        try {
          if (!(await this.shouldRetry(domain))) {
            result.skipped.push({ domain, reason: 'in backoff window' });
            continue;
          }

          // Cheap DNS preflight before we even try ACME
          const pf = await dnsPreflight(domain);
          if (!pf.ok && !pf.skipped) {
            this.logger.info?.(
              `CertRenewalScheduler: backfill skipped for ${domain} — ${pf.reason}`
            );
            await this.certStore.putMetadata(domain, {
              status: this.certStore.constructor.CertStatus.ERROR,
              lastAttemptAt: new Date().toISOString(),
              lastError: pf.reason,
              preflight: { ...pf, checkedAt: new Date().toISOString() },
            });
            await this.certStore.appendHistory(domain, {
              action: 'preflight:dns-mismatch',
              resolved: pf.resolved,
              expected: pf.expected,
            });
            await this.recordBackoff(domain);
            result.skipped.push({ domain, reason: 'DNS preflight failed' });
            continue;
          }

          this.logger.info?.(`CertRenewalScheduler: ${domain} has ssl_enabled but no active cert, issuing`);
          await this.acmeService.issue(domain);
          result.issued.push(domain);
        } catch (err) {
          this.logger.warn?.(`CertRenewalScheduler: issue failed for ${domain}: ${err.message}`);
          await this.recordBackoff(domain);
          result.errored.push({ domain, error: err.message });
          publishEvent('cert.issuance.failed', domain, { error: err.message }, 'warn');
        }
      }
    } finally {
      this._running = false;
    }

    const took = Date.now() - startedAt;
    this.logger.info?.(
      `CertRenewalScheduler: tick complete in ${took}ms — renewed=${result.renewed.length} issued=${result.issued.length} errored=${result.errored.length} skipped=${result.skipped.length}`
    );
    return result;
  }

  /**
   * Scan all sites in Redis (this uses KEYS for now — see SCAN migration in
   * the punch list — but is gated to once per tick).
   * Returns list of domains where the site has ssl_enabled but the cert is
   * either missing entirely or in error/expired state.
   */
  async findSitesNeedingCerts() {
    const result = [];
    try {
      const siteKeys = await sitesIndex.listAllSiteKeys();
      for (const key of siteKeys || []) {
        const data = await this.redis.get(key);
        if (!data) continue;
        let site;
        try {
          site = JSON.parse(data);
        } catch (_) {
          continue;
        }
        if (!site.ssl_enabled || !site.domain) continue;
        // Skip if we already have a healthy cert
        if (await this.certStore.hasActiveCert(site.domain)) continue;
        result.push(site.domain);
      }
    } catch (err) {
      this.logger.warn?.(`CertRenewalScheduler: site scan failed: ${err.message}`);
    }
    return result;
  }

  /**
   * Backoff helper. After a failed issuance, set a Redis key with TTL so we
   * don't hammer Let's Encrypt with retries that will keep failing for the
   * same reason (DNS not propagated, port 80 blocked, etc.).
   *
   * Backoff escalates: 5min → 15min → 1h → 6h → 24h → cap at 24h.
   */
  async shouldRetry(domain) {
    const next = await this.redis.get(`cert:backoff:${domain}`);
    if (!next) return true;
    return new Date(next).getTime() <= Date.now();
  }

  async recordBackoff(domain) {
    const meta = (await this.certStore.getMetadata(domain)) || {};
    const failures = (meta.failureCount || 0) + 1;
    const minutes = Math.min(24 * 60, [5, 15, 60, 360, 1440][Math.min(failures - 1, 4)] || 1440);
    const nextAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    await this.certStore.putMetadata(domain, {
      failureCount: failures,
      nextAttemptAt: nextAt,
    });
    await this.redis.setEx(`cert:backoff:${domain}`, minutes * 60, nextAt);
  }

  /**
   * Email the owning customer when a renewal fails. Best-effort — if
   * any lookup returns null or the notifications subsystem isn't up
   * yet we silently skip. The corresponding email template is
   * `cert_renewal_failed` (see services/email-templates.default.js).
   */
  async _notifyCertFailure(domain, reason, expiresAt) {
    try {
      const raw = await this.redis.get(`site:${domain}`);
      if (!raw) return;
      const site = JSON.parse(raw);
      if (!site.customerId) return;
      const custRaw = await this.redis.get(`customer:${site.customerId}`);
      if (!custRaw) return;
      const customer = JSON.parse(custRaw);
      if (!customer.email) return;

      // Notifications live on app.locals and are created at boot. We
      // can't import that here cleanly — just re-instantiate a thin
      // singleton using the same redis handle.
      const NotificationService = require('./NotificationService');
      const notify = new NotificationService(this.redis, { logger: this.logger });
      await notify.notify('cert_renewal_failed', {
        to: customer.email,
        context: {
          name: customer.name || customer.email,
          domain,
          reason: String(reason || '').slice(0, 500),
          expiresAt: expiresAt || 'unknown',
        },
      });
    } catch (err) {
      this.logger.warn?.(`[cert-notify] failed for ${domain}: ${err.message}`);
    }
  }
}

module.exports = CertRenewalScheduler;
