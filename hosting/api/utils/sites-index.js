/**
 * Maintained indexes for the site: records.
 *
 * Every call to `redisClient.keys('site:*')` is O(N) across the whole key-
 * space and stalls a single-threaded Redis for however long it takes to
 * scan. That's fine at 20 sites and terrible at 20,000. Instead we keep
 * two sets in sync with every write:
 *
 *   sites:all              — every domain with a `site:<domain>` record
 *   sites:customer:<id>    — domains owned by a specific customer
 *
 * On startup we rebuild the index if it's empty but site:* records exist
 * (covers the migration from the old KEYS-scanning code to the new one).
 *
 * The Redis client here is node-redis v4, so the lowercase method names
 * (sAdd/sRem/sMembers/scanIterator) are the ones in use — not the uppercase
 * SADD/SMEMBERS from ioredis. Keep that in mind if anyone ports this.
 */

const redisClient = require('./redis');

const ALL_SET = 'sites:all';
const customerSet = (id) => `sites:customer:${id}`;

async function registerSite(domain, customerId) {
  if (!domain) return;
  await redisClient.sAdd(ALL_SET, domain);
  if (customerId) {
    await redisClient.sAdd(customerSet(customerId), domain);
  }
}

async function unregisterSite(domain, customerId) {
  if (!domain) return;
  await redisClient.sRem(ALL_SET, domain);
  if (customerId) {
    await redisClient.sRem(customerSet(customerId), domain);
  }
}

async function listAllDomains() {
  return redisClient.sMembers(ALL_SET);
}

// Drop-in replacement for the old `redisClient.keys('site:*')` pattern.
// Returns `["site:foo.com", "site:bar.com", …]` so callers that iterate and
// GET each key don't need to change their loop shape.
async function listAllSiteKeys() {
  const domains = await listAllDomains();
  return domains.map((d) => `site:${d}`);
}

async function listDomainsForCustomer(customerId) {
  if (!customerId) return [];
  return redisClient.sMembers(customerSet(customerId));
}

/**
 * One-shot rebuild of the indexes by scanning existing site:* keys. Used
 * both at startup (to backfill the index after deploying this code) and as
 * a manual repair endpoint.
 */
async function rebuildIndex() {
  const domains = [];
  const customerMap = {};

  for await (const key of redisClient.scanIterator({ MATCH: 'site:*', COUNT: 500 })) {
    const domain = key.slice('site:'.length);
    const raw = await redisClient.get(key);
    if (!raw) continue;
    let site;
    try { site = JSON.parse(raw); } catch (_) { continue; }
    domains.push(domain);
    const cid = site.customerId;
    if (cid) {
      (customerMap[cid] = customerMap[cid] || []).push(domain);
    }
  }

  if (domains.length > 0) {
    await redisClient.del(ALL_SET);
    await redisClient.sAdd(ALL_SET, domains);
  }
  for (const [cid, doms] of Object.entries(customerMap)) {
    const key = customerSet(cid);
    await redisClient.del(key);
    if (doms.length > 0) await redisClient.sAdd(key, doms);
  }

  return { domains: domains.length, customers: Object.keys(customerMap).length };
}

/**
 * Called at boot. If the index is populated, do nothing. If it's empty
 * *and* there's at least one site: record, rebuild. Wrapped in a cluster
 * lock so only one node in a multi-replica deployment does the work.
 */
async function ensureIndexOnBoot() {
  const count = await redisClient.sCard(ALL_SET);
  if (count > 0) return { skipped: true, reason: 'already populated' };

  const { withClusterLock } = require('./cluster-lock');
  return withClusterLock('boot:sites-index-rebuild', 120, async () => {
    // Re-check inside the lock — another node may have rebuilt while we
    // waited for the lock.
    const recheck = await redisClient.sCard(ALL_SET);
    if (recheck > 0) return { skipped: true, reason: 'rebuilt by another node' };

    // Quick peek: any site:* key at all?
    for await (const key of redisClient.scanIterator({ MATCH: 'site:*', COUNT: 1 })) {
      if (key) {
        return rebuildIndex();
      }
    }
    return { skipped: true, reason: 'no sites exist yet' };
  });
}

module.exports = {
  registerSite,
  unregisterSite,
  listAllDomains,
  listDomainsForCustomer,
  rebuildIndex,
  ensureIndexOnBoot,
  ALL_SET,
};
