/**
 * SpinForge - Auto Pipeline: point at a repo, get a working pipeline.
 *
 * The manual editor asks for a project type and a list of build stages.
 * The repository already answers both, so this asks for a URL instead and
 * lets Railpack read the rest — runtime, package manager, build command,
 * output directory, start command.
 *
 * Detection is shown before anything is created. An inferred pipeline that
 * silently guesses wrong is worse than a form; seeing "vite, npm, builds
 * to dist, served as static files" is what makes it trustworthy.
 *
 * Chrome deliberately matches PipelineEditorDrawer — same panel gradient,
 * blurred header orbs, card and input tokens — because the two sit behind
 * adjacent buttons on the same page and should not look like different
 * products.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Wand2, Loader2, AlertCircle, CheckCircle2, X, Package, Terminal, GitBranch,
  Rocket, Boxes, Globe, Settings,
} from 'lucide-react';
import apiClient from '../../services/axios-config';
import { buildApi } from '../../services/buildApi';

// Same tokens as PipelineEditorDrawer.
const INPUT_CLS =
  'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200';
const CARD_CLS =
  'bg-white/70 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm p-6';
const LABEL_CLS = 'block text-xs font-medium text-gray-700 mb-1.5';

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

/**
 * Short, stable label for a customer, for use inside a hostname.
 *
 * A bare app name (`qrgen.spinforge.dev`) is first-come-first-served across
 * every account — the second customer with a project called qrgen simply
 * cannot have one. Existing sites already scope by owner
 * (`deone-demo-appmint`, `sitkit-sitkit-appmint`), so suggestions follow
 * that shape rather than inventing a second convention.
 */
function customerSlug(customerId?: string): string {
  if (!customerId) return '';
  // partner_prt_<hash>_<name> → name;  cust_<uuid> → first 6 of the uuid.
  const parts = String(customerId).split('_').filter(Boolean);
  const tail = parts[parts.length - 1] || '';
  if (tail && /^[a-z][a-z0-9-]{1,23}$/i.test(tail) && !/^[0-9a-f]{8,}$/i.test(tail)) {
    return tail.toLowerCase();
  }
  return (tail || String(customerId)).replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase();
}

