#!/usr/bin/env node
/**
 * SpinForge - assign appId to sites created before manifest support.
 *
 * Every app needs a stable `appId` and an `app:<appId>` -> domain pointer so
 * a committed spinforge.yaml can resolve it. Sites created before that
 * existed have neither. This walks `site:*` and fills the gap.
 *
 * Additive and idempotent: sites that already have an appId are left alone,
 * and re-running only repairs a missing pointer. Nothing is deleted.
 *
 *   DRY_RUN=1 node scripts/backfill-app-ids.js    # report only
 *   node scripts/backfill-app-ids.js              # apply
 *
 * Reads REDIS_HOST / REDIS_PORT / REDIS_DB (defaults match the cluster).
 */
const crypto = require('crypto');
const redis = require('redis');

const HOST = process.env.REDIS_HOST || '192.168.88.170';
const PORT = Number(process.env.REDIS_PORT || 16378);
const DB = Number(process.env.REDIS_DB || 1);
const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  const client = redis.createClient({ socket: { host: HOST, port: PORT }, database: DB });
  client.on('error', (e) => console.error('redis error:', e.message));
  await client.connect();

  const stats = { scanned: 0, alreadyOk: 0, assigned: 0, pointerRepaired: 0, skipped: 0 };

  for await (const key of client.scanIterator({ MATCH: 'site:*', COUNT: 200 })) {
    stats.scanned += 1;
    const raw = await client.get(key);
    if (!raw) { stats.skipped += 1; continue; }

    let site;
    try { site = JSON.parse(raw); } catch (_) {
      console.log(`  skip   ${key} (unparseable)`);
      stats.skipped += 1;
      continue;
    }

    const domain = site.domain || key.slice('site:'.length);

    if (site.appId) {
      // Has an id — make sure the pointer exists and points here.
      const current = await client.get(`app:${site.appId}`);
      if (current === domain) {
        stats.alreadyOk += 1;
      } else {
        console.log(`  repair ${domain} -> app:${site.appId} (was ${current || 'missing'})`);
        if (!DRY_RUN) await client.set(`app:${site.appId}`, domain);
        stats.pointerRepaired += 1;
      }
      continue;
    }

    const appId = `app_${crypto.randomUUID()}`;
    console.log(`  assign ${domain} -> ${appId}`);
    if (!DRY_RUN) {
      site.appId = appId;
      await client.set(key, JSON.stringify(site));
      await client.set(`app:${appId}`, domain);
    }
    stats.assigned += 1;
  }

  console.log('');
  console.log(DRY_RUN ? 'DRY RUN — nothing written' : 'applied');
  console.log(JSON.stringify(stats, null, 2));
  await client.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
