/**
 * SpinForge - DNS Preflight Helper
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Resolves a domain's A/AAAA records and verifies that at least one of them
 * matches an expected edge IP. Used as a fast pre-flight check before talking
 * to Let's Encrypt — domains that have moved to a different host should fail
 * locally instead of burning ACME rate limit slots.
 *
 * Configuration (read once at module load):
 *   ACME_EDGE_IPS  comma-separated list of public IPs that point at this
 *                  edge. Takes precedence if set.
 *   PUBLIC_IP      single public IP fallback (existing env var).
 *   ACME_PREFLIGHT can be set to "off" or "disabled" to skip the check
 *                  entirely (useful in dev or when DNS is intentionally
 *                  routed via something we don't control).
 */
const dns = require('dns').promises;

const RAW_EDGE_IPS = process.env.ACME_EDGE_IPS || process.env.PUBLIC_IP || '';
const EDGE_IPS = RAW_EDGE_IPS
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const PREFLIGHT_DISABLED = ['off', 'disabled', 'false', '0'].includes(
  String(process.env.ACME_PREFLIGHT || '').toLowerCase()
);

/**
 * @typedef PreflightResult
 * @property {boolean} ok          true if the domain resolves to at least one expected edge IP
 * @property {boolean} skipped     true if the check was skipped (no expected IPs configured or disabled)
 * @property {string[]} resolved   IPs the domain currently resolves to (A + AAAA)
 * @property {string[]} expected   IPs we expect the domain to resolve to
 * @property {string} [reason]     human-readable failure reason (only when !ok)
 */

/**
 * Run a DNS preflight check for a domain. Never throws — always returns a
 * structured result so callers can decide what to do.
 *
 * @param {string} domain
 * @returns {Promise<PreflightResult>}
 */
async function preflight(domain) {
  if (PREFLIGHT_DISABLED) {
    return { ok: true, skipped: true, resolved: [], expected: EDGE_IPS };
  }
  if (EDGE_IPS.length === 0) {
    return { ok: true, skipped: true, resolved: [], expected: EDGE_IPS };
  }
  if (!domain || typeof domain !== 'string') {
    return {
      ok: false,
      skipped: false,
      resolved: [],
      expected: EDGE_IPS,
      reason: 'No domain provided to DNS preflight',
    };
  }

  // Strip wildcard prefix — wildcard certs need DNS-01 anyway, but if we
  // ever support http-01 for non-wildcard SAN we want the apex to resolve.
  const target = domain.replace(/^\*\./, '');

  let a = [];
  let aaaa = [];
  try {
    a = await dns.resolve4(target).catch(() => []);
  } catch (_) {}
  try {
    aaaa = await dns.resolve6(target).catch(() => []);
  } catch (_) {}

  const resolved = [...new Set([...a, ...aaaa])];

  if (resolved.length === 0) {
    return {
      ok: false,
      skipped: false,
      resolved,
      expected: EDGE_IPS,
      reason: `Domain ${target} does not resolve to any A or AAAA record`,
    };
  }

  const matched = resolved.some((ip) => EDGE_IPS.includes(ip));
  if (!matched) {
    return {
      ok: false,
      skipped: false,
      resolved,
      expected: EDGE_IPS,
      reason: `Domain ${target} points to ${resolved.join(', ')} but this server expects ${EDGE_IPS.join(', ')}`,
    };
  }

  return { ok: true, skipped: false, resolved, expected: EDGE_IPS };
}

module.exports = { preflight, EDGE_IPS, PREFLIGHT_DISABLED };
