/**
 * Activity — read-only tail of `audit:customer:{customerId}`.
 *
 * Shows the authenticated customer's own API/UI calls (writes only by
 * default). No cross-tenant data — the server scopes the stream to
 * req.customerId before reading.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, ShieldAlert, RefreshCw } from "lucide-react";
import { customerApi } from "../services/customerApi";

interface AuditEntry {
  id: string;
  ts: string;
  durMs?: string;
  status?: string;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  userEmail?: string;
  authMethod?: string;
}

export default function Activity() {
  const [filter, setFilter] = useState("");
  const q = useQuery({
    queryKey: ["customer", "audit"],
    queryFn: () => customerApi.audit(500),
    refetchInterval: 30_000,
  });

  const entries: AuditEntry[] = q.data || [];

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return entries;
    return entries.filter((e) => {
      const hay = [e.path, e.method, e.status, e.ip, e.userEmail, e.authMethod]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(f);
    });
  }, [entries, filter]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-slate-500" />
            Activity
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Recent writes and admin-gated calls made by you or your API tokens.
            The stream keeps ~5,000 entries.
          </p>
        </div>
        <button
          onClick={() => q.refetch()}
          disabled={q.isFetching}
          className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by path, method, status, IP, email…"
          className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {q.isLoading ? (
        <div className="py-12 flex items-center justify-center text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : q.isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-red-600">
            Failed to load activity: {(q.error as Error)?.message || "unknown error"}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center bg-white border border-gray-200 rounded-2xl">
          <ShieldAlert className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">
            {entries.length === 0 ? "No activity yet" : "No entries match the filter"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {entries.length === 0
              ? "Activity is recorded the next time you make a write through the API or dashboard."
              : "Try a different search term."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Method</th>
                <th className="px-4 py-2.5">Path</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Auth</th>
                <th className="px-4 py-2.5">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                    {fmtTs(e.ts)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-medium ${methodColor(
                        e.method,
                      )}`}
                    >
                      {e.method || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700 break-all">
                    {e.path}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-medium ${statusColor(
                        e.status,
                      )}`}
                    >
                      {e.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">
                    {e.authMethod || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">
                    {e.ip || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmtTs(v: string | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function methodColor(m: string | undefined) {
  switch (m) {
    case "GET":
      return "bg-blue-50 text-blue-700";
    case "POST":
      return "bg-green-50 text-green-700";
    case "PUT":
    case "PATCH":
      return "bg-amber-50 text-amber-700";
    case "DELETE":
      return "bg-red-50 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function statusColor(s: string | undefined) {
  const n = parseInt(s || "0", 10);
  if (n >= 500) return "bg-red-50 text-red-700";
  if (n >= 400) return "bg-amber-50 text-amber-700";
  if (n >= 300) return "bg-blue-50 text-blue-700";
  if (n >= 200) return "bg-green-50 text-green-700";
  return "bg-gray-100 text-gray-700";
}
