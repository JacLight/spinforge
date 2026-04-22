/**
 * Platform → Secrets
 *
 * CRUD over OpenBao's secret/platform/* namespace. Backed by
 * building-api's /api/vault/platform/* routes (see building/api/routes/vault.js).
 *
 * Mutations automatically mirror the dependent Nomad Variables
 * (nomad/jobs/api, nomad/jobs/building-api) so running tasks re-render
 * their template + restart — admin never has to redeploy jobs by hand
 * after editing AWS keys, the admin-JWT, etc.
 *
 * UX: left column lists keys under secret/platform/, right panel reads
 * the selected secret into an editable key/value grid. "Reveal" toggles
 * value masking. Add-row and delete-row support arbitrary schemas —
 * we never assume known fields.
 */

import { useEffect, useMemo, useState } from 'react';
import { buildApi, friendlyError } from '../../services/buildApi';
import { Shield, RefreshCw, Plus, Trash2, Eye, EyeOff, Save, X } from 'lucide-react';

type KV = { k: string; v: string };

export default function PlatformSecrets() {
  const [keys, setKeys] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rows, setRows] = useState<KV[]>([]);
  const [reveal, setReveal] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);

  async function loadKeys() {
    try {
      const res = await buildApi.listPlatformSecrets();
      setKeys(res.keys || []);
      setErr(null);
    } catch (e: any) {
      setErr(friendlyError(e));
    }
  }

  async function loadSecret(k: string) {
    try {
      const res = await buildApi.readPlatformSecret(k);
      const data = res.data || {};
      const newRows: KV[] = Object.entries(data).map(([k, v]) => ({
        k, v: typeof v === 'string' ? v : JSON.stringify(v),
      }));
      if (newRows.length === 0) newRows.push({ k: '', v: '' });
      setRows(newRows);
      setDirty(false);
      setErr(null);
    } catch (e: any) {
      setErr(friendlyError(e));
    }
  }

  useEffect(() => { loadKeys(); }, []);
  useEffect(() => {
    if (selectedKey) loadSecret(selectedKey);
    else { setRows([]); setDirty(false); }
  }, [selectedKey]);

  function updateRow(i: number, patch: Partial<KV>) {
    setRows((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], ...patch };
      return next;
    });
    setDirty(true);
    setMessage(null);
  }

  function addRow() {
    setRows((prev) => [...prev, { k: '', v: '' }]);
    setDirty(true);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  async function onSave() {
    if (!selectedKey) return;
    const data: Record<string, string> = {};
    for (const r of rows) {
      const k = r.k.trim();
      if (!k) continue;
      data[k] = r.v;
    }
    if (Object.keys(data).length === 0) {
      setErr('Refusing to save empty secret — delete the key instead.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const out = await buildApi.writePlatformSecret(selectedKey, data);
      setDirty(false);
      setMessage(`Saved v${out.version} of ${selectedKey}`);
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteKey(k: string) {
    if (!window.confirm(`Destroy ALL versions of secret/platform/${k}?\nThis cannot be undone.`)) return;
    try {
      await buildApi.deletePlatformSecret(k);
      if (selectedKey === k) setSelectedKey(null);
      await loadKeys();
      setMessage(`Deleted secret/platform/${k}`);
    } catch (e: any) {
      setErr(friendlyError(e));
    }
  }

  async function onCreateKey() {
    const name = newKeyName.trim();
    if (!name) return;
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      setErr('Key name must match [a-zA-Z0-9._-]+');
      return;
    }
    if ((keys || []).includes(name)) {
      setSelectedKey(name);
      setCreating(false);
      setNewKeyName('');
      return;
    }
    setCreating(false);
    setNewKeyName('');
    setSelectedKey(name);
    setRows([{ k: '', v: '' }]);
    setDirty(true);
  }

  const masked = useMemo(() => !reveal, [reveal]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield size={22} /> Platform secrets
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            OpenBao — <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">secret/platform/*</code>.
            Edits mirror to Nomad Variables and hot-reload the dependent jobs (api, building-api).
          </p>
        </div>
        <button onClick={loadKeys} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50">
          <RefreshCw size={12} /> Reload
        </button>
      </div>

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {err}
        </div>
      )}
      {message && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Left: key list */}
        <div className="col-span-4 bg-white border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Keys</span>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-white"
            >
              <Plus size={12} /> New
            </button>
          </div>
          {creating && (
            <div className="p-3 border-b bg-amber-50">
              <input
                autoFocus
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. stripe"
                className="w-full px-2 py-1 border rounded text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCreateKey();
                  if (e.key === 'Escape') { setCreating(false); setNewKeyName(''); }
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={onCreateKey}
                  className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >Create</button>
                <button
                  onClick={() => { setCreating(false); setNewKeyName(''); }}
                  className="px-2 py-1 text-xs border rounded hover:bg-white"
                >Cancel</button>
              </div>
            </div>
          )}
          {!keys ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No secrets yet.</div>
          ) : (
            <ul className="divide-y">
              {keys.map((k) => (
                <li
                  key={k}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 ${selectedKey === k ? 'bg-indigo-50' : ''}`}
                  onClick={() => setSelectedKey(k)}
                >
                  <span className="text-sm font-mono">{k}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteKey(k); }}
                    className="text-red-500 hover:text-red-700 p-1"
                    title={`Delete ${k}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: editor */}
        <div className="col-span-8 bg-white border rounded-lg overflow-hidden">
          {!selectedKey ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              Select a key, or create a new one.
            </div>
          ) : (
            <>
              <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between">
                <span className="text-sm font-medium">
                  <code className="bg-white px-1 py-0.5 rounded text-xs border">secret/platform/{selectedKey}</code>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReveal((x) => !x)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-white"
                  >
                    {reveal ? <EyeOff size={12} /> : <Eye size={12} />}
                    {reveal ? 'Hide' : 'Reveal'}
                  </button>
                  <button
                    onClick={addRow}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-white"
                  >
                    <Plus size={12} /> Add field
                  </button>
                  <button
                    onClick={onSave}
                    disabled={!dirty || saving}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save size={12} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="text-left pb-2 font-normal">Field</th>
                      <th className="text-left pb-2 font-normal">Value</th>
                      <th className="w-8 pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td className="pr-2 pb-2 align-top">
                          <input
                            value={r.k}
                            onChange={(e) => updateRow(i, { k: e.target.value })}
                            placeholder="key"
                            className="w-full px-2 py-1 border rounded font-mono text-xs"
                          />
                        </td>
                        <td className="pr-2 pb-2">
                          <input
                            type={masked ? 'password' : 'text'}
                            value={r.v}
                            onChange={(e) => updateRow(i, { v: e.target.value })}
                            placeholder="value"
                            className="w-full px-2 py-1 border rounded font-mono text-xs"
                          />
                        </td>
                        <td className="pb-2 align-top">
                          <button
                            onClick={() => removeRow(i)}
                            className="text-gray-400 hover:text-red-600"
                            title="Remove"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
