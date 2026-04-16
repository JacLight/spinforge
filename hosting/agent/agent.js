/**
 * SpinForge Agent
 *
 * Runs one-per-node as a docker container. Two jobs:
 *
 *   1. Heartbeat — writes platform:agent:<hostname> to Redis every
 *      AGENT_INTERVAL_MS with detailed node state the api replica
 *      can't see from inside its own container (host-level docker ps,
 *      docker stats, disk usage, /proc).
 *
 *   2. Command subscriber — listens on Redis pubsub channels
 *      `node:<hostname>:commands` (targeted) and `node:all:commands`
 *      (broadcast). Executes the command locally and publishes the
 *      result on the reply channel the caller supplied.
 *
 * Command envelope (JSON on the channel):
 *
 *   { id, op, args, reply }   — `id` correlates response; `reply` is
 *                               the pubsub channel to publish to.
 *
 * Vocabulary (v1):
 *
 *   ping                        → { ok: true, hostname, ts }
 *   docker.ps                   → { containers: [...] }
 *   docker.stats <name?>        → { stats: {...} }
 *   docker.restart <name>       → { ok, name }
 *   docker.logs <name> <lines?> → { logs: "..." }
 *
 * Security posture (v1): trusted LAN + unauthenticated Redis. The
 * agent will execute any well-formed command from anyone who can
 * publish to its channel. OK for dev, MUST become authenticated
 * before this is reachable from outside the cluster. See SECURITY
 * TODO at the bottom.
 */

const os = require('os');
const Docker = require('dockerode');
const redisLib = require('redis');

const HOSTNAME = os.hostname();
const INTERVAL_MS = Number(process.env.AGENT_INTERVAL_MS) || 15_000;
const KEY_PREFIX = 'platform:agent:';
const CMD_CHANNEL = `node:${HOSTNAME}:commands`;
const BROADCAST_CHANNEL = 'node:all:commands';

const REDIS_URL = process.env.REDIS_URL
  || `redis://${process.env.REDIS_HOST || '172.18.0.10'}:${process.env.REDIS_PORT || 16378}/${process.env.REDIS_DB || 1}`;

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

let writer = null;   // publishes heartbeat + command responses
let reader = null;   // subscribes to command channels

function log(...args) { console.log(`[agent ${HOSTNAME}]`, ...args); }
function warn(...args) { console.warn(`[agent ${HOSTNAME}]`, ...args); }
function err(...args) { console.error(`[agent ${HOSTNAME}]`, ...args); }

// ─── Connection setup ────────────────────────────────────────────────
async function connect() {
  writer = redisLib.createClient({ url: REDIS_URL });
  reader = writer.duplicate();
  writer.on('error', (e) => err('writer:', e.message));
  reader.on('error', (e) => err('reader:', e.message));
  await Promise.all([writer.connect(), reader.connect()]);
  log(`connected to redis at ${REDIS_URL}`);
}

