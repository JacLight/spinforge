/**
 * SpinForge - Platform → Events
 *
 * Live scrolling feed of platform:events. Color-codes severity, lets
 * the operator filter by type/subject/source, and pulses new entries
 * at the top of the list.
 *
 * Backed by the shared WebSocket; older events pulled via REST on
 * mount so the feed has context when you open the page.
 */

import { useEffect, useMemo, useState } from 'react';
import { api, PlatformEventRow } from '../../services/api';
import { usePlatformSocket, usePlatformSocketAutoConnect } from '../../hooks/usePlatformSocket';
import { Activity, Search, AlertTriangle, AlertCircle, Info } from 'lucide-react';

function severityChip(severity: string) {
  switch (severity) {
    case 'error': return { icon: <AlertCircle size={12} />, cls: 'bg-red-100 text-red-700' };
    case 'warn':  return { icon: <AlertTriangle size={12} />, cls: 'bg-amber-100 text-amber-800' };
    default:       return { icon: <Info size={12} />, cls: 'bg-blue-100 text-blue-700' };
  }
}

function formatAgo(iso: string): string {
  const age = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (age < 60) return `${age}s ago`;
  if (age < 3600) return `${Math.floor(age / 60)}m ago`;
  if (age < 86400) return `${Math.floor(age / 3600)}h ago`;
  return `${Math.floor(age / 86400)}d ago`;
}

function parseContext(raw?: string): Record<string, any> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export default function PlatformEvents() {
  usePlatformSocketAutoConnect();
  const { state, events: liveEvents, subscribe } = usePlatformSocket();

  const [initial, setInitial] = useState<PlatformEventRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [, tick] = useState(0);

  useEffect(() => {
    api.platformEvents(200).then(({ events }) => setInitial(events)).catch((e) => {
      setErr(e?.response?.data?.error || e.message);
    });
    const unsub = subscribe('events');
    return unsub;
  }, [subscribe]);

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  // Merge live + initial, dedupe by id, live first.
  const events = useMemo(() => {
    const byId = new Map<string, any>();
    for (const ev of liveEvents) byId.set(ev.id, ev);
    for (const ev of initial) if (!byId.has(ev.id)) byId.set(ev.id, ev);
    const all = Array.from(byId.values()).sort((a, b) => (b.id || '').localeCompare(a.id || ''));
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter((e) =>
      (e.type || '').toLowerCase().includes(needle) ||
      (e.subject || '').toLowerCase().includes(needle) ||
      (e.source || '').toLowerCase().includes(needle) ||
      (e.context || '').toLowerCase().includes(needle)
    );
  }, [liveEvents, initial, q]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Activity size={22} /> Events</h1>
          <p className="text-sm text-gray-500 mt-1">
            Everything interesting that happened across the cluster. Capped at 10k entries, newest first.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${
            state === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${state === 'open' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {state}
          </span>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
            <input
              className="pl-7 pr-3 py-1.5 border rounded text-sm w-64"
              placeholder="Filter by type, subject, source…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      {err && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>}

      <div className="bg-white border rounded-lg overflow-hidden">
        {events.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {q ? `No matches for "${q}"` : 'No events yet. Try deploying a site.'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-24">When</th>
                <th className="px-3 py-2 text-left font-semibold w-28">Severity</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Subject</th>
                <th className="px-3 py-2 text-left font-semibold w-40">Source</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {events.slice(0, 500).map((e) => {
                const sev = severityChip(e.severity);
                const ctx = parseContext(e.context);
                return (
                  <tr key={e.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap" title={e.ts}>
                      {formatAgo(e.ts)}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${sev.cls}`}>
                        {sev.icon}{e.severity}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-semibold">{e.type}</td>
                    <td className="px-3 py-1.5">
                      <div>{e.subject || <span className="text-gray-400">—</span>}</div>
                      {Object.keys(ctx).length > 0 && (
                        <div className="text-gray-400 text-[10px] mt-0.5 truncate max-w-md">
                          {Object.entries(ctx).slice(0, 4).map(([k, v]) => (
                            <span key={k} className="mr-3">
                              {k}=<span className="text-gray-600">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{e.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {events.length > 500 && (
        <div className="mt-2 text-xs text-gray-400 text-center">
          Showing latest 500 of {events.length} matched entries. Filter to narrow the list.
        </div>
      )}
    </div>
  );
}
