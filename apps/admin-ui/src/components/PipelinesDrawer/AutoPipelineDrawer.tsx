/**
 * SpinForge - Auto Pipeline: point at a repo, get a working pipeline.
 *
 * The manual editor asks for a project type and a list of build stages.
 * The repository already answers both, so this asks for a URL instead and
 * lets Railpack read the rest — runtime, package manager, build command,
 * output directory, start command.
 *
 * Detection is shown before anything is created. An inferred pipeline that
 * silently guesses wrong is worse than a form; seeing "Node 24, yarn,
 * builds to dist, served as static files" is what makes it trustworthy.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Wand2, Loader2, AlertCircle, CheckCircle2, X, Package, Terminal, GitBranch,
} from 'lucide-react';
import apiClient from '../../services/axios-config';
import { buildApi } from '../../services/buildApi';

interface Detected {
  ok: boolean;
  type: 'static' | 'container';
  outputDir: string | null;
  startCommand: string | null;
  installCommands: string[];
  buildCommands: string[];
  runtime: string | null;
  packageManager: string | null;
  providers: string[];
  commit?: string;
  reason?: string;
}

interface AppOption { domain: string; type?: string; customerId?: string }

interface AutoPipelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** customer-ui talks to the customer routes; admin-ui to the admin ones. */
  scope?: 'customer' | 'admin';
}

