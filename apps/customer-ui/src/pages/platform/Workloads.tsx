/**
 * SpinForge - Platform → Workloads
 *
 * Every customer site across the cluster. Grouped by type with
 * per-site quick facts. Click a row → link through to the existing
 * Application detail page for the full drawer.
 *
 * No WebSocket subscription here (yet); the events feed on the
 * Events page already announces deploys. A future enhancement: when
 * a site.created / site.updated / site.deleted event fires, refresh
 * this list in place.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Package, Layers, Shuffle, Box, RefreshCw, Check, X as XIcon } from 'lucide-react';
import { api, PlatformWorkload } from '../../services/api';

function typeIcon(t: string) {
  switch (t) {
    case 'container': return <Box size={14} className="text-blue-500" />;
    case 'node':      return <Box size={14} className="text-indigo-500" />;
    case 'static':    return <Package size={14} className="text-green-500" />;
    case 'proxy':     return <Shuffle size={14} className="text-amber-500" />;
    case 'loadbalancer': return <Layers size={14} className="text-purple-500" />;
    default:          return <Package size={14} className="text-gray-400" />;
  }
}

export default function PlatformWorkloads() {
  const [workloads, setWorkloads] = useState<PlatformWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  async function load() {
    setLoading(true);
    try {
      const { workloads } = await api.platformWorkloads();
      setWorkloads(workloads);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let out = workloads;
    if (typeFilter) out = out.filter((w) => w.type === typeFilter);
    if (q.trim()) {
      const needle = q.toLowerCase();
      out = out.filter((w) =>
        (w.domain || '').toLowerCase().includes(needle) ||
        (w.customerId || '').toLowerCase().includes(needle)
      );
    }
    return out;
  }, [workloads, q, typeFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const w of workloads) c[w.type] = (c[w.type] || 0) + 1;
    return c;
  }, [workloads]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package size={22} /> Workloads
            <span className="ml-2 text-sm font-normal text-gray-500">{workloads.length} total</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Every customer site across the cluster. Click any row to open it.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
            <input
              className="pl-7 pr-3 py-1.5 border rounded text-sm w-64"
              placeholder="Domain or customer…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button onClick={load} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
            <RefreshCw size={14} /> Reload
          </button>
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Pill active={typeFilter === ''} onClick={() => setTypeFilter('')}>
          All <span className="text-gray-400 ml-1">({workloads.length})</span>
        </Pill>
        {Object.entries(counts).sort().map(([t, n]) => (
          <Pill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
            <span className="flex items-center gap-1">{typeIcon(t)}{t} <span className="text-gray-400 ml-1">({n})</span></span>
          </Pill>
        ))}
      </div>

      {err && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>}

      <div className="bg-white border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {q || typeFilter ? 'No matches.' : 'No workloads yet.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Domain</th>
                <th className="px-3 py-2 text-left font-semibold w-24">Type</th>
                <th className="px-3 py-2 text-left font-semibold w-48">Customer</th>
                <th className="px-3 py-2 text-left font-semibold w-24">SSL</th>
                <th className="px-3 py-2 text-left font-semibold w-28">Status</th>
                <th className="px-3 py-2 text-left font-semibold w-56">Running on</th>
                <th className="px-3 py-2 text-left font-semibold w-36">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.domain} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link to={`/applications/${encodeURIComponent(w.domain)}`} className="font-mono text-indigo-600 hover:underline">
                      {w.domain}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">{typeIcon(w.type)}<span>{w.type}</span></span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-xs">{w.customerId || '—'}</td>
                  <td className="px-3 py-2">
                    {w.sslEnabled ? <Check size={14} className="text-green-600" /> : <XIcon size={14} className="text-gray-400" />}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {w.enabled ? (
                      <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> enabled
                      </span>
                    ) : (
                      <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">disabled</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {w.type === 'static' ? (
                      <span className="text-gray-400">ceph · every node</span>
                    ) : w.allocations && w.allocations.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {w.allocations.map((a) => (
                          <span
                            key={a.shortId}
                            title={`${a.taskGroup} · alloc ${a.shortId}`}
                            className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono text-[10px]"
                          >
                            {a.nodeName}
                            <code className="opacity-60">{a.shortId.slice(0, 4)}</code>
                          </span>
                        ))}
                      </div>
                    ) : w.type === 'container' || w.type === 'node' ? (
                      <span className="text-amber-600 text-[10px]">no running alloc</span>
                    ) : (
                      <span className="text-gray-400 text-[10px]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500" title={w.updatedAt}>
                    {w.updatedAt ? new Date(w.updatedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
        active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}
