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
    return () => { cancelled = true; };
  }, [isOpen, sitesPath]);

  // Any change to what we'd inspect invalidates the previous answer —
  // showing stale detection next to an edited URL would be a lie.
  useEffect(() => { setDetected(null); setError(null); }, [url, ref, rootDir]);

  async function detect() {
    if (!url.trim()) { toast.error('Enter a repository URL'); return; }
    setDetecting(true); setError(null); setDetected(null);
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
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not inspect this repository');
    } finally {
      setDetecting(false);
    }
  }

  async function create() {
    if (!domain) { toast.error('Choose the app this repository deploys to'); return; }
    setCreating(true);
    try {
      // An admin's credentials imply no account, so the owning customer
      // has to travel with the request. A customer's own token already
      // carries it.
      const owner = apps.find((a) => a.domain === domain)?.customerId;
      await buildApi.autoPipeline({
        url: url.trim(),
        ref: ref.trim() || undefined,
        rootDir: rootDir.trim() || undefined,
        token: token.trim() || undefined,
        domain,
        ...(scope === 'admin' && owner ? { customerId: owner } : {}),
      });
      toast.success('Pipeline created');
      onCreated?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Could not create the pipeline');
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
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{error}</p>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deploy to</label>
                  <select value={domain} onChange={(e) => setDomain(e.target.value)} className={field}>
                    <option value="">Select an application…</option>
                    {apps.map((a) => (
                      <option key={a.domain} value={a.domain}>{a.domain}</option>
                    ))}
                  </select>
                  {detected.type === 'container' && (
                    <p className="mt-2 text-xs text-gray-500">
                      This builds an image and runs it as a service. The app's first build
                      produces the image.
                    </p>
                  )}
                </div>
              )}
            </div>

            {detected && (
              <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
                <button onClick={onClose} className="px-5 py-2.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={create}
                  disabled={creating || !domain}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create pipeline
                </button>
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
