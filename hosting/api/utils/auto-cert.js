/**
 * SpinForge - Auto-issue helper
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Tiny utility that fires a background ACME issuance when a site is created
 * with ssl_enabled=true. Caddy-style automatic provisioning. The route
 * handlers call this and don't have to know anything about CertStore or
 * AcmeService internals.
 *
 * Failures are intentionally swallowed and logged — they will be retried
 * by CertRenewalScheduler's backfill loop on its next tick. The site
 * creation itself never blocks on a slow ACME handshake.
 */
const CertStore = require('../services/CertStore');
const AcmeService = require('../services/AcmeService');
const redisClient = require('./redis');
const { preflight: dnsPreflight } = require('./dns-preflight');

let _certStore = null;
let _acmeService = null;

function getServices() {
  if (!_certStore) {
    _certStore = new CertStore(redisClient);
    _acmeService = new AcmeService({ redis: redisClient, certStore: _certStore });
  }
  return { certStore: _certStore, acmeService: _acmeService };
}

/**
 * Fire and forget. Returns immediately so the request handler isn't blocked.
 *
 * @param {object} site  the site object that was just created/updated
 */
function maybeAutoIssueCert(site) {
  if (!site || !site.domain || !site.ssl_enabled) return;

  // Defer to the next tick so the response is already on the wire by the
  // time we start hammering Let's Encrypt.
  setImmediate(async () => {
    try {
      const { certStore, acmeService } = getServices();

      // If we already have an active cert, don't reissue.
      if (await certStore.hasActiveCert(site.domain)) return;

      // Don't try if we're inside a backoff window from a previous failure.
      const backoff = await redisClient.get(`cert:backoff:${site.domain}`);
      if (backoff && new Date(backoff).getTime() > Date.now()) return;

      // DNS preflight: never auto-issue for a domain that doesn't yet point
      // at this server. The renewal scheduler will retry once DNS catches up.
      const pf = await dnsPreflight(site.domain);
      if (!pf.ok && !pf.skipped) {
        await certStore.putMetadata(site.domain, {
          status: CertStore.CertStatus.PENDING,
          type: 'letsencrypt',
          lastError: pf.reason,
          preflight: { ...pf, checkedAt: new Date().toISOString() },
        });
        await certStore.appendHistory(site.domain, {
          action: 'auto-issue:dns-not-ready',
          resolved: pf.resolved,
          expected: pf.expected,
        });
        return;
      }

      // Mark as pending so the UI shows status immediately.
      await certStore.putMetadata(site.domain, {
        status: CertStore.CertStatus.PENDING,
        type: 'letsencrypt',
        triggeredBy: 'auto',
      });
      await certStore.appendHistory(site.domain, {
        action: 'auto-issue:start',
        triggeredBy: 'site-create',
      });

      // Include any aliases as SANs so a single cert covers the whole site.
      const altNames = Array.isArray(site.aliases) && site.aliases.length
        ? [site.domain, ...site.aliases]
        : [];

      await acmeService.issue(site.domain, { altNames });
    } catch (err) {
      // Log only — the renewal scheduler will retry with backoff.
      // eslint-disable-next-line no-console
      console.warn(
        `[auto-cert] background issuance failed for ${site.domain}: ${err && err.message}`
      );
      // Set the backoff so the next scheduler tick respects it.
      try {
        const meta = (await getServices().certStore.getMetadata(site.domain)) || {};
        const failures = (meta.failureCount || 0) + 1;
        const minutes = Math.min(24 * 60, [5, 15, 60, 360, 1440][Math.min(failures - 1, 4)] || 1440);
        const nextAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        await getServices().certStore.putMetadata(site.domain, {
          failureCount: failures,
          nextAttemptAt: nextAt,
        });
        await redisClient.setEx(
          `cert:backoff:${site.domain}`,
          minutes * 60,
          nextAt
        );
      } catch (_) {
        /* ignore — best-effort */
      }
    }
  });
}

module.exports = { maybeAutoIssueCert };
