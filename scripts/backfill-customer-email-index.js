#!/usr/bin/env node
/**
 * SpinForge - rebuild the `customer:email:<email>` reverse index.
 *
 * /_auth/customer/* resolves an address to an account through this index.
 * Customers created by the partner provisioning path (routes/partners.js)
 * never wrote it, so those accounts exist but can't sign in, request a
 * magic link, or reset a password — the endpoints report "no such account"
 * because, as far as the index is concerned, there isn't one.
 *
 * Additive and idempotent: an index entry that already points somewhere is
 * left alone (first claim wins when two customers share an address), and
 * nothing is deleted.
 *
 *   DRY_RUN=1 node scripts/backfill-customer-email-index.js    # report only
 *   node scripts/backfill-customer-email-index.js              # apply
 */
const redis = require('redis');

const HOST = process.env.REDIS_HOST || '192.168.88.170';
const PORT = Number(process.env.REDIS_PORT || 16378);
const DB = Number(process.env.REDIS_DB || 1);
const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  const client = redis.createClient({ socket: { host: HOST, port: PORT }, database: DB });
  client.on('error', (e) => console.error('redis error:', e.message));
  await client.connect();

  const stats = { scanned: 0, alreadyOk: 0, indexed: 0, noEmail: 0, conflict: 0, skipped: 0 };

  const ids = await client.sMembers('customers');
  for (const id of ids) {
    stats.scanned += 1;

    const raw = await client.get(`customer:${id}`);
    if (!raw) { stats.skipped += 1; continue; }

    let customer;
    try { customer = JSON.parse(raw); } catch (_) {
      console.log(`  skip     ${id} (unparseable)`);
      stats.skipped += 1;
      continue;
    }

    const email = String(customer.email || '').trim().toLowerCase();
    if (!email) {
      console.log(`  noemail  ${id}`);
      stats.noEmail += 1;
      continue;
    }

    const current = await client.get(`customer:email:${email}`);
    if (current === id) { stats.alreadyOk += 1; continue; }
    if (current) {
      // Another customer already owns this address. Leave it — silently
      // repointing would move where that person signs in.
      console.log(`  conflict ${email} -> already ${current}, not ${id}`);
      stats.conflict += 1;
      continue;
    }

    console.log(`  index    ${email} -> ${id}`);
    if (!DRY_RUN) await client.set(`customer:email:${email}`, id);
    stats.indexed += 1;
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
