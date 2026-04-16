/**
 * SpinForge - Platform → Nodes
 *
 * Live per-node health. Each card pulses green on a fresh heartbeat,
 * fades amber if the heartbeat is stale, and disappears if the TTL
 * expires in Redis. Cheap on the server — we read the registry once
 * on mount and then swap to the WebSocket for deltas.
 */

import { useEffect, useMemo, useState } from 'react';
import { api, PlatformNodeSnapshot } from '../../services/api';
import { usePlatformSocket, usePlatformSocketAutoConnect, PlatformNode } from '../../hooks/usePlatformSocket';
import { Cpu, MemoryStick, Clock, Server, Activity, RefreshCw } from 'lucide-react';

function formatUptime(sec?: number): string {
  if (!sec) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(n?: number): string {
  if (!n) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

function secondsSince(iso?: string): number {
  if (!iso) return Infinity;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

export default function PlatformNodes() {
  usePlatformSocketAutoConnect();
  const { state, nodeMap, subscribe } = usePlatformSocket();
  const [initial, setInitial] = useState<PlatformNodeSnapshot[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Merge live socket data on top of the REST snapshot. Once the
  // socket has a hostname the REST copy is shadowed.
  const nodes = useMemo<PlatformNode[]>(() => {
    const byHost = new Map<string, PlatformNode>();
    for (const n of initial || []) byHost.set(n.hostname, n as PlatformNode);
    for (const [h, n] of nodeMap.entries()) byHost.set(h, n);
    return Array.from(byHost.values()).sort((a, b) => a.hostname.localeCompare(b.hostname));
  }, [initial, nodeMap, tick]);

  async function loadInitial() {
    try {
      const { nodes } = await api.platformNodes();
      setInitial(nodes);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to load');
    }
  }

  useEffect(() => {
    loadInitial();
    // Subscribe to per-node updates for every node we see.
    // (The events stream would announce new nodes via node.up — we
    // could dynamically subscribe to those too; v1 just polls the
    // registry on a slow timer to catch new nodes.)
    const unsubs: Array<() => void> = [];
    return () => { unsubs.forEach((fn) => fn()); };
  }, []);

  // Subscribe to each node's dedicated channel once we know it exists.
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const seen = new Set<string>();
    for (const n of nodes) {
      if (seen.has(n.hostname)) continue;
      seen.add(n.hostname);
      unsubs.push(subscribe(`node:${n.hostname}`));
    }
    return () => { unsubs.forEach((fn) => fn()); };
  }, [nodes.map((n) => n.hostname).join(','), subscribe]);

  // Force a re-render every 5s so "last seen" labels stay fresh.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Server size={22} /> Nodes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every SpinForge node, live. Heartbeats land every 30s; nodes that miss 3 in a row drop off the registry automatically.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${
            state === 'open' ? 'bg-green-100 text-green-700' :
            state === 'connecting' ? 'bg-amber-100 text-amber-800' :
            'bg-gray-100 text-gray-500'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${state === 'open' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {state}
          </span>
          <button onClick={loadInitial} className="inline-flex items-center gap-1 px-2 py-1 border rounded hover:bg-gray-50">
            <RefreshCw size={12} /> Reload
          </button>
        </div>
      </div>

      {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>}

      {nodes.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-400">
          {initial === null ? 'Loading nodes…' : 'No nodes heartbeating. Is the api running?'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((n) => <NodeCard key={n.hostname} node={n} />)}
        </div>
      )}
    </div>
  );
}

function NodeCard({ node }: { node: PlatformNode }) {
  const age = secondsSince(node.updatedAt);
  const stale = age > 60;
  const dead = age > 120;
  const totalMem = node.memBytes?.total || 0;
  const usedMem = totalMem - (node.memBytes?.free || 0);
  const memPct = totalMem ? Math.round((usedMem / totalMem) * 100) : 0;

  const statusColor =
    dead  ? 'border-red-300 bg-red-50' :
    stale ? 'border-amber-300 bg-amber-50' :
            'border-green-300 bg-white';

  const dotColor =
    dead  ? 'bg-red-500' :
    stale ? 'bg-amber-400' :
            'bg-green-500 animate-pulse';

  return (
    <div className={`border-l-4 ${statusColor} rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
          <div>
            <div className="font-mono font-semibold">{node.hostname}</div>
            <div className="text-xs text-gray-500">{node.ip || '—'}</div>
          </div>
        </div>
        {node.role && node.role !== 'node' && (
          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{node.role}</span>
        )}
      </div>

      <div className="space-y-2 text-xs">
        <Row icon={<Clock size={12} />} label="Node uptime" value={formatUptime(node.nodeUptimeSec)} />
        <Row icon={<Activity size={12} />} label="Load avg" value={
          node.loadAvg ? node.loadAvg.map((x) => x.toFixed(2)).join(' · ') : '—'
        } />
        <Row icon={<Cpu size={12} />} label="CPUs" value={node.cpus ? String(node.cpus) : '—'} />
        <Row icon={<MemoryStick size={12} />} label="Memory" value={
          totalMem ? `${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${memPct}%)` : '—'
        } />
        {totalMem > 0 && (
          <div className="h-1.5 bg-gray-200 rounded overflow-hidden">
            <div
              className={memPct > 85 ? 'h-full bg-red-500' : memPct > 70 ? 'h-full bg-amber-500' : 'h-full bg-green-500'}
              style={{ width: `${memPct}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
        <span>
          {node.spinforgeVersion && <code className="bg-gray-100 px-1 py-0.5 rounded mr-1">{node.spinforgeVersion}</code>}
        </span>
        <span title={node.updatedAt}>{age < 5 ? 'just now' : `${age}s ago`}</span>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 flex items-center gap-1">{icon}{label}</span>
      <span className="font-mono text-gray-800">{value}</span>
    </div>
  );
}
