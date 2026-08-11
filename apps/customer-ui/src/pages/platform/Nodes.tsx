/**
 * SpinForge - Platform → Nodes
 *
 * The three actual cluster VMs (one per Nomad client). Source of truth
 * is Nomad's /v1/nodes — the old hand-rolled heartbeat was deleted on
 * 2026-04-17 because Nomad already exposes everything with Serf-grade
 * liveness detection. For container-level detail see the Workloads
 * page, which merges KeyDB site records with Nomad allocations.
 */

import { useEffect, useState } from 'react';
import { api, PlatformNodeSnapshot } from '../../services/api';
import { Cpu, MemoryStick, Clock, Server, RefreshCw, Container, Terminal } from 'lucide-react';

function formatBytes(n?: number | null): string {
  if (!n) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

function secondsSince(iso?: string | null): number {
  if (!iso) return Infinity;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

export default function PlatformNodes() {
  const [nodes, setNodes] = useState<PlatformNodeSnapshot[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  async function load() {
    try {
      const { nodes } = await api.platformNodes();
      setNodes(nodes);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to load');
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);  // 10s poll — Nomad API is cheap
    return () => clearInterval(t);
  }, []);

  // Refresh "last seen" labels every 5s.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, [tick]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Server size={22} /> Cluster nodes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every SpinForge VM, as Nomad sees it. Data is live from <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">GET /v1/nodes</code>.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50">
          <RefreshCw size={12} /> Reload
        </button>
      </div>

      {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>}

      {!nodes ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-400">Loading nodes…</div>
      ) : nodes.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-400">
          Nomad reports zero nodes — is the api container able to reach 127.0.0.1:4646?
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((n) => <NodeCard key={n.nodeId} node={n} />)}
        </div>
      )}
    </div>
  );
}

function NodeCard({ node }: { node: PlatformNodeSnapshot }) {
  const age = secondsSince(node.lastHeartbeat);
  const ready = node.status === 'ready';
  const drain = node.drain;
  const ineligible = node.eligibility !== 'eligible';
  const down = !ready;

  const statusColor =
    down       ? 'border-red-400 bg-red-50' :
    drain      ? 'border-amber-400 bg-amber-50' :
    ineligible ? 'border-amber-300 bg-amber-50' :
                 'border-green-400 bg-white';

  const dotColor =
    down       ? 'bg-red-500' :
    drain      ? 'bg-amber-500' :
    ineligible ? 'bg-amber-400' :
                 'bg-green-500 animate-pulse';

  const statusLabel =
    down       ? node.status :
    drain      ? 'draining' :
    ineligible ? 'ineligible' :
                 'ready';

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
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
          down ? 'bg-red-100 text-red-700' :
          drain || ineligible ? 'bg-amber-100 text-amber-800' :
          'bg-green-100 text-green-700'
        }`}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <Row icon={<Cpu size={12} />}           label="CPU cores"  value={node.cpuCores ? `${node.cpuCores} @ ${node.cpuMHz ? (node.cpuMHz/1000).toFixed(1)+' GHz' : '—'}` : '—'} />
        <Row icon={<MemoryStick size={12} />}   label="Memory"     value={formatBytes(node.memoryBytes)} />
        <Row icon={<Terminal size={12} />}      label="OS"         value={node.os || '—'} />
        <Row icon={<Container size={12} />}     label="Docker"     value={node.dockerVersion || '—'} />
        <Row icon={<Clock size={12} />}         label="DC / class" value={`${node.datacenter || '—'}${node.nodeClass ? ` / ${node.nodeClass}` : ''}`} />
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
        <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">{node.nodeId.slice(0, 8)}</code>
        <span title={node.lastHeartbeat || undefined}>
          {age === Infinity ? '—' : age < 5 ? 'just now' : age < 60 ? `${age}s ago` : `${Math.floor(age/60)}m ago`}
        </span>
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
