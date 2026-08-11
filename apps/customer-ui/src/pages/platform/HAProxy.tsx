/**
 * SpinForge - Platform → HAProxy
 *
 * Gateway to the HAProxy load balancer in front of the 3 nodes. The
 * native stats UI lives on the LB box at :8404 — a private IP — so we
 * expose it via our own proxy at https://haproxy.spinforge.dev/stats.
 * That path rides CF → our HAProxy → openresty → back to HAProxy's
 * stats endpoint. The browser handles HAProxy's basic-auth challenge
 * natively; no creds ever flow through spinforge-api.
 *
 * We also try to scrape the CSV stats endpoint for a summary view.
 * Scrape requires creds in the api's env (HAPROXY_STATS_USER/PASS);
 * if they're not set, the summary card just shows a "configure" hint
 * and the operator uses the native link instead.
 */

import { useEffect, useState } from 'react';
import { Activity, RefreshCw, CheckCircle, XCircle, ExternalLink, Info } from 'lucide-react';
import { api, HAProxyStats, HAProxyRow } from '../../services/api';

const NATIVE_STATS_URL = 'https://haproxy.spinforge.dev/stats';

function formatBytes(n: number): string {
  if (!n) return '0';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

function relativeSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function rowOk(r: HAProxyRow): boolean {
  return r.status === 'OPEN' || r.status === 'UP';
}

export default function PlatformHAProxy() {
  const [stats, setStats] = useState<HAProxyStats | null>(null);
  const [scrapeErr, setScrapeErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const s = await api.platformHAProxy();
      setStats(s);
      setScrapeErr(null);
    } catch (e: any) {
      // 502 here usually means the api's HAPROXY_STATS_USER/PASS don't
      // match the LB's `stats auth` line. We still show the native-UI
      // card; operators can work around by opening stats directly.
      setScrapeErr(e?.response?.data?.error || e?.message || 'scrape failed');
      setStats(null);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  // Group servers by proxy (frontend/backend name)
  const serversByPx: Record<string, HAProxyRow[]> = {};
  if (stats?.servers) {
    for (const s of stats.servers) {
      (serversByPx[s.pxname] = serversByPx[s.pxname] || []).push(s);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Activity size={22} /> HAProxy</h1>
          <p className="text-sm text-gray-500 mt-1">
            Load balancer in front of the 3 SpinForge nodes. Native stats UI available via the proxy below — no private IPs exposed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={NATIVE_STATS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-sky-600 text-white rounded hover:bg-sky-700"
          >
            Open native stats UI <ExternalLink size={14} />
          </a>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
          </button>
        </div>
      </div>

      {/* Native-stats launcher — always visible */}
      <div className="bg-gradient-to-r from-sky-50 to-white border border-sky-200 rounded-lg p-4 flex items-center gap-4">
        <Info className="text-sky-600 flex-shrink-0" size={22} />
        <div className="flex-1">
          <div className="font-semibold text-sky-900">Native HAProxy stats</div>
          <div className="text-xs text-sky-700 mt-0.5">
            Full stats page (all frontends, backends, session counters, errors) is served at{' '}
            <code className="bg-sky-100 px-1 py-0.5 rounded">{NATIVE_STATS_URL}</code>.
            Your browser will prompt for HAProxy's basic-auth the first time.
          </div>
        </div>
        <a
          href={NATIVE_STATS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-sky-600 text-sky-700 rounded hover:bg-sky-50 flex-shrink-0"
        >
          Launch <ExternalLink size={14} />
        </a>
      </div>

      {/* Scrape-based summary — only renders when we have creds */}
      {scrapeErr && !stats && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          <div className="font-semibold">In-app summary unavailable</div>
          <div className="text-xs mt-1">
            The spinforge-api can't scrape HAProxy's CSV stats — this is a credentials issue
            (set <code className="bg-amber-100 px-1 py-0.5 rounded">HAPROXY_STATS_USER</code> and{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded">HAPROXY_STATS_PASS</code> in the api's env
            to match the LB's <code className="bg-amber-100 px-1 py-0.5 rounded">stats auth</code> line).
            Use the native stats link above to view the data in the meantime.
          </div>
          <div className="text-[10px] mt-2 text-amber-700">API: {scrapeErr}</div>
        </div>
      )}

      {stats && (
        <>
          <section>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">Frontends ({stats.frontends.length})</h2>
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Proxy</th>
                    <th className="px-3 py-2 text-left w-20">Status</th>
                    <th className="px-3 py-2 text-left w-28">Sessions</th>
                    <th className="px-3 py-2 text-left w-24">Rate</th>
                    <th className="px-3 py-2 text-left w-28">Bytes in</th>
                    <th className="px-3 py-2 text-left w-28">Bytes out</th>
                    <th className="px-3 py-2 text-left w-24">2xx</th>
                    <th className="px-3 py-2 text-left w-24">5xx</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.frontends.map((f) => (
                    <tr key={f.pxname} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono">{f.pxname}</td>
                      <td className="px-3 py-2"><StatusChip ok={rowOk(f)} label={f.status} /></td>
                      <td className="px-3 py-2 text-xs font-mono">{f.scur} / {f.smax}</td>
                      <td className="px-3 py-2 text-xs font-mono">{f.rate}/s</td>
                      <td className="px-3 py-2 text-xs font-mono">{formatBytes(f.bin)}</td>
                      <td className="px-3 py-2 text-xs font-mono">{formatBytes(f.bout)}</td>
                      <td className="px-3 py-2 text-xs font-mono">{f.hrsp_2xx}</td>
                      <td className={`px-3 py-2 text-xs font-mono ${f.hrsp_5xx > 0 ? 'text-red-600 font-bold' : ''}`}>{f.hrsp_5xx}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">Backends ({stats.backends.length})</h2>
            <div className="space-y-3">
              {stats.backends.map((b) => {
                const backendServers = serversByPx[b.pxname] || [];
                return (
                  <div key={b.pxname} className="bg-white border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold">{b.pxname}</span>
                        <StatusChip ok={rowOk(b)} label={b.status} />
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {backendServers.filter((s) => rowOk(s)).length} / {backendServers.length} servers up
                        <span className="ml-2">· {b.scur} sess · {b.rate}/s</span>
                        {b.hrsp_5xx > 0 && <span className="ml-2 text-red-600 font-bold">{b.hrsp_5xx} 5xx</span>}
                      </div>
                    </div>
                    {backendServers.length > 0 && (
                      <table className="w-full text-sm">
                        <thead className="bg-white text-xs text-gray-500">
                          <tr>
                            <th className="px-3 py-1.5 text-left">Server</th>
                            <th className="px-3 py-1.5 text-left w-20">Status</th>
                            <th className="px-3 py-1.5 text-left w-20">Weight</th>
                            <th className="px-3 py-1.5 text-left w-28">Sessions</th>
                            <th className="px-3 py-1.5 text-left w-24">Last chg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backendServers.map((s) => (
                            <tr key={b.pxname + ':' + s.svname} className="border-t">
                              <td className="px-3 py-1.5 font-mono text-xs">{s.svname}</td>
                              <td className="px-3 py-1.5"><StatusChip ok={rowOk(s)} label={s.status} /></td>
                              <td className="px-3 py-1.5 text-xs font-mono">{s.weight}</td>
                              <td className="px-3 py-1.5 text-xs font-mono">{s.scur} / {s.stot}</td>
                              <td className="px-3 py-1.5 text-xs text-gray-500">{relativeSeconds(s.lastchg)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="text-xs text-gray-400 text-right">Scraped {new Date(stats.scrapedAt).toLocaleTimeString()}</div>
        </>
      )}
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
