/**
 * SpinForge - Pipelines → Builds (global list)
 *
 * Every build execution across pipelines. Clicking a row opens the
 * build detail drawer — no page navigation, matches the list-with-
 * drawer pattern used on /applications.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, RefreshCw, Filter, Search, Workflow } from 'lucide-react';
import { buildApi, Build, relativeTime, formatDuration, friendlyError } from '../../services/buildApi';
import BuildDetailDrawer from '../../components/PipelinesDrawer/BuildDetailDrawer';

const STATUS_OPTIONS = ['', 'queued', 'running', 'succeeded', 'failed', 'canceled'];

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; pulse: boolean }> = {
    queued:    { bg: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500',    pulse: true },
    running:   { bg: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500',    pulse: true },
    succeeded: { bg: 'bg-green-100 text-green-700',  dot: 'bg-green-500',   pulse: false },
    failed:    { bg: 'bg-red-100 text-red-700',      dot: 'bg-red-500',     pulse: false },
    canceled:  { bg: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400',    pulse: false },
  };
  const m = map[status] || { bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', pulse: false };
  return (
    <div className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${m.bg}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${m.dot} ${m.pulse ? 'animate-pulse' : ''}`} />
      {status}
    </div>
  );
}

function ProgressPill({ stages }: { stages: Build['stages'] }) {
  const counts = { succeeded: 0, running: 0, failed: 0, skipped: 0, pending: 0 };
  for (const s of stages) {
    if (s.status === 'succeeded') counts.succeeded++;
    else if (s.status === 'running') counts.running++;
    else if (s.status === 'failed') counts.failed++;
    else if (s.status === 'skipped' || s.status === 'skipped_unimplemented') counts.skipped++;
    else counts.pending++;
  }
  return (
    <div className="flex items-center gap-1 text-[11px] font-mono">
      {counts.succeeded > 0 && (
        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">{counts.succeeded}</span>
      )}
      {counts.running > 0 && (
        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">{counts.running}</span>
      )}
      {counts.failed > 0 && (
        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded">{counts.failed}</span>
      )}
      {counts.skipped > 0 && (
        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{counts.skipped}</span>
      )}
      {counts.pending > 0 && (
        <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded border border-gray-200">{counts.pending}</span>
      )}
    </div>
  );
}

export default function Builds() {
  const [rows, setRows] = useState<Build[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(100);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
  const [customerList, setCustomerList] = useState<Array<{ id: string; name?: string }>>([]);

  useEffect(() => {
    buildApi.listCustomers()
      .then((r) => setCustomerList((r.customers || []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await buildApi.listBuilds({
        pipelineId: pipelineId || undefined,
        customerId: customerId || undefined,
        status: status || undefined,
        limit,
      });
      setRows(r.builds || []);
      setTotal(r.total || 0);
      setErr(null);
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Live refresh — builds are the main monitoring surface after all.
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, customerId, status, limit]);

  const filtered = (rows ?? []).filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.id?.toLowerCase().includes(q) ||
      b.pipelineId?.toLowerCase().includes(q) ||
      b.pipelineSnapshot?.name?.toLowerCase().includes(q) ||
      b.customerId?.toLowerCase().includes(q)
    );
  });

  const activeFilterCount = [pipelineId, customerId, status].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <PlayCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Build history
                </h1>
                <p className="text-sm text-gray-500">
                  {filtered.length}
                  {total > filtered.length ? ` of ${total}` : ''} builds
                  {search && ` matching "${search}"`}
                  <span className="ml-2">• refreshes every 5s</span>
                </p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Reload</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Search and Controls Bar */}
          <motion.div
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by build ID, pipeline, or customer..."
                    className="pl-12 pr-4 py-3 w-full bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 ${
                    showFilters
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                      : 'bg-white/60 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  <span className="font-medium">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={load}
                  disabled={loading}
                  className="p-3 bg-white/60 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {showFilters && (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pipeline ID</label>
                  <input
                    value={pipelineId}
                    onChange={(e) => setPipelineId(e.target.value)}
                    placeholder="pl_..."
                    className="w-full font-mono bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">All customers</option>
                    {customerList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name ? `${c.name} · ${c.id}` : c.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || 'all'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Limit</label>
                  <input
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value || '100', 10))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </motion.div>
            )}
          </motion.div>

          {err && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{err}</div>
          )}

          {rows === null ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12">
              <div className="text-center">
                <PlayCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No builds found</h3>
                <p className="text-gray-600">
                  {search || activeFilterCount > 0
                    ? 'Try adjusting your filters'
                    : 'Build history will appear here once pipelines run'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBuildId(b.id)}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <StatusPill status={b.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-blue-600">{b.id.slice(0, 12)}</span>
                        <span className="text-gray-300">·</span>
                        <span className="flex items-center gap-1 text-sm text-gray-700 truncate">
                          <Workflow className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{b.pipelineSnapshot?.name || b.pipelineId}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="truncate" title={b.customerId}>{b.customerId}</span>
                        <span className="text-gray-300">·</span>
                        <span title={b.startedAt || b.createdAt}>
                          started {relativeTime(b.startedAt || b.createdAt)}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span>
                          {b.durationMs != null ? formatDuration(b.durationMs) : '—'}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-[10px]">
                          {b.trigger?.type ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <ProgressPill stages={b.stages || []} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Build detail drawer */}
      <BuildDetailDrawer
        isOpen={!!selectedBuildId}
        buildId={selectedBuildId}
        onClose={() => setSelectedBuildId(null)}
      />
    </div>
  );
}
