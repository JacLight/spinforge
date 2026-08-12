/**
 * SpinForge - Manifest drawer: generate an app's spinforge.yaml / .json.
 *
 * A manifest points a repository at an app that already exists, so this is
 * pipeline configuration, not a deploy action — it belongs next to
 * Pipelines rather than buried in an app's settings drawer.
 *
 * The file body comes from the API rather than being templated here, so the
 * preview is byte-for-byte what a `curl` of the same endpoint returns and
 * the two can't drift.
 *
 * Deliberately self-contained (its own app picker, no props beyond
 * open/close) so the identical file drops into both customer-ui and
 * admin-ui, whose Pipelines pages are the same.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  FileCode, Download, Copy, Check, Loader2, AlertCircle, Terminal, GitBranch, X,
} from 'lucide-react';
import apiClient from '../../services/axios-config';

type Format = 'yaml' | 'json';

interface AppOption {
  domain: string;
  appId?: string | null;
  type?: string;
}

interface ManifestDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * API surface to read from. customer-ui talks to the customer routes
   * (scoped to the signed-in account); admin-ui talks to the admin routes
   * (every app). Both render the manifest through the same server-side
   * helper, so the file is identical either way.
   */
  scope?: 'customer' | 'admin';
}

const BUILD_ENDPOINT = 'https://build.spinforge.dev/_api/customer/manifest';

export default function ManifestDrawer({ isOpen, onClose, scope = 'customer' }: ManifestDrawerProps) {
  const sitesPath = scope === 'admin' ? '/api/sites' : '/_api/customer/sites';
  const [apps, setApps] = useState<AppOption[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [domain, setDomain] = useState('');
  const [format, setFormat] = useState<Format>('yaml');
  const [repoUrl, setRepoUrl] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'file' | 'command' | null>(null);

  const filename = `spinforge.${format}`;

  // Load the app list when the drawer opens, not on mount — this sits on a
  // page that may never open it.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setAppsLoading(true);
      try {
        const { data } = await apiClient.get(sitesPath);
        const list: AppOption[] = (Array.isArray(data) ? data : data?.data || data?.sites || [])
          .map((s: any) => ({ domain: s.domain, appId: s.appId, type: s.type }))
          .filter((s: AppOption) => !!s.domain)
          .sort((a: AppOption, b: AppOption) => a.domain.localeCompare(b.domain));
        if (!cancelled) setApps(list);
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || 'Could not load applications');
      } finally {
        if (!cancelled) setAppsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, sitesPath]);

  // Refetch when the app, format, or repo URL settles. The debounce is for
  // the URL field — one request per keystroke would be silly for a file
  // that only echoes what was typed.
  useEffect(() => {
    if (!domain) { setContent(''); setError(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = { format };
        if (repoUrl.trim()) params.repo = repoUrl.trim();
        const { data } = await apiClient.get(
          `${sitesPath}/${encodeURIComponent(domain)}/manifest`,
          { params, responseType: 'text', transformResponse: [(d: any) => d] },
        );
        if (!cancelled) setContent(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      } catch (e: any) {
        if (cancelled) return;
        let message = e?.response?.data?.error || e?.message || 'Could not build the manifest';
        // responseType:text means an error body arrives as a JSON string.
        if (typeof e?.response?.data === 'string') {
          try { message = JSON.parse(e.response.data).error || message; } catch { /* keep message */ }
        }
        setError(message);
        setContent('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, repoUrl ? 400 : 0);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [domain, format, repoUrl, sitesPath]);

  const command = [
    `curl -X POST ${BUILD_ENDPOINT} \\`,
    `     -H "Authorization: Bearer $SPINFORGE_TOKEN" \\`,
    `     -H "Content-Type: application/${format}" \\`,
    `     --data-binary @${filename}`,
  ].join('\n');

  async function copy(text: string, what: 'file' | 'command') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  function download() {
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'application/yaml',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filename} downloaded`);
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
            className="fixed right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Deploy from a Git repository</h2>
                  <p className="text-sm text-gray-500">
                    Generate the manifest you commit to your repo.
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Application</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={appsLoading}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                >
                  <option value="">
                    {appsLoading ? 'Loading applications…' : 'Select an application…'}
                  </option>
                  {apps.map((a) => (
                    <option key={a.domain} value={a.domain}>
                      {a.domain}{a.type ? ` — ${a.type}` : ''}
                    </option>
                  ))}
                </select>
                {!appsLoading && apps.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500">
                    No applications yet. Create one first, then come back for its manifest.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repository URL <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/you/your-app"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {domain && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <FileCode className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-mono text-gray-700">{filename}</span>
                    </div>
                    <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                      {(['yaml', 'json'] as Format[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFormat(f)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                            format === f ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-900">{error}</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-sm overflow-x-auto min-h-[7rem]">
                        {loading ? (
                          <span className="flex items-center gap-2 text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin" /> building…
                          </span>
                        ) : content}
                      </pre>
                      {!loading && content && (
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => copy(content, 'file')}
                            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                          >
                            {copied === 'file' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            Copy
                          </button>
                          <button
                            onClick={download}
                            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600"
                          >
                            <Download className="h-4 w-4" /> Download
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {domain && content && !error && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Deploy on every push</span>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto">{command}</pre>
                  <button
                    onClick={() => copy(command, 'command')}
                    className="mt-3 flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    {copied === 'command' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    Copy command
                  </button>
                  <p className="mt-3 text-xs text-gray-500">
                    Commit <code className="font-mono">{filename}</code> to your repository root. The
                    manifest carries no secret — the <code className="font-mono">sfc_</code> token comes
                    from your CI secrets.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
