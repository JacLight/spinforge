/**
 * Shared Vault-backed customer secrets panel.
 *
 * Used by Customer drawer (admin) Secrets tab. The bootstrap step mints a
 * periodic Vault token scoped to secret/customer/{id}/* so the customer's
 * containers can read their secrets without admin privileges.
 */
import React, { useEffect, useState } from 'react';
import {
  Shield, Plus, X, Save, KeyRound, Copy, Eye, EyeOff,
  RefreshCw, Trash2,
} from 'lucide-react';
import { buildApi, friendlyError } from '../../services/buildApi';
import { useConfirm } from '../ConfirmModal';
import { toast } from 'sonner';

export function SecretsPanel({ customerId }: { customerId: string }) {
  const confirm = useConfirm();
  const [keys, setKeys] = useState<string[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenMeta, setTokenMeta] = useState<{ accessor?: string; policyName?: string } | null>(null);
  const [revealToken, setRevealToken] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rows, setRows] = useState<{ k: string; v: string }[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [reveal, setReveal] = useState(false);

  async function loadKeys() {
    try {
      const res = await buildApi.listCustomerSecrets(customerId);
      setKeys(res.keys || []);
    } catch (e: any) { toast.error(friendlyError(e)); }
  }
  async function loadToken() {
    try {
      const res = await buildApi.getCustomerVaultToken(customerId);
      setToken(res.token);
      setTokenMeta({ accessor: res.accessor, policyName: res.policyName });
    } catch (e: any) {
      if (e?.response?.status !== 404) toast.error(friendlyError(e));
    }
  }
  async function loadSecret(key: string) {
    try {
      const res = await buildApi.readCustomerSecret(customerId, key);
      const data = res.data || {};
      const newRows = Object.entries(data).map(([k, v]) => ({
        k, v: typeof v === 'string' ? v : JSON.stringify(v),
      }));
      if (newRows.length === 0) newRows.push({ k: '', v: '' });
      setRows(newRows);
      setDirty(false);
    } catch (e: any) { toast.error(friendlyError(e)); }
  }
  useEffect(() => {
    loadKeys();
    loadToken();
    setSelectedKey(null);
    setToken(null);
    setTokenMeta(null);
  }, [customerId]);
  useEffect(() => {
    if (selectedKey) loadSecret(selectedKey);
    else { setRows([]); setDirty(false); }
  }, [selectedKey]);

  async function onBootstrap(rotate = false) {
    try {
      const res = await buildApi.bootstrapCustomerVault(customerId, rotate);
      setToken(res.token);
      setTokenMeta({ accessor: res.accessor, policyName: res.policyName });
      toast.success(res.reused ? 'Loaded cached customer token' : rotate ? 'Rotated customer token' : 'Minted customer token');
    } catch (e: any) { toast.error(friendlyError(e)); }
  }
  function onCopyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => toast.success('Token copied to clipboard'));
  }
  async function onSave() {
    if (!selectedKey) return;
    const data: Record<string, string> = {};
    for (const r of rows) {
      const k = r.k.trim();
      if (!k) continue;
      data[k] = r.v;
    }
    if (Object.keys(data).length === 0) { toast.error('Refusing to save empty secret'); return; }
    setSaving(true);
    try {
      const out = await buildApi.writeCustomerSecret(customerId, selectedKey, data);
      setDirty(false);
      toast.success(`Saved v${out.version} of ${selectedKey}`);
      await loadKeys();
    } catch (e: any) { toast.error(friendlyError(e)); }
    finally { setSaving(false); }
  }
  async function onDeleteKey(k: string) {
    const ok = await confirm({
      title: 'Destroy secret?',
      description: `Permanently destroys all versions of secret/customer/${customerId}/${k}. This cannot be undone.`,
      severity: 'danger',
      confirmLabel: 'Destroy secret',
      typeToConfirm: k,
    });
    if (!ok) return;
    try {
      await buildApi.deleteCustomerSecret(customerId, k);
      if (selectedKey === k) setSelectedKey(null);
      await loadKeys();
      toast.success(`Deleted ${k}`);
    } catch (e: any) { toast.error(friendlyError(e)); }
  }
  function onCreateKey() {
    const name = newKeyName.trim();
    if (!name) return;
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) { toast.error('Key name must match [a-zA-Z0-9._-]+'); return; }
    setCreating(false); setNewKeyName('');
    setSelectedKey(name);
    setRows([{ k: '', v: '' }]);
    setDirty(true);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-sm text-gray-900 inline-flex items-center gap-2">
          <Shield size={14} /> Secrets · <span className="font-mono text-indigo-600">{customerId}</span>
        </h3>
      </div>

      {/* Token card */}
      <div className="m-4 p-4 border border-gray-200 rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50/30">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-gray-700 inline-flex items-center gap-1.5">
            <KeyRound size={12} /> Vault token (deployed to this customer's containers)
          </div>
          <div className="flex items-center gap-1.5">
            {token && (
              <>
                <button
                  onClick={() => setRevealToken((x) => !x)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-white font-medium"
                >{revealToken ? <EyeOff size={12} /> : <Eye size={12} />}{revealToken ? 'Hide' : 'Reveal'}</button>
                <button
                  onClick={onCopyToken}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-white font-medium"
                ><Copy size={12} /> Copy</button>
                <button
                  onClick={() => onBootstrap(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-white font-medium"
                ><RefreshCw size={12} /> Rotate</button>
              </>
            )}
            {!token && (
              <button
                onClick={() => onBootstrap(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
              ><KeyRound size={12} /> Bootstrap</button>
            )}
          </div>
        </div>
        {token ? (
          <div className="space-y-1">
            <code className="block bg-white border border-gray-200 rounded-md px-2 py-1.5 text-[11px] font-mono break-all">
              {revealToken ? token : token.replace(/./g, '•')}
            </code>
            {tokenMeta && (
              <div className="text-[11px] text-gray-500">
                policy: <code className="text-gray-700">{tokenMeta.policyName}</code> · accessor: <code className="text-gray-700">{tokenMeta.accessor}</code>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-600">
            No token yet. Click Bootstrap to mint a periodic (168h, renewable) token scoped to
            {' '}<code className="text-gray-700">secret/customer/{customerId}/*</code>.
          </div>
        )}
      </div>

      {/* Secrets editor */}
      <div className="grid grid-cols-12 gap-0 border-t border-gray-100">
        <div className="col-span-5 border-r border-gray-100">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Keys ({keys?.length ?? 0})</span>
            <div className="flex items-center gap-1">
              <button
                onClick={loadKeys}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-white"
              ><RefreshCw size={10} /></button>
              <button
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-white font-medium"
              ><Plus size={10} /> New</button>
            </div>
          </div>
          {creating && (
            <div className="p-2 border-b border-amber-200 bg-amber-50">
              <input
                autoFocus
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. db-credentials"
                className="w-full px-2 py-1 border border-amber-300 rounded-md text-xs focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCreateKey();
                  if (e.key === 'Escape') { setCreating(false); setNewKeyName(''); }
                }}
              />
            </div>
          )}
          {!keys ? (
            <div className="p-4 text-center text-xs text-gray-400">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">No secrets yet.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {keys.map((k) => (
                <li
                  key={k}
                  onClick={() => setSelectedKey(k)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 ${selectedKey === k ? 'bg-indigo-50' : ''}`}
                >
                  <span className="text-xs font-mono text-gray-800">{k}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteKey(k); }}
                    className="text-red-500 hover:text-red-700 p-1"
                  ><Trash2 size={12} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-span-7">
          {!selectedKey ? (
            <div className="p-6 text-center text-xs text-gray-400">
              {keys && keys.length > 0 ? 'Select a key to edit.' : 'Create a key to get started.'}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-medium">
                  <code className="bg-white px-1.5 py-0.5 rounded-md text-[10px] border border-gray-200">
                    secret/customer/{customerId}/{selectedKey}
                  </code>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setReveal((x) => !x)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-white"
                  >{reveal ? <EyeOff size={10} /> : <Eye size={10} />}{reveal ? 'Hide' : 'Reveal'}</button>
                  <button
                    onClick={() => { setRows((r) => [...r, { k: '', v: '' }]); setDirty(true); }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-white font-medium"
                  ><Plus size={10} /> Field</button>
                  <button
                    onClick={onSave}
                    disabled={!dirty || saving}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium"
                  ><Save size={10} /> {saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
              <div className="p-3">
                <table className="w-full text-xs">
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td className="pr-2 pb-2 w-1/3 align-top">
                          <input
                            value={r.k}
                            onChange={(e) => {
                              const next = rows.slice(); next[i] = { ...next[i], k: e.target.value };
                              setRows(next); setDirty(true);
                            }}
                            placeholder="field"
                            className="w-full px-2 py-1 border border-gray-200 rounded-md font-mono text-[11px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </td>
                        <td className="pr-2 pb-2">
                          <input
                            type={reveal ? 'text' : 'password'}
                            value={r.v}
                            onChange={(e) => {
                              const next = rows.slice(); next[i] = { ...next[i], v: e.target.value };
                              setRows(next); setDirty(true);
                            }}
                            placeholder="value"
                            className="w-full px-2 py-1 border border-gray-200 rounded-md font-mono text-[11px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </td>
                        <td className="pb-2 w-6 align-top">
                          <button
                            onClick={() => { setRows(rows.filter((_, idx) => idx !== i)); setDirty(true); }}
                            className="text-gray-400 hover:text-red-600"
                          ><X size={12} /></button>
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
