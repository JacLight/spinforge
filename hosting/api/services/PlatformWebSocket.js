/**
 * SpinForge - Platform WebSocket bridge.
 *
 * One WebSocket endpoint, mounted at /_admin/platform/subscribe, that
 * the UI connects to after initial auth. Once connected, the client
 * tells us what streams it cares about, and we push deltas as they
 * happen — no polling, no refresh.
 *
 * Stream types the client can subscribe to:
 *
 *   events               — the platform:events Redis stream (global)
 *   node:<hostname>      — heartbeats + state changes for a node
 *   workload:<domain>    — deploy/restart/crash for a specific site
 *
 * Wire protocol (both directions, JSON lines):
 *
 *   client → server
 *     { op: "subscribe",   topic: "events" }
 *     { op: "subscribe",   topic: "node:spinforge-02" }
 *     { op: "unsubscribe", topic: "events" }
 *     { op: "ping" }
 *
 *   server → client
 *     { topic: "events",  event: { id, type, subject, severity, ... } }
 *     { topic: "node:x",  node:  { hostname, ip, loadAvg, ... } }
 *     { type: "pong" }
 *     { type: "error",    message: "..." }
 *
 * Intentionally a thin fan-out over Redis. No state beyond "who
 * subscribes to what" lives here.
 */

const { WebSocketServer } = require('ws');
const EventStream = require('./EventStream');
const { KEY_PREFIX: NODE_KEY_PREFIX } = require('./NodeHeartbeat');

const NODE_POLL_MS = 5000;        // how often we re-read a node's key
const EVENT_BLOCK_MS = 5000;       // XREAD block window
const PING_INTERVAL_MS = 30_000;   // keep NAT/proxies from killing idle sockets

/**
 * Mount the WS server on an existing HTTP server. Call once at api
 * startup with the authenticator from utils/admin-auth so we can
 * gate access the same way REST is gated.
 */
function mountPlatformWebSocket({ httpServer, redis, authenticator, logger }) {
  const log = logger || console;
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (req, socket, head) => {
    if (!req.url || !req.url.startsWith('/_admin/platform/subscribe')) {
      // Not our path — let another upgrade handler claim it, or drop.
      return;
    }
    try {
      const admin = await authenticator(req);
      if (!admin) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.admin = admin;
        wss.emit('connection', ws, req);
      });
    } catch (err) {
      log.error('[platform-ws] upgrade failed:', err.message);
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    const subscriptions = new Map(); // topic → cancel fn
    let pingTimer = null;

    const send = (obj) => {
      if (ws.readyState !== ws.OPEN) return;
      try { ws.send(JSON.stringify(obj)); } catch (_) {}
    };

    // Keepalive — we push a tiny ping message so the client and any
    // intermediaries don't reap the socket. Clients can also send
    // { op: "ping" } to get a { type: "pong" }.
    pingTimer = setInterval(() => {
      try { ws.ping(); } catch (_) {}
    }, PING_INTERVAL_MS);

    const cleanup = () => {
      if (pingTimer) clearInterval(pingTimer);
      for (const cancel of subscriptions.values()) {
        try { cancel(); } catch (_) {}
      }
      subscriptions.clear();
    };

    ws.on('close', cleanup);
    ws.on('error', (err) => {
      log.warn('[platform-ws] client error:', err.message);
      cleanup();
    });

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch { send({ type: 'error', message: 'invalid JSON' }); return; }

      switch (msg.op) {
        case 'ping':
          send({ type: 'pong' });
          return;

        case 'subscribe':
          await subscribe(msg.topic);
          return;

        case 'unsubscribe':
          unsubscribe(msg.topic);
          return;

        default:
          send({ type: 'error', message: `unknown op: ${msg.op}` });
      }
    });

    async function subscribe(topic) {
      if (!topic || typeof topic !== 'string') {
        send({ type: 'error', message: 'topic required' }); return;
      }
      if (subscriptions.has(topic)) return; // idempotent

      if (topic === 'events') {
        const cancel = tailEvents(ws, redis, log);
        subscriptions.set(topic, cancel);
        send({ type: 'subscribed', topic });
        return;
      }

      if (topic.startsWith('node:')) {
        const hostname = topic.slice('node:'.length);
        const cancel = pollNode(ws, redis, hostname);
        subscriptions.set(topic, cancel);
        send({ type: 'subscribed', topic });
        return;
      }

      send({ type: 'error', message: `unknown topic: ${topic}` });
    }

    function unsubscribe(topic) {
      const cancel = subscriptions.get(topic);
      if (cancel) { try { cancel(); } catch (_) {} subscriptions.delete(topic); }
      send({ type: 'unsubscribed', topic });
    }

    send({ type: 'hello', features: ['events', 'node:<hostname>'] });
  });

  log.info('[platform-ws] mounted at /_admin/platform/subscribe');
  return wss;
}

/**
 * Background loop that tails the events stream and pushes new entries
 * to a single client. Returns a cancel function.
 */
function tailEvents(ws, redis, log) {
  let stopped = false;
  let lastId = '$'; // start from "new entries only"

  // Separate Redis connection for the blocking XREAD so it doesn't
  // starve other commands on the shared client.
  const blockingClient = redis.duplicate();
  blockingClient.on('error', (err) => log.warn('[platform-ws] blockingClient error:', err.message));
  let ready = blockingClient.connect().catch((err) => {
    log.error('[platform-ws] blockingClient connect failed:', err.message);
    return null;
  });

  const loop = async () => {
    await ready;
    const stream = new EventStream(blockingClient, { logger: log });
    while (!stopped && ws.readyState === ws.OPEN) {
      try {
        const { events, lastId: newLast } = await stream.tailFrom(lastId, 200, EVENT_BLOCK_MS);
        if (stopped) break;
        for (const ev of events) {
          try { ws.send(JSON.stringify({ topic: 'events', event: ev })); } catch (_) {}
        }
        lastId = newLast;
      } catch (err) {
        log.warn('[platform-ws] events tail error:', err.message);
        await sleep(1000);
      }
    }
  };

  loop().catch(() => {});

  return () => {
    stopped = true;
    try { blockingClient.quit(); } catch (_) {}
  };
}

/**
 * Polls a node's heartbeat key every NODE_POLL_MS and pushes the
 * state to the client when it changes. Cheap on Redis — just a GET.
 */
function pollNode(ws, redis, hostname) {
  let stopped = false;
  let lastSerialized = null;
  const key = NODE_KEY_PREFIX + hostname;

  const loop = async () => {
    while (!stopped && ws.readyState === ws.OPEN) {
      try {
        const raw = await redis.get(key);
        if (raw !== lastSerialized) {
          lastSerialized = raw;
          if (raw) {
            try { ws.send(JSON.stringify({ topic: `node:${hostname}`, node: JSON.parse(raw) })); } catch (_) {}
          } else {
            try { ws.send(JSON.stringify({ topic: `node:${hostname}`, node: null, gone: true })); } catch (_) {}
          }
        }
      } catch (_) {}
      await sleep(NODE_POLL_MS);
    }
  };

  loop().catch(() => {});
  return () => { stopped = true; };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = { mountPlatformWebSocket };
