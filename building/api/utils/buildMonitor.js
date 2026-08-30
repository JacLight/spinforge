/**
 * buildMonitor — self-describing monitoring for builds (git & zip deploys).
 *
 * Two things live here:
 *   1. monitorLinks(req, build) — the block we attach to a build-create
 *      response so the caller is TOLD, over whatever public URL it reached us
 *      on, exactly how to watch the deploy and when it's done.
 *   2. streamBuild / streamStage — Server-Sent Events handlers that live-tail
 *      the KeyDB event/log streams BuildService writes, so a remote client can
 *      subscribe instead of polling. Auth for EventSource is via ?access_token=
 *      (see admin-auth / customer-auth) since it can't set headers.
 *
 * Shared by routes/builds.js (admin) and routes/customer.js (customer) — the
 * customer routes pass an `authorize` guard to enforce ownership.
 */

const { BUILD_TERMINAL } = require('../services/BuildService');
const STAGE_TERMINAL = new Set(['succeeded', 'failed', 'skipped', 'skipped_unimplemented']);
const TERMINAL_STATUSES = [...BUILD_TERMINAL];

// The public origin the client actually used, honoring the reverse proxy in
// front of us (HAProxy/OpenResty) so the URLs work back over the internet.
function publicBase(req) {
  const xfProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = xfProto || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

// A POST to `.../builds` returns a build whose resource lives at
// `.../builds/<id>`; derive that from the request path so it's correct for
// both /api/builds and /_api/customer/builds without hardcoding mounts.
function monitorLinks(req, build) {
  const base = publicBase(req);
  const collection = req.originalUrl.split('?')[0].replace(/\/+$/, ''); // .../builds
  const self = `${base}${collection}/${build.id}`;
  // On the customer mount an admin acts on behalf of a customer and normally
  // names them with the `x-customer-id` header. EventSource can't set headers,
  // so the SSE URLs would lose that context and the ownership guard would 404.
  // Carry the customer id in the query instead — a real customer's own token
  // still overrides it, so this only rescues the admin-on-behalf stream.
  const isCustomerMount = /(^|\/)_api\/customer\//.test(collection);
  const streamQs = isCustomerMount && build.customerId
    ? `?customerId=${encodeURIComponent(build.customerId)}`
    : '';
  return {
    id: build.id,
    status: build.status,
    // Poll this for the full record (live status + per-stage status).
    self,
    // Recent build-level lifecycle events (snapshot).
    events: `${self}/events`,
    // Live tail (SSE). Open with EventSource; append &access_token=<token>.
    stream: `${self}/stream${streamQs}`,
    // Per-stage live tail (events + stdout/stderr). Substitute the stage id.
    stageStream: `${self}/stages/{stageId}/stream${streamQs}`,
    // The build is finished when `status` is one of these.
    terminalStatuses: TERMINAL_STATUSES,
    poll: { url: self, everyMs: 2000, doneWhen: `status ∈ [${TERMINAL_STATUSES.join(', ')}]` },
    hint:
      'Subscribe: new EventSource(`${stream}?access_token=<token>`) for live events; ' +
      'or poll `self` every ~2s until `status` is terminal. Per-stage logs stream from `stageStream`.',
  };
}

// ─── SSE plumbing ──────────────────────────────────────────────────────
function openSse(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // OpenResty/nginx: don't buffer, flush each event immediately.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  const comment = (t) => res.write(`: ${t}\n\n`);
  let closed = false;
  req.on('close', () => { closed = true; });
  const heartbeat = setInterval(() => { if (!closed) comment('hb'); }, 15_000);
  return { send, comment, isClosed: () => closed, close: () => { closed = true; }, stop: () => clearInterval(heartbeat) };
}

// GET .../builds/:id/stream — live tail of the whole build.
async function streamBuild(req, res, { authorize } = {}) {
  const builds = req.app.locals.builds;
  const redis = req.app.locals.redis;
  const logger = req.app.locals.logger || console;
  const id = req.params.id;

  const current = await builds.get(id);
  if (!current) return res.status(404).json({ error: 'build_not_found' });
  if (authorize && !authorize(req, current)) return res.status(404).json({ error: 'build_not_found' });

  const sse = openSse(req, res);
  const blocker = redis.duplicate();
  try {
    await blocker.connect();
    // Snapshot first so a late subscriber sees current state immediately.
    sse.send({ kind: 'snapshot', build: current });
    for (const ev of await builds.recentBuildEvents(id, 200)) sse.send({ kind: 'event', ...ev });
    if (BUILD_TERMINAL.has(current.status)) {
      sse.send({ kind: 'end', status: current.status });
      sse.close();
    }

    let lastId = req.query.lastId || '$';
    while (!sse.isClosed()) {
      const { rows, lastId: nl } = await builds.tailBuildEvents(id, lastId, { client: blocker, blockMs: 5000, limit: 200 });
      lastId = nl;
      for (const ev of rows) sse.send({ kind: 'event', ...ev });
      const fresh = await builds.get(id);
      if (fresh && BUILD_TERMINAL.has(fresh.status)) {
        sse.send({ kind: 'end', status: fresh.status, build: fresh });
        sse.close();
      }
    }
  } catch (err) {
    logger.error(`[sse build=${id}] ${err.message}`);
    try { sse.send({ kind: 'error', message: err.message }); } catch (_) { /* socket gone */ }
  } finally {
    sse.stop();
    try { await blocker.quit(); } catch (_) { /* already gone */ }
    res.end();
  }
}

// GET .../builds/:id/stages/:stageId/stream — live tail of one stage's
// structured events AND stdout/stderr, combined.
async function streamStage(req, res, { authorize } = {}) {
  const builds = req.app.locals.builds;
  const redis = req.app.locals.redis;
  const logger = req.app.locals.logger || console;
  const { id, stageId } = req.params;

  const current = await builds.get(id);
  if (!current) return res.status(404).json({ error: 'build_not_found' });
  if (authorize && !authorize(req, current)) return res.status(404).json({ error: 'build_not_found' });
  const stage0 = (current.stages || []).find((s) => s.id === stageId);
  if (!stage0) return res.status(404).json({ error: 'stage_not_found' });

  const evKey = `build:${id}:stage:${stageId}:events`;
  const logKey = `build:${id}:stage:${stageId}:log`;

  const sse = openSse(req, res);
  const blocker = redis.duplicate();
  try {
    await blocker.connect();
    sse.send({ kind: 'snapshot', stage: stage0 });
    for (const ev of await builds.recentStageEvents(id, stageId, 200)) sse.send({ kind: 'event', ...ev });
    for (const ln of await builds.recentStageLog(id, stageId, 500)) sse.send({ kind: 'log', ...ln });

    const stageTerminal = () => STAGE_TERMINAL.has(stage0.status);
    if (stageTerminal()) { sse.send({ kind: 'end', status: stage0.status }); sse.close(); }

    let lastEv = '$';
    let lastLog = '$';
    while (!sse.isClosed()) {
      const rd = await blocker.xRead(
        [{ key: evKey, id: lastEv }, { key: logKey, id: lastLog }],
        { COUNT: 200, BLOCK: 5000 }
      );
      if (rd) {
        for (const stream of rd) {
          const isLog = stream.name === logKey;
          for (const m of stream.messages) {
            sse.send({ kind: isLog ? 'log' : 'event', id: m.id, ...m.message });
            if (isLog) lastLog = m.id; else lastEv = m.id;
          }
        }
      }
      // Terminal check off the live record.
      const fresh = await builds.get(id);
      const st = fresh && (fresh.stages || []).find((s) => s.id === stageId);
      if (st && STAGE_TERMINAL.has(st.status)) {
        sse.send({ kind: 'end', status: st.status, stage: st });
        sse.close();
      }
    }
  } catch (err) {
    logger.error(`[sse build=${id} stage=${stageId}] ${err.message}`);
    try { sse.send({ kind: 'error', message: err.message }); } catch (_) { /* socket gone */ }
  } finally {
    sse.stop();
    try { await blocker.quit(); } catch (_) { /* already gone */ }
    res.end();
  }
}

module.exports = { monitorLinks, publicBase, streamBuild, streamStage };
