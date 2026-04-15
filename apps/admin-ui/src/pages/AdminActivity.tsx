/**
 * SpinForge - Admin Activity (audit trail)
 * Copyright (c) 2025 Jacob Ajiboye
 * Licensed under the MIT License
 *
 * Read-only tail of the audit:admin Redis stream. Shows who called what,
 * when, from where, with final status. No filters beyond search-in-page
 * yet — stream is capped at ~10k entries so the whole thing fits.
 */

import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { api, AuditEntry } from '../services/api';

function statusColor(status: string): string {
  const n = parseInt(status, 10);
  if (!n || isNaN(n)) return 'bg-gray-200 text-gray-700';
  if (n >= 500) return 'bg-red-100 text-red-800';
  if (n >= 400) return 'bg-orange-100 text-orange-800';
  if (n >= 300) return 'bg-amber-100 text-amber-800';
  if (n >= 200) return 'bg-green-100 text-green-800';
  return 'bg-gray-200 text-gray-700';
}

function methodColor(method: string): string {
  switch (method) {
    case 'GET':    return 'text-blue-700';
    case 'POST':   return 'text-green-700';
    case 'PUT':
    case 'PATCH':  return 'text-amber-700';
    case 'DELETE': return 'text-red-700';
    default:       return 'text-gray-700';
  }
}

export default function AdminActivity() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { entries } = await api.auditRecent(500);
      setEntries(entries);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return entries;
    const needle = q.toLowerCase();
    return entries.filter((e) =>
      (e.path || '').toLowerCase().includes(needle) ||
      (e.adminUser || '').toLowerCase().includes(needle) ||
      (e.ip || '').toLowerCase().includes(needle) ||
      (e.method || '').toLowerCase().includes(needle) ||
      (e.status || '').includes(needle)
    );
  }, [entries, q]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldAlert size={22}/> Admin Activity</h1>
          <p className="text-sm text-gray-500 mt-1">
            Who called what on <code>/_admin/*</code> and admin-gated <code>/api/*</code>. Append-only. Keeps the last ~10,000 entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
            <input
              className="pl-7 pr-3 py-1.5 border rounded text-sm"
              placeholder="Search path, user, ip, method…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
          >
            <RefreshCw size={14}/> Refresh
          </button>
        </div>
      </div>

      {err && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>}

      <div className="bg-white border rounded overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold w-44">Time</th>
              <th className="px-3 py-2 font-semibold w-16">Status</th>
              <th className="px-3 py-2 font-semibold w-16">Method</th>
              <th className="px-3 py-2 font-semibold">Path</th>
              <th className="px-3 py-2 font-semibold w-32">Admin</th>
              <th className="px-3 py-2 font-semibold w-32">IP</th>
              <th className="px-3 py-2 font-semibold w-16">Dur</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                {q ? `No matches for "${q}"` : 'No activity yet.'}
              </td></tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-1.5 whitespace-nowrap">{e.ts}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-2 py-0.5 rounded ${statusColor(e.status)}`}>{e.status}</span>
                </td>
                <td className={`px-3 py-1.5 font-semibold ${methodColor(e.method)}`}>{e.method}</td>
                <td className="px-3 py-1.5 break-all">{e.path}</td>
                <td className="px-3 py-1.5 truncate">
                  {e.adminUser || <span className="text-gray-400">—</span>}
                  {e.authMethod && <span className="ml-1 text-gray-400">({e.authMethod})</span>}
                </td>
                <td className="px-3 py-1.5">{e.ip}</td>
                <td className="px-3 py-1.5 text-right">{e.durMs}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
