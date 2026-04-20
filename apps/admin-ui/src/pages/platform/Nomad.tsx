/**
 * SpinForge - Platform → Nomad
 *
 * Operator dashboard for the Nomad cluster. All data comes through
 * spinforge-api's /_admin/platform/* endpoints — the Nomad HTTP API
 * (port 4646) lives on private IPs that operators can't reach from
 * outside the datacenter, so we surface it via the same admin session
 * that already speaks HTTPS through Cloudflare.
 *
 * Shows: server quorum, client nodes, running jobs, recent allocations.
 */

import { useEffect, useState } from 'react';
import { Layers, Box, Server, RefreshCw, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import {
  api,
  PlatformNodeSnapshot,
  PlatformAllocation,
  PlatformJob,
} from '../../services/api';

function secondsSince(iso?: string | null): number {
  if (!iso) return Infinity;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

function relativeTime(iso?: string | null): string {
  const s = secondsSince(iso);
  if (s === Infinity) return '—';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function PlatformNomad() {
  const [nodes, setNodes] = useState<PlatformNodeSnapshot[] | null>(null);
  const [jobs, setJobs] = useState<PlatformJob[] | null>(null);
  const [allocs, setAllocs] = useState<PlatformAllocation[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [n, j, a] = await Promise.all([
        api.platformNodes().then((r) => r.nodes),
        api.platformJobs().then((r) => r.jobs),
        api.platformAllocations().then((r) => r.allocations),
      ]);
      setNodes(n); setJobs(j); setAllocs(a);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to load');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Layers size={22} /> Nomad</h1>
          <p className="text-sm text-gray-500 mt-1">
            Scheduler state — nodes, jobs, and allocations. Refreshes every 15s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://nomad.spinforge.dev/ui/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700"
          >
            Open native Nomad UI <ExternalLink size={14} />
          </a>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
          </button>
        </div>
      </div>

      {err && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>}

      {/* Top summary — counts */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<Server size={18} />} color="emerald" label="Client nodes" value={nodes ? `${nodes.filter((n) => n.status === 'ready').length} / ${nodes.length}` : '—'} subtext="ready / total" />
        <StatCard icon={<Layers size={18} />} color="fuchsia" label="Jobs" value={jobs ? `${jobs.filter((j) => j.status === 'running').length} / ${jobs.length}` : '—'} subtext="running / total" />
        <StatCard icon={<Box size={18} />} color="cyan" label="Allocations" value={allocs ? `${allocs.filter((a) => a.clientStatus === 'running').length} / ${allocs.length}` : '—'} subtext="running / total" />
        <StatCard icon={<Clock size={18} />} color="gray" label="Poll" value={loading ? 'live' : 'idle'} subtext="15s interval" />
      </div>

      {/* Jobs */}
      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">Jobs ({jobs?.length ?? 0})</h2>
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left w-20">Type</th>
                <th className="px-3 py-2 text-left w-24">Status</th>
                <th className="px-3 py-2 text-left w-32">Running</th>
                <th className="px-3 py-2 text-left w-40">Datacenters</th>
                <th className="px-3 py-2 text-left w-36">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {!jobs ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-400">Loading…</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-400">No jobs.</td></tr>
              ) : jobs.map((j) => (
                <tr key={j.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-indigo-600">{j.id}</td>
                  <td className="px-3 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{j.type}</code></td>
                  <td className="px-3 py-2">
                    <StatusChip ok={j.status === 'running'} label={j.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {j.running} / {j.desired}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{j.datacenters.join(', ')}</td>
                  <td className="px-3 py-2 text-xs text-gray-500" title={j.submittedAt || undefined}>{relativeTime(j.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Allocations */}
      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">Allocations ({allocs?.length ?? 0})</h2>
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left w-24">ID</th>
                <th className="px-3 py-2 text-left">Job</th>
                <th className="px-3 py-2 text-left w-28">Task group</th>
                <th className="px-3 py-2 text-left w-36">Node</th>
                <th className="px-3 py-2 text-left w-24">Status</th>
                <th className="px-3 py-2 text-left w-16">Ver</th>
                <th className="px-3 py-2 text-left w-28">Created</th>
              </tr>
            </thead>
            <tbody>
              {!allocs ? (
                <tr><td colSpan={7} className="p-4 text-center text-gray-400">Loading…</td></tr>
              ) : allocs.length === 0 ? (
                <tr><td colSpan={7} className="p-4 text-center text-gray-400">No allocations.</td></tr>
              ) : allocs
                  .sort((a, b) => (a.jobId).localeCompare(b.jobId))
                  .map((a) => (
                    <tr key={a.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{a.shortId}</td>
                      <td className="px-3 py-2 font-mono">{a.jobId}</td>
                      <td className="px-3 py-2 text-xs">{a.taskGroup}</td>
                      <td className="px-3 py-2 text-xs">{a.nodeName}</td>
                      <td className="px-3 py-2">
                        <StatusChip ok={a.clientStatus === 'running'} label={a.clientStatus} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{a.version}</td>
                      <td className="px-3 py-2 text-xs text-gray-500" title={a.createTime || undefined}>{relativeTime(a.createTime)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, color, label, value, subtext }: {
  icon: React.ReactNode;
  color: 'emerald' | 'fuchsia' | 'cyan' | 'gray';
  label: string;
  value: string;
  subtext?: string;
}) {
  const colorMap = {
    emerald: 'from-emerald-500 to-emerald-600 text-emerald-50',
    fuchsia: 'from-fuchsia-500 to-fuchsia-600 text-fuchsia-50',
    cyan:    'from-cyan-500 to-cyan-600 text-cyan-50',
    gray:    'from-gray-500 to-gray-600 text-gray-50',
  };
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className={`inline-flex p-2 rounded-lg bg-gradient-to-r ${colorMap[color]} mb-2`}>
        {icon}
      </div>
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {subtext && <div className="text-xs text-gray-400 mt-0.5">{subtext}</div>}
    </div>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
      ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
      {label}
    </span>
  );
}
