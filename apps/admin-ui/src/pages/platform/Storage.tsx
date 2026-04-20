/**
 * SpinForge - Platform → Storage
 *
 * Storage view for operators: per-node root disk, Ceph shared pool, and
 * the on-disk breakdown (static sites, uploads, KeyDB footprint). All
 * values come from spinforge-api's /_admin/platform/storage — which
 * reads Nomad node attrs for host disk and `df` / `du` on the Ceph
 * mount for shared storage.
 */

import { useEffect, useState } from 'react';
import { HardDrive, RefreshCw, Database, FolderOpen, Upload } from 'lucide-react';
import { api, PlatformStorage } from '../../services/api';

function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

function pct(used: number | null | undefined, total: number | null | undefined): number {
  if (!used || !total) return 0;
  return Math.round((used / total) * 100);
}

export default function PlatformStorage() {
  const [data, setData] = useState<PlatformStorage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setData(await api.platformStorage());
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Failed');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><HardDrive size={22} /> Storage</h1>
          <p className="text-sm text-gray-500 mt-1">
            Per-node root disk, Ceph shared pool, and on-disk breakdown. Refreshes every 30s.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
        </button>
      </div>

      {err && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>}

      {/* Ceph shared pool — the hero card */}
      {data?.ceph && (
        <section>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">Shared storage — Ceph</h2>
          <div className="bg-gradient-to-r from-blue-50 via-white to-indigo-50 border rounded-lg p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-gray-500">Mount</div>
                <div className="font-mono text-sm">{data.ceph.mount}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 font-mono truncate max-w-md" title={data.ceph.filesystem}>
                  {data.ceph.filesystem}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{pct(data.ceph.used, data.ceph.total)}%</div>
                <div className="text-xs text-gray-500">of {formatBytes(data.ceph.total)}</div>
              </div>
            </div>
            <div className="h-3 bg-gray-200 rounded overflow-hidden mb-2">
              <div
                className={`h-full ${
                  pct(data.ceph.used, data.ceph.total) > 85 ? 'bg-red-500' :
                  pct(data.ceph.used, data.ceph.total) > 70 ? 'bg-amber-500' :
                  'bg-gradient-to-r from-blue-500 to-indigo-500'
                }`}
                style={{ width: `${pct(data.ceph.used, data.ceph.total)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Used {formatBytes(data.ceph.used)}</span>
              <span>Free {formatBytes(data.ceph.avail)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Per-node disk */}
      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">Per-node root disk</h2>
        {!data ? (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.nodes.map((n) => {
              const used = (n.diskTotalBytes || 0) - (n.diskFreeBytes || 0);
              const p = pct(used, n.diskTotalBytes);
              return (
                <div key={n.nodeId} className="bg-white border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-mono font-semibold">{n.hostname}</div>
                      <div className="text-xs text-gray-500">{n.ip || '—'}</div>
                    </div>
                    <div className="text-xl font-bold">{p}%</div>
                  </div>
                  <div className="h-2 bg-gray-200 rounded overflow-hidden mb-2">
                    <div
                      className={p > 85 ? 'h-full bg-red-500' : p > 70 ? 'h-full bg-amber-500' : 'h-full bg-green-500'}
                      style={{ width: `${p}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>Used {formatBytes(used)}</span>
                    <span>Total {formatBytes(n.diskTotalBytes)}</span>
                  </div>
                  {n.diskVolume && (
                    <div className="mt-2 text-[10px] text-gray-400 font-mono">{n.diskVolume}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Data breakdown */}
      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">On-disk breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BreakdownCard
            icon={<FolderOpen size={18} />}
            label="Static sites"
            bytes={data?.breakdown.staticBytes}
            hint="/mnt/cephfs/.../hosting/data/static"
            color="from-green-500 to-emerald-500"
          />
          <BreakdownCard
            icon={<Upload size={18} />}
            label="Uploads"
            bytes={data?.breakdown.uploadsBytes}
            hint="/mnt/cephfs/.../hosting/data/uploads"
            color="from-amber-500 to-orange-500"
          />
          <BreakdownCard
            icon={<Database size={18} />}
            label="KeyDB in-memory"
            bytes={data?.breakdown.keydbBytes}
            hint="INFO memory — used_memory"
            color="from-blue-500 to-indigo-500"
          />
        </div>
      </section>

      {data && (
        <div className="text-xs text-gray-400 text-right">
          Scraped {new Date(data.scrapedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function BreakdownCard({ icon, label, bytes, hint, color }: {
  icon: React.ReactNode;
  label: string;
  bytes: number | null | undefined;
  hint: string;
  color: string;
}) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className={`inline-flex p-2 rounded-lg bg-gradient-to-r ${color} text-white mb-2`}>
        {icon}
      </div>
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1">{formatBytes(bytes)}</div>
      <div className="text-[10px] text-gray-400 mt-1 font-mono truncate" title={hint}>{hint}</div>
    </div>
  );
}
