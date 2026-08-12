/**
 * SpinForge - Deploy tab: hand the customer their spinforge.yaml / .json.
 *
 * This is the control-panel half of the manifest handoff. The panel owns app
 * creation (that's where quotas and domain assignment are enforced); the
 * manifest just points a repo at an app that already exists, by appId. So
 * this tab never creates anything — it hands back a pre-filled file to
 * commit.
 *
 * The file body comes from the API rather than being templated here, so the
 * preview is byte-for-byte what a `curl` of the same endpoint returns and
 * the two can't drift.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  FileCode, Download, Copy, Check, Loader2, AlertCircle, Terminal, GitBranch,
} from 'lucide-react';
import apiClient from '../../../services/axios-config';

interface DeployTabProps {
  vhost: any;
}

type Format = 'yaml' | 'json';

const BUILD_ENDPOINT = 'https://build.spinforge.dev/_api/customer/manifest';

export default function DeployTab({ vhost }: DeployTabProps) {
  const [format, setFormat] = useState<Format>('yaml');
  const [repoUrl, setRepoUrl] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'file' | 'command' | null>(null);

  const filename = `spinforge.${format}`;

  // Refetch when the format flips or the repo URL settles. The debounce is
  // for the URL field — one request per keystroke would be silly for a file
  // that only echoes what was typed.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = { format };
        if (repoUrl.trim()) params.repo = repoUrl.trim();
        const { data } = await apiClient.get(
          `/_api/customer/sites/${encodeURIComponent(vhost.domain)}/manifest`,
          { params, responseType: 'text', transformResponse: [(d) => d] },
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
  }, [vhost.domain, format, repoUrl]);

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

  // Apps created before manifests shipped have no appId and can't be
  // referenced from a repo until one is assigned.
  if (!vhost.appId && !loading && error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">No app ID yet</h3>
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileCode className="h-5 w-5 text-blue-600" />
          Deploy from your repository
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Commit this file to your repository root. It points your repo at this app —
          it carries no secret, so it's safe in public source control.
        </p>
      </div>

      {/* App identity */}
      <div className="rounded-2xl bg-white/70 border border-white/60 shadow-sm p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">App ID</div>
            <code className="text-sm font-mono text-gray-900 break-all">{vhost.appId || '—'}</code>
            <p className="text-xs text-gray-500 mt-1.5">
              Stable across domain changes — renaming this app won't invalidate the file.
            </p>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Serving on</div>
            <code className="text-sm font-mono text-gray-900 break-all">{vhost.domain}</code>
          </div>
        </div>
      </div>

      {/* Repo + format */}
      <div className="rounded-2xl bg-white/70 border border-white/60 shadow-sm p-5 space-y-4">
        <label className="block">
          <div className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-gray-500" /> Repository URL
          </div>
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/you/your-repo"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Optional — leave blank and edit the placeholder in the file instead.
          </p>
        </label>

        <div>
          <div className="text-sm font-medium text-gray-700 mb-1.5">Format</div>
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            {(['yaml', 'json'] as Format[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  format === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl overflow-hidden border border-gray-800 shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800">
          <span className="text-xs font-mono text-gray-300">{filename}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copy(content, 'file')}
              disabled={!content}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-200 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-40"
            >
              {copied === 'file' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'file' ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={!content}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          </div>
        </div>
        <pre className="bg-gray-900 text-gray-100 text-xs font-mono p-4 overflow-x-auto max-h-96 leading-relaxed">
          {loading
            ? <span className="text-gray-400 inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Building…</span>
            : error
              ? <span className="text-red-400">{error}</span>
              : content}
        </pre>
      </div>

      {/* CI command */}
      <div className="rounded-2xl bg-white/70 border border-white/60 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Terminal className="h-4 w-4 text-gray-500" /> Deploy on every push
          </h4>
          <button
            type="button"
            onClick={() => copy(command, 'command')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            {copied === 'command' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === 'command' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="bg-gray-900 text-gray-100 text-xs font-mono p-4 rounded-lg overflow-x-auto leading-relaxed">
          {command}
        </pre>
        <p className="text-xs text-gray-500 mt-2.5">
          <code className="bg-gray-100 px-1.5 py-0.5 rounded">$SPINFORGE_TOKEN</code> is an API
          token from Settings. Keep it in your CI secrets — never in the manifest.
        </p>
      </div>
    </div>
  );
}
