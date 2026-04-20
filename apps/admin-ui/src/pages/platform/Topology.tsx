/**
 * SpinForge - Platform → Topology
 *
 * Visual map of the cluster: HAProxy at the top → 3 SpinForge nodes →
 * the Nomad allocations running on each. Pure SVG (no dep), colour-
 * coded by allocation status, click an alloc to drill down.
 *
 * Data: fetches /nodes + /allocations once on mount, refreshes every
 * 20s. No scraping loops, no state in KeyDB — the whole picture is
 * derivable from Nomad + Consul.
 */

import { useEffect, useMemo, useState } from 'react';
import { Share2, RefreshCw } from 'lucide-react';
import { api, PlatformAllocation, PlatformNodeSnapshot } from '../../services/api';

interface Data {
  nodes: PlatformNodeSnapshot[];
  allocs: PlatformAllocation[];
}

const STATUS_COLOR: Record<string, string> = {
  running:  '#22c55e',
  pending:  '#f59e0b',
  failed:   '#ef4444',
  complete: '#6b7280',
  lost:     '#ef4444',
};

export default function PlatformTopology() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [nodes, allocs] = await Promise.all([
        api.platformNodes().then((r) => r.nodes),
        api.platformAllocations().then((r) => r.allocations),
      ]);
      setData({ nodes, allocs });
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Failed');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const layout = useMemo(() => {
    if (!data) return null;
    const NODE_COUNT = data.nodes.length;
    const WIDTH = Math.max(900, NODE_COUNT * 300);
    const HEIGHT = 700;
    const HAPROXY_X = WIDTH / 2;
    const HAPROXY_Y = 60;
    const NODE_Y = 240;

    // Sort nodes by name, then fan out horizontally
    const nodes = [...data.nodes].sort((a, b) =>
      (a.hostname || '').localeCompare(b.hostname || '')
    );
    const nodePositions = nodes.map((n, i) => {
      const x = (WIDTH / (NODE_COUNT + 1)) * (i + 1);
      return { ...n, x, y: NODE_Y };
    });

    // Group allocs by nodeName, sort each group by job
    const allocsByNode: Record<string, PlatformAllocation[]> = {};
    for (const a of data.allocs) {
      if (a.clientStatus === 'complete') continue;  // show current, not history
      (allocsByNode[a.nodeName] = allocsByNode[a.nodeName] || []).push(a);
    }
    Object.values(allocsByNode).forEach((arr) =>
      arr.sort((a, b) => a.jobId.localeCompare(b.jobId))
    );

    return { width: WIDTH, height: HEIGHT, HAPROXY_X, HAPROXY_Y, nodePositions, allocsByNode };
  }, [data]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Share2 size={22} /> Topology</h1>
          <p className="text-sm text-gray-500 mt-1">
            Load balancer → nodes → allocations. Refreshes every 20s.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
        </button>
      </div>

      {err && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>}

      {!layout ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-400">Loading topology…</div>
      ) : (
        <div className="bg-white border rounded-lg p-4 overflow-auto">
          <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="w-full h-auto" style={{ maxHeight: '80vh' }}>
            {/* Connection lines from HAProxy → each node */}
            {layout.nodePositions.map((n) => (
              <line
                key={`edge-lb-${n.nodeId}`}
                x1={layout.HAPROXY_X} y1={layout.HAPROXY_Y + 40}
                x2={n.x} y2={n.y - 40}
                stroke={n.status === 'ready' ? '#22c55e' : '#ef4444'}
                strokeWidth="2"
                strokeDasharray={n.status === 'ready' ? undefined : '4 4'}
              />
            ))}

            {/* HAProxy box */}
            <g>
              <rect
                x={layout.HAPROXY_X - 100} y={layout.HAPROXY_Y - 30}
                width="200" height="70" rx="10"
                fill="#0ea5e9" stroke="#0369a1" strokeWidth="2"
              />
              <text x={layout.HAPROXY_X} y={layout.HAPROXY_Y - 5} fill="white" fontSize="14" fontWeight="bold" textAnchor="middle">HAProxy</text>
              <text x={layout.HAPROXY_X} y={layout.HAPROXY_Y + 15} fill="white" fontSize="11" textAnchor="middle">192.168.88.20</text>
              <text x={layout.HAPROXY_X} y={layout.HAPROXY_Y + 30} fill="#e0f2fe" fontSize="10" textAnchor="middle">balance source · sticky</text>
            </g>

            {/* Nodes + allocations */}
            {layout.nodePositions.map((n) => {
              const allocs = layout.allocsByNode[n.hostname] || [];
              const allocStartY = n.y + 60;
              const readyColor = n.status === 'ready' ? '#10b981' : '#ef4444';
              return (
                <g key={n.nodeId}>
                  {/* Node box */}
                  <rect
                    x={n.x - 110} y={n.y - 40}
                    width="220" height="80" rx="10"
                    fill="#fff" stroke={readyColor} strokeWidth="2"
                  />
                  <text x={n.x} y={n.y - 18} fontSize="14" fontWeight="bold" textAnchor="middle" fill="#1f2937">{n.hostname}</text>
                  <text x={n.x} y={n.y - 2} fontSize="11" textAnchor="middle" fill="#6b7280">{n.ip || '—'}</text>
                  <text x={n.x} y={n.y + 15} fontSize="10" textAnchor="middle" fill={readyColor}>
                    {n.status} · {n.drain ? 'DRAINING' : n.eligibility}
                  </text>
                  <text x={n.x} y={n.y + 30} fontSize="10" textAnchor="middle" fill="#9ca3af">
                    {n.cpuCores} cores · {n.memoryBytes ? `${Math.round(n.memoryBytes / 1024**3)} GB RAM` : '—'}
                  </text>

                  {/* Edges node → each alloc */}
                  {allocs.map((a, i) => (
                    <line
                      key={`edge-${n.nodeId}-${a.id}`}
                      x1={n.x} y1={n.y + 40}
                      x2={n.x} y2={allocStartY + (i * 40) + 20}
                      stroke="#cbd5e1" strokeWidth="1.5"
                    />
                  ))}

                  {/* Alloc boxes */}
                  {allocs.map((a, i) => {
                    const by = allocStartY + (i * 40);
                    const color = STATUS_COLOR[a.clientStatus] || '#9ca3af';
                    return (
                      <g key={a.id}>
                        <rect
                          x={n.x - 90} y={by}
                          width="180" height="32" rx="6"
                          fill={color === '#22c55e' ? '#ecfdf5' : color === '#f59e0b' ? '#fffbeb' : '#fef2f2'}
                          stroke={color} strokeWidth="1.5"
                        />
                        <text x={n.x - 82} y={by + 14} fontSize="11" fontWeight="600" fill="#1f2937">{a.jobId}</text>
                        <text x={n.x - 82} y={by + 26} fontSize="9" fill="#6b7280" fontFamily="ui-monospace, monospace">
                          {a.taskGroup} · {a.shortId}
                        </text>
                        <circle cx={n.x + 80} cy={by + 16} r="4" fill={color}>
                          {a.clientStatus === 'running' && (
                            <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
                          )}
                        </circle>
                      </g>
                    );
                  })}

                  {allocs.length === 0 && (
                    <text x={n.x} y={allocStartY + 20} fontSize="10" textAnchor="middle" fill="#9ca3af" fontStyle="italic">
                      no allocations
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-500">
            {Object.entries(STATUS_COLOR).map(([k, c]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
                {k}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