// ─── Heartbeat ───────────────────────────────────────────────────────
async function heartbeat() {
  try {
    const containers = await docker.listContainers({ all: true });
    const info = await docker.info();
    const state = {
      hostname: HOSTNAME,
      agentVersion: '1.0.0',
      updatedAt: new Date().toISOString(),
      host: {
        uptimeSec: Math.round(os.uptime()),
        loadAvg: os.loadavg(),
        memBytes: { total: os.totalmem(), free: os.freemem() },
        cpus: os.cpus().length,
      },
      docker: {
        serverVersion: info.ServerVersion,
        containers: containers.map((c) => ({
          id: (c.Id || '').slice(0, 12),
          name: (c.Names && c.Names[0] ? c.Names[0].replace(/^\//, '') : null),
          image: c.Image,
          state: c.State,
          status: c.Status,
          ports: (c.Ports || []).map((p) => ({ private: p.PrivatePort, public: p.PublicPort, type: p.Type })),
        })),
      },
    };
    await writer.set(KEY_PREFIX + HOSTNAME, JSON.stringify(state), { EX: 90 });
  } catch (e) {
    warn('heartbeat failed:', e.message);
  }
}

// ─── Command handling ────────────────────────────────────────────────
async function handleCommand(channel, rawMsg) {
  let msg;
  try { msg = JSON.parse(rawMsg); } catch { warn('bad JSON on', channel); return; }

  const { id, op, args, reply } = msg;
  const respond = async (payload) => {
    if (!reply) return;
    try { await writer.publish(reply, JSON.stringify({ id, hostname: HOSTNAME, ...payload })); }
    catch (e) { warn(`respond() failed: ${e.message}`); }
  };

  try {
    let result;
    switch (op) {
      case 'ping':
        result = { ok: true, hostname: HOSTNAME, ts: new Date().toISOString() };
        break;

      case 'docker.ps':
        result = await opDockerPs();
        break;

      case 'docker.stats':
        result = await opDockerStats(args?.name);
        break;

      case 'docker.restart':
        if (!args?.name) throw new Error('docker.restart: name is required');
        result = await opDockerRestart(args.name);
        break;

      case 'docker.logs':
        if (!args?.name) throw new Error('docker.logs: name is required');
        result = await opDockerLogs(args.name, args?.tail || 200);
        break;

      default:
        throw new Error(`unknown op: ${op}`);
    }
    await respond({ ok: true, result });
  } catch (e) {
    await respond({ ok: false, error: e.message });
  }
}

async function opDockerPs() {
  const list = await docker.listContainers({ all: true });
  return {
    containers: list.map((c) => ({
      id: (c.Id || '').slice(0, 12),
      name: (c.Names && c.Names[0] ? c.Names[0].replace(/^\//, '') : null),
      image: c.Image,
      state: c.State,
      status: c.Status,
    })),
  };
}

async function opDockerStats(name) {
  if (name) {
    const c = docker.getContainer(name);
    const stats = await c.stats({ stream: false });
    return { stats };
  }
  // No name → return high-level per-container summary
  const list = await docker.listContainers();
  const out = [];
  for (const c of list) {
    try {
      const obj = docker.getContainer(c.Id);
      const s = await obj.stats({ stream: false });
      out.push({
        name: (c.Names && c.Names[0] ? c.Names[0].replace(/^\//, '') : null),
        cpuPercent: approxCpuPercent(s),
        memUsage: s?.memory_stats?.usage ?? null,
        memLimit: s?.memory_stats?.limit ?? null,
      });
    } catch (_) { /* skip containers we can't read */ }
  }
  return { stats: out };
}

function approxCpuPercent(s) {
  try {
    const cpuDelta = s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage;
    const sysDelta = s.cpu_stats.system_cpu_usage - s.precpu_stats.system_cpu_usage;
    const cpus = (s.cpu_stats.online_cpus || s.cpu_stats.cpu_usage.percpu_usage?.length || 1);
    if (sysDelta > 0 && cpuDelta > 0) return +(cpuDelta / sysDelta * cpus * 100).toFixed(2);
  } catch (_) {}
  return null;
}

async function opDockerRestart(name) {
  const c = docker.getContainer(name);
  await c.restart({ t: 10 });
  return { ok: true, name };
}

async function opDockerLogs(name, tail) {
  const c = docker.getContainer(name);
  const buf = await c.logs({ stdout: true, stderr: true, tail, follow: false, timestamps: true });
  return { logs: stripDockerHeader(buf).toString('utf8') };
}

// Docker multiplexes stdout/stderr with an 8-byte header per chunk.
// Strip it so the caller gets plain text.
function stripDockerHeader(buf) {
  const chunks = [];
  let i = 0;
  while (i + 8 <= buf.length) {
    const size = buf.readUInt32BE(i + 4);
    if (size <= 0 || i + 8 + size > buf.length) break;
    chunks.push(buf.slice(i + 8, i + 8 + size));
    i += 8 + size;
  }
  return Buffer.concat(chunks);
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  await connect();
  await reader.subscribe(CMD_CHANNEL, handleCommand);
  await reader.subscribe(BROADCAST_CHANNEL, handleCommand);
  log(`subscribed to ${CMD_CHANNEL} + ${BROADCAST_CHANNEL}`);

  await heartbeat();
  setInterval(heartbeat, INTERVAL_MS);

  // Graceful shutdown — wipe our key so the UI shows us disappear
  // immediately rather than waiting for TTL.
  const shutdown = async () => {
    log('shutdown, deleting heartbeat key');
    try { await writer.del(KEY_PREFIX + HOSTNAME); } catch (_) {}
    try { await reader.quit(); } catch (_) {}
    try { await writer.quit(); } catch (_) {}
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => { err('fatal:', e); process.exit(1); });

/*
 * SECURITY TODO (before this goes anywhere near the open internet):
 *   - Require HMAC signature on inbound commands using a shared key
 *     bound per-node at provisioning time.
 *   - Lock the command vocabulary to an allow-list; never add an
 *     exec/shell op without per-command signing + audit.
 *   - Scope Redis ACLs so the agent can only read its own channel
 *     and publish to a narrow set of reply channels.
 *   - Drop privileges inside the container where possible (agent
 *     needs docker, nothing else).
 */