export default function AutoPipelineDrawer({
  isOpen, onClose, onCreated, scope = 'customer',
}: AutoPipelineDrawerProps) {
  const sitesPath = scope === 'admin' ? '/api/sites' : '/_api/customer/sites';

  const [url, setUrl] = useState('');
  const [ref, setRef] = useState('');
  const [rootDir, setRootDir] = useState('');
  const [token, setToken] = useState('');
  const [domain, setDomain] = useState('');
  const [apps, setApps] = useState<AppOption[]>([]);

  const [detecting, setDetecting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detected, setDetected] = useState<Detected | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // Errors belong in the drawer, not only in a toast. A failed create that
  // says nothing is indistinguishable from a dead button.
  const [createError, setCreateError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Array<{ id: string; name?: string }>>([]);
  const [customerId, setCustomerId] = useState('');
  // What to do with the build. 'build' stops at the artifact — no app, no
  // domain, no deploy stage.
  const [mode, setMode] = useState<'deploy' | 'build'>('deploy');
  const [target, setTarget] = useState<'existing' | 'new'>('existing');
  const [newDomain, setNewDomain] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get(sitesPath);
        const list: AppOption[] = (Array.isArray(data) ? data : data?.data || data?.sites || [])
          .map((s: any) => ({ domain: s.domain, type: s.type, customerId: s.customerId }))
          .filter((s: AppOption) => !!s.domain)
          .sort((a: AppOption, b: AppOption) => a.domain.localeCompare(b.domain));
        if (!cancelled) setApps(list);
      } catch { /* the picker just stays empty */ }
    })();
    if (scope === 'admin') {
      buildApi.listCustomers?.()
        .then((r: any) => { if (!cancelled) setCustomers((r.customers || []).map((c: any) => ({ id: c.id, name: c.name }))); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [isOpen, sitesPath, scope]);

  // Any change to what we'd inspect invalidates the previous answer —
  // showing stale detection next to an edited URL would be a lie.
  useEffect(() => { setDetected(null); setError(null); }, [url, ref, rootDir]);

  async function detect() {
    if (!url.trim()) { toast.error('Enter a repository URL'); return; }
    setDetecting(true); setError(null); setDetected(null); setSuggestions([]);
    try {
      // building-api lives on its own host, so this must go through
      // buildApi — the hosting client would send it same-origin and 401.
      const data = await buildApi.detectRepo({
        url: url.trim(),
        ref: ref.trim() || undefined,
        rootDir: rootDir.trim() || undefined,
        token: token.trim() || undefined,
      });
      setDetected(data);
      // The repo (or the subdirectory, for a monorepo) is the obvious name.
      if (!newDomain) {
        const base = (rootDir.trim() || url.trim().split('/').pop() || '')
          .replace(/\.git$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (base) setNewDomain(`${base}.spinforge.dev`);
      }
    } catch (e: any) {
      const body = e?.response?.data;
      setError(body?.message || e?.message || 'Could not inspect this repository');
      // A monorepo root detects as nothing; the server lists the folders
      // that do look like projects so this is one click, not a dead end.
      setSuggestions(Array.isArray(body?.suggestedSubdirs) ? body.suggestedSubdirs : []);
    } finally {
      setDetecting(false);
    }
  }

  async function create() {
    const wantsDeploy = mode === 'deploy';
    const targetDomain = target === 'new' ? newDomain.trim() : domain;
    if (wantsDeploy && !targetDomain) {
      setCreateError(target === 'new' ? 'Enter a domain for the new app' : 'Choose the app this repository deploys to');
      return;
    }
    setCreating(true); setCreateError(null);
    try {
      // An admin's credentials imply no account, so the owning customer
      // has to travel with the request. A customer's own token already
      // carries it.
      // A new app isn't in `apps` yet, so its owner can't be looked up
      // there — an admin picks the customer explicitly.
      const owner = customerId || apps.find((a) => a.domain === domain)?.customerId;
      await buildApi.autoPipeline({
        url: url.trim(),
        ref: ref.trim() || undefined,
        rootDir: rootDir.trim() || undefined,
        token: token.trim() || undefined,
        mode,
        ...(wantsDeploy ? { domain: targetDomain, createApp: target === 'new' } : {}),
        ...(scope === 'admin' && owner ? { customerId: owner } : {}),
      });
      // Close first. Refreshing the list behind us is the parent's problem
      // and must never be able to make a successful create look failed:
      // when onCreated() threw, onClose() was skipped and control fell into
      // the catch below, so the pipeline existed while the drawer sat there
      // reporting an error.
      toast.success(wantsDeploy ? 'Pipeline created' : 'Build-only pipeline created');
      onClose();
      try { onCreated?.(); } catch { /* the list will catch up on its own */ }
    } catch (e: any) {
      const body = e?.response?.data;
      setCreateError(body?.message || body?.error || e?.message || 'Could not create the pipeline');
    } finally {
      setCreating(false);
    }
  }

  const field = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Auto Pipeline</h2>
                  <p className="text-sm text-gray-500">
                    Paste a repository. SpinForge works out how to build it.
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Repository URL</label>
                <input
                  className={`${field} font-mono`}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/you/your-app"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Branch <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input className={field} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="main" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subdirectory <span className="text-gray-400 font-normal">(monorepo)</span>
                  </label>
                  <input className={field} value={rootDir} onChange={(e) => setRootDir(e.target.value)} placeholder="apps/web" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access token <span className="text-gray-400 font-normal">(private repos only)</span>
                </label>
                <input
                  type="password"
                  className={`${field} font-mono`}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_…"
                />
              </div>

              <button
                onClick={detect}
                disabled={detecting || !url.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl disabled:opacity-50 hover:from-purple-700 hover:to-blue-700"
              >
                {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {detecting ? 'Inspecting repository…' : 'Detect'}
              </button>

              {error && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900 whitespace-pre-wrap">{error}</p>
                  </div>
                  {suggestions.length > 0 && (
                    <div className="pl-8">
                      <p className="text-xs font-medium text-amber-900 mb-2">
                        Projects found in this repository — pick one:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((d) => (
                          <button
                            key={d}
                            onClick={() => { setRootDir(d); setError(null); setSuggestions([]); }}
                            className="px-3 py-1.5 text-xs font-mono rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100"
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detected && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="font-medium text-emerald-900">
                      Detected: {detected.type === 'static' ? 'Static site' : 'Container service'}
                    </span>
                  </div>
                  <p className="text-sm text-emerald-800">{detected.reason}</p>

                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <Row icon={<Package className="w-4 h-4" />} label="Runtime"
                         value={[detected.runtime, detected.packageManager].filter(Boolean).join(' · ') || '—'} />
                    {detected.outputDir && <Row label="Output" value={detected.outputDir} mono />}
                    {detected.startCommand && (
                      <Row icon={<Terminal className="w-4 h-4" />} label="Start" value={detected.startCommand} mono />
                    )}
                    {detected.commit && <Row icon={<GitBranch className="w-4 h-4" />} label="Commit" value={detected.commit.slice(0, 12)} mono />}
                  </dl>

                  {!!detected.buildCommands?.length && (
                    <div>
                      <p className="text-xs font-medium text-emerald-900 mb-1">Build</p>
                      <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto">
                        {[...(detected.installCommands || []), ...detected.buildCommands].join('\n')}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {detected && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">What should this pipeline do?</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setMode('deploy')}
                        className={`text-left px-4 py-3 rounded-xl border transition ${mode === 'deploy' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <div className="text-sm font-medium text-gray-900">Build &amp; deploy</div>
                        <div className="text-xs text-gray-500">Publish it to an app.</div>
                      </button>
                      <button
                        onClick={() => setMode('build')}
                        className={`text-left px-4 py-3 rounded-xl border transition ${mode === 'build' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <div className="text-sm font-medium text-gray-900">Build only</div>
                        <div className="text-xs text-gray-500">Produce an artifact, deploy nothing.</div>
                      </button>
                    </div>
                  </div>

                  {scope === 'admin' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Customer <span className="text-red-500">*</span>
                      </label>
                      <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={field}>
                        <option value="">Select a customer…</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>{c.name ? `${c.name} — ${c.id}` : c.id}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {mode === 'deploy' && (
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <label className="text-sm font-medium text-gray-700">Deploy to</label>
                        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                          {(['existing', 'new'] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setTarget(t)}
                              className={`px-3 py-1 text-xs font-medium rounded-md ${target === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                            >
                              {t === 'existing' ? 'Existing app' : 'New app'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {target === 'existing' ? (
                        <select value={domain} onChange={(e) => setDomain(e.target.value)} className={field}>
                          <option value="">Select an application…</option>
                          {apps.map((a) => (
                            <option key={a.domain} value={a.domain}>{a.domain}</option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input
                            className={`${field} font-mono`}
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder="my-app.spinforge.dev"
                          />
                          <p className="mt-2 text-xs text-gray-500">
                            Created as a <span className="font-medium">{detected.type === 'static' ? 'static site' : 'container service'}</span> — taken
                            from what was detected, so there is nothing to choose.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {detected && (
              <div className="border-t border-gray-100 px-6 py-4">
                {createError && (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 flex gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{createError}</p>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                <button onClick={onClose} className="px-5 py-2.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={create}
                  disabled={creating || (mode === 'deploy' && !(target === 'new' ? newDomain.trim() : domain)) || (scope === 'admin' && !customerId && !apps.find((a) => a.domain === domain)?.customerId)}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creating ? 'Creating…' : 'Create pipeline'}
                </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Row({ icon, label, value, mono }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-emerald-700">{icon}{label}</dt>
      <dd className={`text-emerald-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
