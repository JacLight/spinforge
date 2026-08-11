/**
 * SpinForge - Pipelines → Build detail drawer.
 *
 * Slides in from the right. Polls /api/builds/:id every 2s while the
 * build is queued/running, and polls each expanded running stage for
 * its event/log tail at the same cadence.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayCircle, RefreshCw, Workflow, CheckCircle2, Circle, AlertCircle,
  Clock, XCircle, SkipForward, ChevronDown, ChevronRight, Download, Ban, Play,
  RotateCcw, FileText, X, Calendar, Info, ExternalLink, Copy, Check, Loader2,
  Archive,
} from 'lucide-react';

// Output keys we surface as downloadable artifacts; matches server.
const ARTIFACT_KEYS = new Set([
  'artifactPath', 'artifactZip', 'ipaPath', 'aab', 'apkPath',
  'signedPath', 'archivePath', 'imageRef', 'url',
]);
import {
  buildApi, Build, Stage, BuildEvent, StageLogLine,
  relativeTime, formatDuration, friendlyError,
} from '../../services/buildApi';

const TERMINAL = new Set(['succeeded', 'failed', 'canceled']);
const LEVELS = ['', 'debug', 'info', 'warn', 'error'] as const;

function BuildStatusPill({ status }: { status: string }) {
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

function StageIcon({ status }: { status?: string }) {
  switch (status) {
    case 'succeeded': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case 'failed':    return <AlertCircle className="h-5 w-5 text-red-600" />;
    case 'running':   return <Clock className="h-5 w-5 text-blue-600 animate-pulse" />;
    case 'skipped':
    case 'skipped_unimplemented':
      return <SkipForward className="h-5 w-5 text-gray-400" />;
    case 'pending':
    default:          return <Circle className="h-5 w-5 text-gray-400" />;
  }
}

function LevelPill({ level }: { level: string }) {
  const map: Record<string, string> = {
    debug: 'bg-gray-100 text-gray-600',
    info:  'bg-blue-50 text-blue-700',
    warn:  'bg-amber-50 text-amber-700',
    error: 'bg-red-50 text-red-700',
  };
  const cls = map[level] || 'bg-gray-100 text-gray-600';
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${cls}`}>{level}</span>;
}

// ─── Artifacts strip (shown above raw output JSON for succeeded stages) ─

function ArtifactsRow({ buildId, stage }: { buildId: string; stage: Stage }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const outs = stage.outputs || {};
  const rows = Object.entries(outs)
    .filter(([k, v]) => ARTIFACT_KEYS.has(k) && typeof v === 'string' && (v as string).length > 0)
    .map(([k, v]) => ({ key: k, value: String(v) }));
  if (rows.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
        <Archive className="h-3.5 w-3.5 text-blue-600" /> Artifacts ({rows.length})
      </div>
      {err && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">{err}</div>
      )}
      <div className="space-y-1.5">
        {rows.map(({ key, value }) => {
          const isUrl = /^https?:\/\//i.test(value);
          const isImageRef = key === 'imageRef';
          const rowId = `${stage.id}-${key}`;
          const isBusy = busy === rowId;
          const isCopied = copied === rowId;
          const ActionIcon = isUrl ? ExternalLink : isImageRef ? (isCopied ? Check : Copy) : Download;
          const label = isUrl ? 'Open' : isImageRef ? (isCopied ? 'Copied' : 'Copy ref') : 'Download';

          const onAction = async () => {
            if (isUrl) { window.open(value, '_blank', 'noopener'); return; }
            if (isImageRef) {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(rowId);
                setTimeout(() => setCopied((c) => (c === rowId ? null : c)), 1500);
              } catch { /* ignore */ }
              return;
            }
            setBusy(rowId);
            try { await buildApi.downloadArtifact(buildId, stage.id, key); }
            catch (e: any) { setErr(friendlyError(e)); }
            finally { setBusy((b) => (b === rowId ? null : b)); }
          };

          return (
            <div key={key} className="bg-white/80 rounded-lg border border-gray-200 px-3 py-2 flex items-center justify-between gap-3 hover:border-blue-200 transition-all duration-200">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <code className="text-[10px] bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-1.5 py-0.5 rounded text-gray-700 font-medium whitespace-nowrap">{key}</code>
                <code className="text-[11px] text-gray-600 font-mono truncate" title={value}>{value}</code>
              </div>
              <button
                onClick={onAction}
                disabled={isBusy}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md text-[11px] font-medium hover:shadow-md transition-all duration-200 disabled:opacity-50 flex-shrink-0"
              >
                {isBusy
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <ActionIcon className="h-3 w-3" />}
                <span>{isBusy ? '...' : label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Per-stage card ────────────────────────────────────────────────────

function StageCard({
  buildId, stage, initiallyExpanded, onRetry,
}: {
  buildId: string;
  stage: Stage;
  initiallyExpanded: boolean;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [events, setEvents] = useState<BuildEvent[]>([]);
  const [log, setLog] = useState<StageLogLine[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [retryOverridesRaw, setRetryOverridesRaw] = useState<string>('');
  const [retryBusy, setRetryBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (stage.status === 'running' || stage.status === 'failed') setExpanded(true);
  }, [stage.status]);

  const loadStage = useCallback(async () => {
    try {
      const r = await buildApi.getStageDetail(buildId, stage.id);
      setEvents(r.events || []);
      setLog(r.log || []);
      setErr(null);
    } catch (e: any) {
      setErr(friendlyError(e));
    }
  }, [buildId, stage.id]);

  useEffect(() => {
    if (!expanded) return;
    loadStage();
    if (stage.status === 'running') {
      const t = setInterval(loadStage, 2000);
      return () => clearInterval(t);
    }
  }, [expanded, stage.status, loadStage]);

  useEffect(() => {
    if (expanded && logEndRef.current) logEndRef.current.scrollIntoView({ block: 'end' });
  }, [log, expanded]);

  async function handleRetry() {
    let overrides: Record<string, any> | undefined;
    if (retryOverridesRaw.trim()) {
      try { overrides = JSON.parse(retryOverridesRaw); }
      catch (e: any) { setErr('Retry overrides JSON: ' + e.message); return; }
    }
    setRetryBusy(true);
    try {
      await buildApi.retryStage(buildId, stage.id, overrides);
      onRetry();
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setRetryBusy(false);
    }
  }

  function downloadLog() {
    const text = log.map((l) => l.line).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${buildId}-${stage.id}.log`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  const visibleEvents = useMemo(() => {
    if (!levelFilter) return events;
    return events.filter((e) => e.level === levelFilter);
  }, [events, levelFilter]);

  const shownLog = log.slice(-500);

  const cardBg =
    stage.status === 'running'   ? 'bg-blue-50/70 border-blue-200' :
    stage.status === 'failed'    ? 'bg-red-50/70 border-red-200' :
    stage.status === 'succeeded' ? 'bg-green-50/70 border-green-200' :
                                   'bg-white/70 border-gray-200';

  return (
    <div className={`rounded-2xl border shadow-sm transition-all duration-200 ${cardBg}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-5 flex items-center justify-between hover:bg-white/40 rounded-2xl transition-colors duration-200 text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <StageIcon status={stage.status} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900">{stage.name || stage.id}</span>
              <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono">{stage.id}</code>
              <code className="text-[10px] bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-gray-800 px-1.5 py-0.5 rounded font-mono">
                {stage.action}
              </code>
            </div>
            {stage.status === 'failed' && stage.error && (
              <div className="text-xs text-red-700 mt-1 font-mono truncate">{stage.error}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          {(stage.attempt ?? 1) > 1 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
              attempt {stage.attempt}
            </span>
          )}
          <span className="text-[11px] text-gray-500 font-mono whitespace-nowrap">
            {stage.durationMs != null ? formatDuration(stage.durationMs) : (stage.status === 'running' ? 'running…' : '—')}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {err && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{err}</div>
          )}

          {stage.status === 'failed' && stage.error && (
            <div className="p-3 bg-red-100 border border-red-200 rounded-xl text-sm text-red-800">
              <div className="text-xs uppercase tracking-wider text-red-700 mb-1 font-semibold">Stage failed</div>
              <div className="font-mono text-xs whitespace-pre-wrap">{stage.error}</div>
            </div>
          )}

          {stage.with && Object.keys(stage.with).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Inputs
              </div>
              <pre className="text-[11px] font-mono bg-gray-900 text-gray-100 rounded-xl px-3 py-2 overflow-auto max-h-80 leading-relaxed">
                {JSON.stringify(stage.with, null, 2)}
              </pre>
            </div>
          )}

          {stage.status === 'succeeded' && stage.outputs && Object.keys(stage.outputs).length > 0 && (
            <div className="space-y-3">
              <ArtifactsRow buildId={buildId} stage={stage} />
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Outputs
                </div>
                <pre className="text-[11px] font-mono bg-gray-900 text-gray-100 rounded-xl px-3 py-2 overflow-auto max-h-80 leading-relaxed">
                  {JSON.stringify(stage.outputs, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Events ({events.length})
              </div>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {LEVELS.map((l) => <option key={l} value={l}>{l || 'all levels'}</option>)}
              </select>
            </div>
            {visibleEvents.length === 0 ? (
              <div className="text-[11px] text-gray-400 italic">(no events)</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left w-24">Time</th>
                      <th className="px-3 py-2 text-left w-14">Level</th>
                      <th className="px-3 py-2 text-left w-24">Phase</th>
                      <th className="px-3 py-2 text-left">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEvents.map((e) => (
                      <tr key={e.id} className="border-t border-gray-100 align-top">
                        <td className="px-3 py-1.5 text-gray-500 font-mono whitespace-nowrap" title={e.ts}>
                          {new Date(e.ts).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-1.5"><LevelPill level={e.level} /></td>
                        <td className="px-3 py-1.5 text-gray-600 font-mono">{e.phase}</td>
                        <td className="px-3 py-1.5 text-gray-800 font-mono break-all">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> Log (last 500 lines)
              </div>
              <button
                onClick={downloadLog}
                disabled={!log.length}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
              >
                <Download className="h-3 w-3" /> Download
              </button>
            </div>
            {shownLog.length === 0 ? (
              <div className="text-[11px] text-gray-400 italic">(no log output)</div>
            ) : (
              <pre className="text-[11px] font-mono bg-gray-900 text-gray-100 rounded-xl px-3 py-2 overflow-auto max-h-80 leading-relaxed whitespace-pre-wrap">
                {shownLog.map((l) => (
                  <div key={l.id} className={l.stream === 'stderr' ? 'text-red-300' : 'text-gray-100'}>
                    {l.line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </pre>
            )}
          </div>

          {(stage.status === 'failed' || stage.status === 'succeeded') && (
            <div className="border-t border-gray-200/60 pt-4">
              <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <RotateCcw className="h-3 w-3 text-blue-600" /> Retry this stage
              </div>
              <textarea
                rows={2}
                placeholder='Optional input overrides, e.g. { "branch": "fix/xyz" }'
                value={retryOverridesRaw}
                onChange={(e) => setRetryOverridesRaw(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              <button
                onClick={handleRetry}
                disabled={retryBusy}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" /> Retry stage
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Drawer ────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  buildId: string | null;
}

export default function BuildDetailDrawer({ isOpen, onClose, buildId }: Props) {
  const [build, setBuild] = useState<Build | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!buildId) return;
    setLoading(true);
    try {
      const b = await buildApi.getBuild(buildId);
      setBuild(b);
      setErr(null);
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [buildId]);

  // Fresh load when opened / target build changes
  useEffect(() => {
    if (!isOpen || !buildId) return;
    setBuild(null);
    setErr(null);
    load();
  }, [isOpen, buildId, load]);

  // Poll while queued/running.
  useEffect(() => {
    if (!isOpen || !build) return;
    if (TERMINAL.has(build.status)) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [isOpen, build, load]);

  async function handleCancel() {
    if (!buildId) return;
    setBusy(true);
    try { await buildApi.cancelBuild(buildId); await load(); }
    catch (e: any) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  }

  async function handleResume() {
    if (!buildId) return;
    setBusy(true);
    try { await buildApi.resumeBuild(buildId); await load(); }
    catch (e: any) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — higher z to sit above a pipeline-detail drawer if nested */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-5xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 shadow-2xl z-[70] flex flex-col overflow-hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          >
            {/* Glassmorphic Header */}
            <div className="relative bg-white/70 backdrop-blur-2xl border-b border-white/50 shadow-lg">
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl" />
              </div>

              <div className="relative px-8 py-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent font-mono">
                        {(buildId ?? '').slice(0, 20)}
                      </h2>
                      {build && <BuildStatusPill status={build.status} />}
                    </div>
                    {build && (
                      <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                        <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-md text-xs font-medium text-gray-700 flex items-center gap-1">
                          <Workflow className="h-3 w-3" />
                          {build.pipelineSnapshot?.name || build.pipelineId}
                        </span>
                        <span className="text-xs">{build.customerId}</span>
                        <span className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3" />
                          started {relativeTime(build.startedAt || build.createdAt)}
                        </span>
                        {build.durationMs != null && (
                          <span className="text-xs font-mono">{formatDuration(build.durationMs)}</span>
                        )}
                        <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {build.trigger?.type}
                        </code>
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

                    {build?.status === 'running' && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleCancel}
                        disabled={busy}
                        className="group px-5 py-2.5 bg-white/80 backdrop-blur-xl border border-red-200 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 disabled:opacity-50"
                      >
                        <Ban className="h-4 w-4" />
                        <span className="font-medium">Cancel</span>
                      </motion.button>
                    )}
                    {build?.status === 'failed' && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleResume}
                        disabled={busy}
                        className="group px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 shadow-lg flex items-center gap-2 disabled:opacity-50"
                      >
                        <Play className="h-4 w-4" />
                        <span className="font-medium">Resume</span>
                      </motion.button>
                    )}

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

              <div className="relative px-8 py-8 pb-24 space-y-6">
                {err && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{err}</div>
                )}

                {build?.status === 'failed' && build.error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-800">
                    <div className="text-xs uppercase tracking-wider text-red-700 mb-1 font-semibold">Build error</div>
                    <div className="font-mono text-xs whitespace-pre-wrap">{build.error}</div>
                  </div>
                )}

                {build?.status === 'canceled' && (
                  <div className="p-4 bg-gray-100 border border-gray-200 rounded-2xl text-sm text-gray-700 flex items-center gap-2">
                    <XCircle className="h-4 w-4" /> Build was canceled.
                  </div>
                )}

                {build ? (
                  <div className="space-y-3">
                    {build.stages.map((s) => (
                      <StageCard
                        key={s.id}
                        buildId={build.id}
                        stage={s}
                        initiallyExpanded={s.status === 'running' || s.status === 'failed'}
                        onRetry={load}
                      />
                    ))}
                    {build.stages.length === 0 && (
                      <div className="text-sm text-gray-400 italic">No stages in this build.</div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                )}

                {build && build.inputs && Object.keys(build.inputs).length > 0 && (
                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600" /> Build inputs
                    </h3>
                    <pre className="text-[11px] font-mono bg-gray-900 text-gray-100 rounded-xl px-3 py-2 overflow-auto max-h-80 leading-relaxed">
                      {JSON.stringify(build.inputs, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