export default function AutoPipelineDrawer({
  isOpen, onClose, onCreated, scope = 'customer',
}: AutoPipelineDrawerProps) {
  const isAdmin = scope === 'admin';
  const sitesPath = isAdmin ? '/api/sites' : '/_api/customer/sites';

  const [url, setUrl] = useState('');
  const [gitRef, setGitRef] = useState('');
  const [rootDir, setRootDir] = useState('');
  const [token, setToken] = useState('');

  const [apps, setApps] = useState<AppOption[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name?: string }>>([]);
  const [customerId, setCustomerId] = useState('');

  const [mode, setMode] = useState<'deploy' | 'build'>('deploy');
  const [target, setTarget] = useState<'existing' | 'new'>('existing');
  const [domain, setDomain] = useState('');
  const [newDomain, setNewDomain] = useState('');

  const [detecting, setDetecting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detected, setDetected] = useState<Detected | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

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
      } catch { /* picker stays empty */ }
    })();
    // An admin's credentials imply no account, so who owns the pipeline has
    // to be asked. A customer's own token already answers it.
    if (isAdmin) {
      buildApi.listCustomers?.()
        .then((r: any) => { if (!cancelled) setCustomers((r.customers || []).map((c: any) => ({ id: c.id, name: c.name }))); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [isOpen, sitesPath, isAdmin]);

  // Editing what we'd inspect invalidates the previous answer.
  useEffect(() => { setDetected(null); setError(null); setCreateError(null); }, [url, gitRef, rootDir]);

  const inheritedOwner = apps.find((a) => a.domain === domain)?.customerId || '';
  const owner = isAdmin ? (customerId || inheritedOwner) : '';
  // Every app a customer can see is theirs, so any one identifies them.
  const ownSlug = customerSlug(isAdmin ? owner : apps[0]?.customerId);

  function suggestDomain(): string {
    const base = (rootDir.trim() || url.trim().split('/').pop() || '')
      .replace(/\.git$/, '').toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!base) return '';
    return ownSlug ? `${base}-${ownSlug}.spinforge.dev` : `${base}.spinforge.dev`;
  }

  async function detect() {
    if (!url.trim()) { setError('Enter a repository URL'); return; }
    setDetecting(true); setError(null); setCreateError(null); setDetected(null); setSuggestions([]);
    try {
      const data = await buildApi.detectRepo({
        url: url.trim(),
        ref: gitRef.trim() || undefined,
        rootDir: rootDir.trim() || undefined,
        token: token.trim() || undefined,
      });
      setDetected(data);
      if (!newDomain) setNewDomain(suggestDomain());
    } catch (e: any) {
      const body = e?.response?.data;
      setError(body?.message || e?.message || 'Could not inspect this repository');
      setSuggestions(Array.isArray(body?.suggestedSubdirs) ? body.suggestedSubdirs : []);
    } finally {
      setDetecting(false);
    }
  }

  const wantsDeploy = mode === 'deploy';
  const targetDomain = target === 'new' ? newDomain.trim() : domain;
  const blocked =
    (wantsDeploy && !targetDomain)
      ? (target === 'new' ? 'Enter a domain for the new app' : 'Choose an application')
      : (isAdmin && !owner) ? 'Choose the customer this pipeline belongs to'
      : null;

  async function create() {
    if (blocked) { setCreateError(blocked); return; }
    setCreating(true); setCreateError(null);
    try {
      await buildApi.autoPipeline({
        url: url.trim(),
        ref: gitRef.trim() || undefined,
        rootDir: rootDir.trim() || undefined,
        token: token.trim() || undefined,
        mode,
        ...(wantsDeploy ? { domain: targetDomain, createApp: target === 'new' } : {}),
        ...(isAdmin && owner ? { customerId: owner } : {}),
      });
      // Close first. Refreshing the list is the parent's problem and must
      // never make a successful create look failed — when onCreated() threw,
      // onClose() was skipped and control fell into the catch, so the
      // pipeline existed while the drawer sat there reporting an error.
      toast.success(wantsDeploy ? 'Pipeline created — build started' : 'Build-only pipeline created — build started');
      onClose();
      try { onCreated?.(); } catch { /* the list catches up on its own */ }
    } catch (e: any) {
      const body = e?.response?.data;
      setCreateError(body?.message || body?.error || e?.message || 'Could not create the pipeline');
    } finally {
      setCreating(false);
    }
  }

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
            className="fixed right-0 top-0 h-full w-full max-w-5xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 shadow-2xl z-50 flex flex-col overflow-hidden"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="relative bg-white/70 backdrop-blur-2xl border-b border-white/50 shadow-lg">
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl" />
              </div>
              <div className="relative px-8 py-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Auto Pipeline
                      </h2>
                      <div className="px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 bg-blue-100 text-blue-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        {detected ? 'Detected' : 'Railpack'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-md text-xs font-medium text-gray-700">
                        no configuration
                      </span>
                      <span>Paste a repository — SpinForge works out how to build it.</span>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
              <div className={CARD_CLS}>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-blue-600" /> Repository
                </h3>
                <div>
                  <label className={LABEL_CLS}>Repository URL <span className="text-red-600">*</span></label>
                  <input className={`${INPUT_CLS} font-mono`} value={url}
                         onChange={(e) => setUrl(e.target.value)}
                         placeholder="https://github.com/you/your-app" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className={LABEL_CLS}>Branch</label>
                    <input className={INPUT_CLS} value={gitRef} onChange={(e) => setGitRef(e.target.value)} placeholder="main" />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Subdirectory</label>
                    <input className={INPUT_CLS} value={rootDir} onChange={(e) => setRootDir(e.target.value)} placeholder="apps/web" />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Access token</label>
                    <input type="password" className={`${INPUT_CLS} font-mono`} value={token}
                           onChange={(e) => setToken(e.target.value)} placeholder="private repos only" />
                  </div>
                </div>

                <button
                  onClick={detect}
                  disabled={detecting || !url.trim()}
                  className="mt-5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 shadow-lg disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                >
                  {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {detecting ? 'Inspecting repository…' : 'Detect'}
                </button>

                {error && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-900 whitespace-pre-wrap">{error}</p>
                    </div>
                    {suggestions.length > 0 && (
                      <div className="pl-8">
                        <p className="text-xs font-medium text-amber-900 mb-2">Projects in this repository — pick one:</p>
                        <div className="flex flex-wrap gap-2">
                          {suggestions.map((d) => (
                            <button key={d}
                              onClick={() => { setRootDir(d); setError(null); setSuggestions([]); }}
                              className="px-3 py-1.5 text-xs font-mono rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition-all duration-200">
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {detected && (
                <>
                  <div className="bg-emerald-50/70 backdrop-blur-sm rounded-2xl border border-emerald-200/60 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {detected.type === 'static' ? 'Static site' : 'Container service'}
                    </h3>
                    <p className="text-sm text-emerald-800 mb-4">{detected.reason}</p>
                    <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Fact icon={<Package className="w-3.5 h-3.5" />} k="Runtime"
                            v={[detected.runtime, detected.packageManager].filter(Boolean).join(' · ') || '—'} />
                      {detected.outputDir && <Fact k="Output" v={detected.outputDir} mono />}
                      {detected.startCommand && <Fact icon={<Terminal className="w-3.5 h-3.5" />} k="Start" v={detected.startCommand} mono />}
                      {detected.commit && <Fact icon={<GitBranch className="w-3.5 h-3.5" />} k="Commit" v={detected.commit.slice(0, 12)} mono />}
                    </dl>
                    {!!detected.buildCommands?.length && (
                      <pre className="mt-4 bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto">
                        {[...(detected.installCommands || []), ...detected.buildCommands].join('\n')}
                      </pre>
                    )}
                  </div>

                  <div className={CARD_CLS}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Settings className="h-4 w-4 text-blue-600" /> Pipeline configuration
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ModeCard active={mode === 'deploy'} onClick={() => setMode('deploy')}
                                icon={<Rocket className="w-4 h-4" />} title="Build & deploy"
                                subtitle="Publish it to an app." />
                      <ModeCard active={mode === 'build'} onClick={() => setMode('build')}
                                icon={<Boxes className="w-4 h-4" />} title="Build only"
                                subtitle="Produce an artifact, deploy nothing." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                      {isAdmin && (
                        <div>
                          <label className={LABEL_CLS}>Customer <span className="text-red-600">*</span></label>
                          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={INPUT_CLS}>
                            <option value="">Select a customer…</option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>{c.name ? `${c.name} · ${c.id}` : c.id}</option>
                            ))}
                          </select>
                          {!customerId && inheritedOwner && (
                            <div className="text-[11px] text-gray-500 mt-1.5 italic">
                              Defaults to {inheritedOwner} — the app's owner
                            </div>
                          )}
                        </div>
                      )}

                      {wantsDeploy && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-medium text-gray-700">
                              Deploy to <span className="text-red-600">*</span>
                            </label>
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                              {(['existing', 'new'] as const).map((t) => (
                                <button key={t} onClick={() => setTarget(t)}
                                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${target === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                  {t === 'existing' ? 'Existing' : 'New app'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {target === 'existing' ? (
                            <select value={domain} onChange={(e) => setDomain(e.target.value)} className={INPUT_CLS}>
                              <option value="">Select an application…</option>
                              {apps.map((a) => <option key={a.domain} value={a.domain}>{a.domain}</option>)}
                            </select>
                          ) : (
                            <>
                              <input className={`${INPUT_CLS} font-mono`} value={newDomain}
                                     onChange={(e) => setNewDomain(e.target.value)}
                                     placeholder={`my-app${ownSlug ? `-${ownSlug}` : ''}.spinforge.dev`} />
                              <div className="text-[11px] text-gray-500 mt-1.5 italic flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                Created as a {detected.type === 'static' ? 'static site' : 'container service'} — from what was detected
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {detected && (
              <div className="bg-white/70 backdrop-blur-2xl border-t border-white/50 px-8 py-5">
                {createError && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 flex gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{createError}</p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs text-gray-500 italic">{blocked || ''}</p>
                  <div className="flex gap-3">
                    <button onClick={onClose}
                      className="px-5 py-2.5 text-sm bg-white/80 backdrop-blur-xl border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg">
                      Cancel
                    </button>
                    <button onClick={create} disabled={creating || !!blocked}
                      className="px-6 py-2.5 text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 shadow-lg disabled:opacity-50 flex items-center gap-2">
                      {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                      {creating ? 'Creating…' : 'Create pipeline'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Fact({ icon, k, v, mono }: { icon?: React.ReactNode; k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-emerald-700 mb-0.5">{icon}{k}</dt>
      <dd className={`text-emerald-900 ${mono ? 'font-mono text-xs break-all' : 'text-sm'}`}>{v}</dd>
    </div>
  );
}

function ModeCard({ active, onClick, icon, title, subtitle }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string;
}) {
  return (
    <button onClick={onClick}
      className={`text-left px-4 py-3.5 rounded-xl border transition-all duration-200 ${
        active
          ? 'border-blue-400 bg-gradient-to-r from-blue-500/10 to-purple-500/10 shadow-sm'
          : 'border-gray-200 bg-white/60 hover:bg-white hover:shadow-sm'
      }`}>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">{icon}{title}</div>
      <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
    </button>
  );
}
