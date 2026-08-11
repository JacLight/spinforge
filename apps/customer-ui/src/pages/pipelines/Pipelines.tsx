/**
 * SpinForge - Pipelines → list
 *
 * Customer-owned saved pipeline configs. Create / view / edit all happen
 * via the drawer components — no extra routes, matches the list-with-
 * drawer pattern used on /applications.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Workflow, RefreshCw, Trash2, Play, Pencil, Plus, Search, Filter, Layers,
} from 'lucide-react';
import { buildApi, Pipeline, relativeTime, friendlyError } from '../../services/buildApi';
import PipelineEditorDrawer from '../../components/PipelinesDrawer/PipelineEditorDrawer';
import PipelineDetailDrawer from '../../components/PipelinesDrawer/PipelineDetailDrawer';
import BuildDetailDrawer from '../../components/PipelinesDrawer/BuildDetailDrawer';
import { useConfirm } from '../../components/ConfirmModal';

export default function Pipelines() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<Pipeline[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Drawer state — all three can be open, but only one of (create/edit)
  // at a time. `editTarget = null` with editorOpen=true → create mode.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Pipeline | null>(null);
  const [runBuildId, setRunBuildId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { pipelines, total } = await buildApi.listPipelines({
        customerId: customerId || undefined,
        limit: 200,
      });
      setRows(pipelines || []);
      setTotal(total || 0);
      setErr(null);
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function handleDelete(p: Pipeline) {
    const ok = await confirm({
      title: `Delete pipeline "${p.name}"?`,
      description: 'This removes the pipeline config. Past build history is kept.',
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await buildApi.deletePipeline(p.id);
      await load();
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRun(p: Pipeline) {
    setBusyId(p.id);
    try {
      const b = await buildApi.createBuild({ pipelineId: p.id, trigger: { type: 'manual' } });
      setRunBuildId(b.id);
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setBusyId(null);
    }
  }

  function openCreate() {
    setEditTarget(null);
    setEditorOpen(true);
  }

  function openEdit(p: Pipeline) {
    // Close detail drawer so editor sits cleanly on top.
    setDetailId(null);
    setEditTarget(p);
    setEditorOpen(true);
  }

  function handleEditorSaved(saved: Pipeline) {
    setEditorOpen(false);
    setEditTarget(null);
    // Refresh list + open detail drawer for the saved pipeline.
    load();
    setDetailId(saved.id);
  }

  const filtered = (rows ?? []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.customerId?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Workflow className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Pipelines
                </h1>
                <p className="text-sm text-gray-500">
                  {filtered.length}
                  {total > filtered.length ? ` of ${total}` : ''} pipelines
                  {search && ` matching "${search}"`}
                </p>
              </div>
            </div>

            <button
              onClick={openCreate}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Pipeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Full Width Content */}
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
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, ID, or customer..."
                    className="pl-12 pr-4 py-3 w-full bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              {/* Controls */}
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
                  {customerId && (
                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">1</span>
                  )}
                </button>

                <button
                  onClick={() => load()}
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
                className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer ID</label>
                  <input
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="any"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </motion.div>
            )}
          </motion.div>

          {err && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{err}</div>
          )}

          {/* Content */}
          {rows === null ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12">
              <div className="text-center">
                <Workflow className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No pipelines found</h3>
                <p className="text-gray-600 mb-4">
                  {search || customerId
                    ? 'Try adjusting your filters'
                    : 'Create your first pipeline to get started'}
                </p>
                {!search && !customerId && (
                  <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 shadow-lg"
                  >
                    <Plus className="h-4 w-4" /> New Pipeline
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setDetailId(p.id)}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Workflow className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                        <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-md text-[11px] font-medium text-gray-700">
                          {p.trigger?.type ?? 'manual'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {p.stages?.length ?? 0} stage{(p.stages?.length ?? 0) === 1 ? '' : 's'}
                        </span>
                        <span className="truncate" title={p.customerId}>
                          {p.customerId || '—'}
                        </span>
                        <span title={p.updatedAt}>updated {relativeTime(p.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleRun(p)}
                      disabled={busyId === p.id}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 disabled:opacity-50"
                      title="Run now"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={busyId === p.id}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Detail drawer */}
      <PipelineDetailDrawer
        isOpen={!!detailId}
        pipelineId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(p) => openEdit(p)}
        onDeleted={() => {
          setDetailId(null);
          load();
        }}
      />

      {/* Create / Edit drawer */}
      <PipelineEditorDrawer
        isOpen={editorOpen}
        pipeline={editTarget}
        onClose={() => {
          setEditorOpen(false);
          setEditTarget(null);
        }}
        onSaved={handleEditorSaved}
      />

      {/* Build detail drawer — shown after Run from a row */}
      <BuildDetailDrawer
        isOpen={!!runBuildId}
        buildId={runBuildId}
        onClose={() => setRunBuildId(null)}
      />
    </div>
  );
}
