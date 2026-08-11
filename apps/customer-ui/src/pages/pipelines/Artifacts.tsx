/**
 * SpinForge - Pipelines → Artifacts (global list)
 *
 * Every downloadable artifact produced by any build, across pipelines.
 * We don't have a dedicated /artifacts endpoint — artifacts live on
 * stage.outputs inside each build record, keyed by the same slugs the
 * BuildDetailDrawer uses (artifactPath, ipaPath, aab, imageRef, url…).
 * So we list recent builds and flatten the artifact outputs into one
 * row per artifact.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Archive, RefreshCw, Filter, Search, Download, ExternalLink,
  Copy, Check, Loader2, Workflow, Package,
} from 'lucide-react';
import {
  buildApi, Build, Stage, relativeTime, friendlyError,
} from '../../services/buildApi';
import BuildDetailDrawer from '../../components/PipelinesDrawer/BuildDetailDrawer';

// Must match ARTIFACT_KEYS on the server + BuildDetailDrawer.
const ARTIFACT_KEYS = new Set([
  'artifactPath', 'artifactZip', 'ipaPath', 'aab', 'apkPath',
  'signedPath', 'archivePath', 'imageRef', 'url',
]);

const KIND_LABEL: Record<string, string> = {
  artifactPath: 'Build output',
  artifactZip:  'Zip',
  ipaPath:      'iOS IPA',
  aab:          'Android AAB',
  apkPath:      'Android APK',
  signedPath:   'Signed build',
  archivePath:  'Archive',
  imageRef:     'Container image',
  url:          'URL',
};

interface ArtifactRow {
  buildId: string;
  build: Build;
  stage: Stage;
  key: string;
  value: string;
  createdAt: string;
  pipelineName: string;
  pipelineId: string;
  customerId: string;
}

function flattenArtifacts(builds: Build[]): ArtifactRow[] {
  const out: ArtifactRow[] = [];
  for (const b of builds) {
    for (const s of b.stages || []) {
      if (s.status !== 'succeeded' || !s.outputs) continue;
      for (const [k, v] of Object.entries(s.outputs)) {
        if (!ARTIFACT_KEYS.has(k)) continue;
        if (typeof v !== 'string' || !v) continue;
        out.push({
          buildId: b.id,
          build: b,
          stage: s,
          key: k,
          value: v,
          createdAt: s.completedAt || b.completedAt || b.createdAt,
          pipelineName: b.pipelineSnapshot?.name || b.pipelineId,
          pipelineId: b.pipelineId,
          customerId: b.customerId,
        });
      }
    }
  }
  // newest first
  out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return out;
}

function KindPill({ kind }: { kind: string }) {
  const label = KIND_LABEL[kind] || kind;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 border border-blue-200/50">
      <Package className="h-3 w-3" /> {label}
    </span>
  );
}

function ArtifactActionBtn({
  row, onError,
}: {
  row: ArtifactRow;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUrl = /^https?:\/\//i.test(row.value);
  const isImageRef = row.key === 'imageRef';
  const Icon = isUrl ? ExternalLink : isImageRef ? (copied ? Check : Copy) : Download;
  const label = isUrl ? 'Open' : isImageRef ? (copied ? 'Copied' : 'Copy ref') : 'Download';

  async function handle(e: React.MouseEvent) {
    e.stopPropagation();
    if (isUrl) { window.open(row.value, '_blank', 'noopener'); return; }
    if (isImageRef) {
      try {
        await navigator.clipboard.writeText(row.value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch { /* ignore */ }
      return;
    }
    setBusy(true);
    try { await buildApi.downloadArtifact(row.buildId, row.stage.id, row.key); }
    catch (e: any) { onError(friendlyError(e)); }
    finally { setBusy(false); }
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-xs font-medium hover:shadow-md transition-all duration-200 disabled:opacity-50 flex-shrink-0"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      <span>{busy ? '...' : label}</span>
    </button>
  );
}

export default function Artifacts() {
  const [builds, setBuilds] = useState<Build[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dlErr, setDlErr] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [kind, setKind] = useState('');
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
      // Only successful builds produce artifacts — filter server-side to
      // keep the payload small.
      const r = await buildApi.listBuilds({
        pipelineId: pipelineId || undefined,
        customerId: customerId || undefined,
        status: 'succeeded',
        limit,
      });
      setBuilds(r.builds || []);
      setErr(null);
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, customerId, limit]);

  const allRows = useMemo(() => flattenArtifacts(builds ?? []), [builds]);

  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (kind && r.key !== kind) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.value} ${r.buildId} ${r.pipelineName} ${r.pipelineId} ${r.customerId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, kind, search]);

  const activeFilterCount = [pipelineId, customerId, kind].filter(Boolean).length;
  const kindOptions = Array.from(ARTIFACT_KEYS);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Archive className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Artifacts
                </h1>
                <p className="text-sm text-gray-500">
                  {filtered.length}
                  {allRows.length > filtered.length ? ` of ${allRows.length}` : ''} artifacts
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
                    placeholder="Search by path, image ref, build, pipeline, customer..."
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kind</label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">All kinds</option>
                    {kindOptions.map((k) => (
                      <option key={k} value={k}>{KIND_LABEL[k] || k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Build limit</label>
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

          {(err || dlErr) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {err || dlErr}
            </div>
          )}

          {builds === null ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12">
              <div className="text-center">
                <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No artifacts yet</h3>
                <p className="text-gray-600">
                  {search || activeFilterCount > 0
                    ? 'Try adjusting your filters'
                    : 'Artifacts appear here once a pipeline produces a build output (zip, image, IPA, AAB, …).'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r, i) => (
                <div
                  key={`${r.buildId}-${r.stage.id}-${r.key}-${i}`}
                  onClick={() => setSelectedBuildId(r.buildId)}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <KindPill kind={r.key} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code
                          className="font-mono text-sm text-gray-900 truncate"
                          title={r.value}
                        >
                          {r.value}
                        </code>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Workflow className="h-3 w-3" />
                          <span className="truncate max-w-[220px]">{r.pipelineName}</span>
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="truncate max-w-[180px]" title={r.customerId}>
                          {r.customerId}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="font-mono">{r.buildId.slice(0, 12)}</span>
                        <span className="text-gray-300">·</span>
                        <span title={r.createdAt}>{relativeTime(r.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <ArtifactActionBtn row={r} onError={setDlErr} />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <BuildDetailDrawer
        isOpen={!!selectedBuildId}
        buildId={selectedBuildId}
        onClose={() => setSelectedBuildId(null)}
      />
    </div>
  );
}
