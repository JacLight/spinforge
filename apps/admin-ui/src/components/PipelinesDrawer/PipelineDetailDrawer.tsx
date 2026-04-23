/**
 * SpinForge - Pipelines → Detail drawer (Overview / Builds).
 *
 * Slides in from the right. Tabs:
 *   - Overview  — stage preview, Edit / Delete / Run now
 *   - Builds    — last 50 builds, live-refresh every 3s while any are running.
 *                 Clicking a row opens a BuildDetailDrawer overlay.
 *
 * The parent owns the "edit this pipeline" flow — when the user clicks
 * Edit in the Overview tab, we call `onEdit()` and the parent swaps
 * this drawer for PipelineEditorDrawer with the record loaded.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Workflow, Play, Pencil, Trash2, RefreshCw, ChevronRight, X, Calendar,
  Package, Hammer, ShieldCheck, Send, Globe, Zap, Box, PlayCircle, Loader2,
  Info, Layers, Archive, Download, ExternalLink, Copy, Check,
} from 'lucide-react';
import {
  buildApi, Pipeline, Build, relativeTime, formatDuration, friendlyError,
} from '../../services/buildApi';
import BuildDetailDrawer from './BuildDetailDrawer';
import { useConfirm } from '../ConfirmModal';

function categoryIcon(category: string) {
  switch (category) {
    case 'source': return Package;
    case 'build':  return Hammer;
    case 'sign':   return ShieldCheck;
    case 'publish':return Send;
    case 'host':   return Globe;
    case 'util':   return Zap;
    default:       return Box;
  }
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; pulse: boolean }> = {
    queued:    { bg: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500',   pulse: true },
    running:   { bg: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500',   pulse: true },
    succeeded: { bg: 'bg-green-100 text-green-700', dot: 'bg-green-500',  pulse: false },
    failed:    { bg: 'bg-red-100 text-red-700',     dot: 'bg-red-500',    pulse: false },
    canceled:  { bg: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400',   pulse: false },
  };
  const m = map[status] || { bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', pulse: false };
  return (
    <div className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${m.bg}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${m.dot} ${m.pulse ? 'animate-pulse' : ''}`} />
      {status}
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pipelineId: string | null;
  onEdit: (p: Pipeline) => void;
  onDeleted?: () => void;
}

export default function PipelineDetailDrawer({ isOpen, onClose, pipelineId, onEdit, onDeleted }: Props) {
  const confirm = useConfirm();
  const [tab, setTab] = useState<'overview' | 'builds' | 'artifacts'>('overview');
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [builds, setBuilds] = useState<Build[] | null>(null);
  const [actionCategoryById, setActionCategoryById] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const [p, b] = await Promise.all([
        buildApi.getPipeline(pipelineId),
        buildApi.listBuilds({ pipelineId, limit: 50 }),
      ]);
      setPipeline(p);
      setBuilds(b.builds || []);
      setErr(null);
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  // Reset + load whenever drawer opens or target pipeline changes.
  useEffect(() => {
    if (!isOpen || !pipelineId) return;
    setTab('overview');
    setPipeline(null);
    setBuilds(null);
    setErr(null);
    load();
    // Also pull action catalog once so we can render category icons.
    (async () => {
      try {
        const cat = await buildApi.listActions();
        const m: Record<string, string> = {};
        cat.actions.forEach((a) => { m[a.id] = a.category; });
        setActionCategoryById(m);
      } catch { /* ignore — icons fall back */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pipelineId]);

  // Live-refresh builds list while any in-flight.
  useEffect(() => {
    if (!isOpen || !pipelineId) return;
    const anyActive = (builds ?? []).some((b) => b.status === 'running' || b.status === 'queued');
    if (!anyActive) return;
    const t = setInterval(async () => {
      try {
        const r = await buildApi.listBuilds({ pipelineId, limit: 50 });
        setBuilds(r.builds || []);
      } catch { /* keep prior */ }
    }, 3000);
    return () => clearInterval(t);
  }, [isOpen, pipelineId, builds]);

  async function handleRun() {
    if (!pipeline) return;
    setBusy(true);
    try {
      const b = await buildApi.createBuild({ pipelineId: pipeline.id, trigger: { type: 'manual' } });
      // Show the new build immediately.
      setSelectedBuildId(b.id);
      setTab('builds');
      await load();
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!pipeline) return;
    const ok = await confirm({
      title: `Delete pipeline "${pipeline.name}"?`,
      description: 'This removes the pipeline config. Past build history is kept.',
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await buildApi.deletePipeline(pipeline.id);
      onDeleted?.();
      onClose();
    } catch (e: any) {
      setErr(friendlyError(e));
      setBusy(false);
    }
  }

  const tabs = [
    { id: 'overview'  as const, label: 'Overview',  icon: Info },
    { id: 'builds'    as const, label: 'Builds',    icon: PlayCircle },
    { id: 'artifacts' as const, label: 'Artifacts', icon: Archive },
  ];

  // Collect artifact-like outputs from recent builds. Actions declare
  // their own output names (artifactPath, artifactZip, ipaPath, aab,
  // signedPath, imageRef, archivePath, url), so we pattern-match on
  // common keys across all succeeded stages.
  type ArtifactRow = {
    buildId: string;
    stageId: string;
    action: string;
    key: string;
    value: string;
    createdAt: string;
  };
  const ARTIFACT_KEYS = new Set([
    'artifactPath', 'artifactZip', 'ipaPath', 'aab', 'apkPath',
    'signedPath', 'archivePath', 'imageRef', 'url',
  ]);
  const artifactRows: ArtifactRow[] = (builds || []).flatMap((b) =>
    (b.stages || [])
      .filter((s: any) => s.status === 'succeeded' && s.outputs)
      .flatMap((s: any) =>
        Object.entries(s.outputs)
          .filter(([k, v]) => ARTIFACT_KEYS.has(k) && typeof v === 'string' && v.length > 0)
          .map(([k, v]) => ({
            buildId: b.id, stageId: s.id, action: s.action,
            key: k, value: String(v),
            createdAt: s.completedAt || b.completedAt || b.createdAt,
          }))
      )
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-5xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 shadow-2xl z-50 flex flex-col overflow-hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          >
            {/* Glassmorphic Header */}
            <div className="relative bg-white/70 backdrop-blur-2xl border-b border-white/50 shadow-lg">
              {/* Gradient orbs */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl" />
              </div>

              <div className="relative px-8 py-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                        {pipeline?.name ?? (pipelineId ?? '—')}
                      </h2>
                      {pipeline && (
                        <div className="px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 bg-green-100 text-green-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Active
                        </div>
                      )}
                    </div>
                    {pipeline && (
                      <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                        <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-md text-xs font-medium text-gray-700">
                          {pipeline.trigger?.type ?? 'manual'}
                        </span>
                        <span className="font-mono text-xs text-gray-500">{pipeline.id}</span>
                        <span className="text-xs">{pipeline.customerId}</span>
                        <span className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3" />
                          updated {relativeTime(pipeline.updatedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={load}
                      disabled={loading}
                      className="group p-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
                      title="Refresh"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleRun}
                      disabled={busy || !pipeline}
                      className="group px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 shadow-lg disabled:opacity-50 flex items-center gap-2"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      <span className="font-medium">Run</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => pipeline && onEdit(pipeline)}
                      disabled={!pipeline}
                      className="group p-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDelete}
                      disabled={busy || !pipeline}
                      className="group p-2.5 bg-white/80 backdrop-blur-xl border border-red-200 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </motion.button>

                    <div className="w-px h-8 bg-gradient-to-b from-transparent via-gray-300 to-transparent mx-1" />

                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onClose}
                      className="p-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <X className="h-5 w-5 text-gray-600" />
                    </motion.button>
                  </div>
                </div>

                {/* Tab pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {tabs.map((t, i) => (
                    <motion.button
                      key={t.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setTab(t.id)}
                      className={`group px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300 flex items-center gap-2 ${
                        tab === t.id
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                          : 'bg-white/60 hover:bg-white/80 text-gray-600 hover:text-gray-900 hover:shadow-md'
                      }`}
                    >
                      <t.icon className={`h-4 w-4 ${tab === t.id ? 'text-white' : 'text-gray-500'}`} />
                      <span>{t.label}</span>
                      {t.id === 'builds' && builds && builds.length > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          tab === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {builds.length}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto relative">
              <div className="absolute inset-0 opacity-[0.015]">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, rgb(99, 102, 241) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }} />
              </div>

              <div className="relative px-8 py-8 pb-24">
                {err && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {err}
                  </div>
                )}

                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {tab === 'overview' && (
                      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                          <Layers className="h-4 w-4 text-blue-600" /> Stages
                        </h3>
                        {pipeline ? (
                          <ol className="space-y-0">
                            {pipeline.stages.map((s, idx) => {
                              const Icon = categoryIcon(actionCategoryById[s.action] || '');
                              const disabled = s.enabled === false;
                              return (
                                <li key={s.id}>
                                  <div
                                    className={`rounded-xl border px-4 py-3 flex items-center gap-3 text-sm transition-all duration-200 ${
                                      disabled
                                        ? 'bg-gray-50 border-gray-200 opacity-60'
                                        : 'bg-white/80 border-gray-200 hover:border-blue-200'
                                    }`}
                                  >
                                    <span className="w-7 h-7 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0">
                                      {idx + 1}
                                    </span>
                                    <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                    <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{s.id}</code>
                                    <ChevronRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
                                    <code className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-gray-800 px-2 py-0.5 rounded text-xs font-mono">
                                      {s.action || '—'}
                                    </code>
                                    {disabled && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                                        Disabled
                                      </span>
                                    )}
                                    {s.continueOnError && (
                                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                        continueOnError
                                      </span>
                                    )}
                                  </div>
                                  {/* Linear chain connector — small vertical arrow
                                      between stages to reinforce ordering. */}
                                  {idx < pipeline.stages.length - 1 && (
                                    <div className="flex justify-start py-1 pl-[18px]">
                                      <div className="w-px h-4 bg-gradient-to-b from-blue-300 to-purple-300" />
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                            {pipeline.stages.length === 0 && (
                              <li className="text-sm text-gray-400 italic">No stages defined.</li>
                            )}
                          </ol>
                        ) : (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                          </div>
                        )}
                      </div>
                    )}

                    {tab === 'artifacts' && (
                      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Archive className="h-4 w-4 text-blue-600" /> Artifacts from recent builds
                          </h3>
                          <span className="text-[11px] text-gray-400">{artifactRows.length} artifact{artifactRows.length === 1 ? '' : 's'}</span>
                        </div>
                        {builds === null ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                          </div>
                        ) : artifactRows.length === 0 ? (
                          <div className="text-center py-12">
                            <Archive className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500">No artifacts produced yet. Run the pipeline to generate some.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {artifactRows.map((a, i) => {
                              const rowKey = `${a.buildId}-${a.stageId}-${a.key}`;
                              const isUrl = /^https?:\/\//i.test(a.value);
                              const isImageRef = a.key === 'imageRef';
                              const isDownloading = downloading === rowKey;
                              const isCopied = copied === rowKey;

                              const onAction = async () => {
                                if (isUrl) {
                                  window.open(a.value, '_blank', 'noopener');
                                  return;
                                }
                                if (isImageRef) {
                                  try {
                                    await navigator.clipboard.writeText(a.value);
                                    setCopied(rowKey);
                                    setTimeout(() => setCopied((c) => (c === rowKey ? null : c)), 1500);
                                  } catch { /* ignore */ }
                                  return;
                                }
                                setDownloading(rowKey);
                                try {
                                  await buildApi.downloadArtifact(a.buildId, a.stageId, a.key);
                                } catch (e: any) {
                                  setErr(friendlyError(e));
                                } finally {
                                  setDownloading((d) => (d === rowKey ? null : d));
                                }
                              };

                              const ActionIcon = isUrl ? ExternalLink : isImageRef ? (isCopied ? Check : Copy) : Download;
                              const actionLabel = isUrl ? 'Open' : isImageRef ? (isCopied ? 'Copied' : 'Copy ref') : 'Download';

                              return (
                                <div key={i} className="bg-white/80 rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3 hover:border-blue-200 transition-all duration-200">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <code className="text-[10px] bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-2 py-0.5 rounded text-gray-700 font-medium whitespace-nowrap">{a.key}</code>
                                    <span
                                      onClick={() => setSelectedBuildId(a.buildId)}
                                      className="font-mono text-xs text-blue-600 font-semibold cursor-pointer hover:underline whitespace-nowrap"
                                      title={a.buildId}
                                    >
                                      {a.buildId.slice(0, 10)}
                                    </span>
                                    <span className="text-xs text-gray-400">·</span>
                                    <code className="text-[11px] text-gray-600 font-mono truncate" title={a.value}>{a.value}</code>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <code className="text-[10px] text-gray-500 hidden md:inline">{a.action}</code>
                                    <span className="text-xs text-gray-500 hidden md:inline">{relativeTime(a.createdAt)}</span>
                                    <button
                                      onClick={onAction}
                                      disabled={isDownloading}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-xs font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                                    >
                                      {isDownloading
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <ActionIcon className="h-3.5 w-3.5" />}
                                      <span>{isDownloading ? 'Downloading' : actionLabel}</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {tab === 'builds' && (
                      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <PlayCircle className="h-4 w-4 text-blue-600" /> Recent builds
                          </h3>
                          <span className="text-[11px] text-gray-400">auto-refreshes while running</span>
                        </div>
                        {builds === null ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                          </div>
                        ) : builds.length === 0 ? (
                          <div className="text-center py-12">
                            <PlayCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500">
                              No builds yet — click <span className="text-blue-600 font-medium">Run</span> to create one.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {builds.map((b) => (
                              <div
                                key={b.id}
                                onClick={() => setSelectedBuildId(b.id)}
                                className="bg-white/80 rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all duration-200"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <StatusPill status={b.status} />
                                  <span className="font-mono text-xs text-blue-600 font-semibold">
                                    {b.id.slice(0, 12)}
                                  </span>
                                  <span className="text-xs text-gray-500" title={b.startedAt || b.createdAt}>
                                    {relativeTime(b.startedAt || b.createdAt)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <span className="text-xs text-gray-500">
                                    {b.durationMs != null ? formatDuration(b.durationMs) : '—'}
                                  </span>
                                  <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                                    {b.trigger?.type ?? '—'}
                                  </code>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Nested build-detail drawer (overlays everything else). */}
          <BuildDetailDrawer
            isOpen={!!selectedBuildId}
            buildId={selectedBuildId}
            onClose={() => setSelectedBuildId(null)}
          />
        </>
      )}
    </AnimatePresence>
  );
}
