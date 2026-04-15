/**
 * SpinForge - Partners admin page
 * Copyright (c) 2025 Jacob Ajiboye
 * Licensed under the MIT License
 *
 * SpinForge operators use this screen to register third-party partners
 * (resellers, SaaS platforms like appmint) so their customers can deploy
 * sites through a white-labelled integration. Partner records hold the
 * URL we'll call back into to validate each of their customer tokens,
 * plus an sfpk_ API key that identifies the partner to us.
 *
 * Note: the plaintext sfpk_ key is only ever returned by POST and
 * /rotate-key — we store a SHA-256 hash server-side. The modal below
 * flashes the key once, after that it's gone.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, RefreshCw, Check, Copy, X, AlertTriangle,
  Link as LinkIcon, Eye, EyeOff, Power,
} from 'lucide-react';
import { api, Partner, PartnerInput } from '../services/api';

type FormState = PartnerInput & { headersRaw: string };

const BLANK: FormState = {
  name: '',
  validationUrl: '',
  validationMethod: 'POST',
  validationHeaders: {},
  tokenTtlSeconds: 3600,
  enabled: true,
  headersRaw: '',
};

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Modal state: create / edit / freshly rotated key reveal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);

  const [revealKey, setRevealKey] = useState<{ name: string; apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const { partners } = await api.listPartners();
      setPartners(partners || []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(BLANK);
    setShowForm(true);
  }

  function openEdit(p: Partner) {
    setEditing(p);
    setForm({
      name: p.name,
      validationUrl: p.validationUrl,
      validationMethod: p.validationMethod || 'POST',
      validationHeaders: p.validationHeaders || {},
      tokenTtlSeconds: p.tokenTtlSeconds,
      enabled: p.enabled,
      headersRaw: p.validationHeaders ? JSON.stringify(p.validationHeaders, null, 2) : '',
    });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      // Parse the headers textarea as JSON if non-empty. Bad JSON aborts save.
      let headers: Record<string, string> = {};
      if (form.headersRaw && form.headersRaw.trim()) {
        try {
          headers = JSON.parse(form.headersRaw);
        } catch {
          setErr('Static headers must be valid JSON (or leave blank)');
          setSaving(false);
          return;
        }
      }

      const payload: PartnerInput = {
        name: form.name.trim(),
        validationUrl: form.validationUrl.trim(),
        validationMethod: form.validationMethod,
        validationHeaders: headers,
        tokenTtlSeconds: Number(form.tokenTtlSeconds) || 3600,
        enabled: form.enabled !== false,
      };

      if (editing) {
        await api.updatePartner(editing.id, payload);
      } else {
        const created = await api.createPartner(payload);
        if (created.apiKey) {
          setRevealKey({ name: created.name, apiKey: created.apiKey });
        }
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function del(p: Partner) {
    if (!window.confirm(`Delete partner "${p.name}"? Existing sfpk_ key becomes invalid.`)) return;
    try {
      await api.deletePartner(p.id);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Delete failed');
    }
  }

  async function rotate(p: Partner) {
    if (!window.confirm(`Rotate ${p.name}'s API key? The old sfpk_ key stops working immediately.`)) return;
    try {
      const rotated = await api.rotatePartnerKey(p.id);
      if (rotated.apiKey) setRevealKey({ name: rotated.name, apiKey: rotated.apiKey });
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Rotate failed');
    }
  }

  async function toggle(p: Partner) {
    try {
      await api.updatePartner(p.id, { enabled: !p.enabled });
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Toggle failed');
    }
  }

  function copyKey() {
    if (!revealKey) return;
    navigator.clipboard.writeText(revealKey.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Partners</h1>
          <p className="text-sm text-gray-500 mt-1">
            Third-party integrations that provision hosting for their own customers via <code>/_partners/auth</code>.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus size={16} /> Add partner
        </button>
      </div>

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5" /> {err}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Validation URL</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2">TTL</th>
              <th className="px-4 py-2">Uses</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 w-1"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!loading && partners.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                No partners registered. Click <b>Add partner</b> to create one.
              </td></tr>
            )}
            {partners.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.id}</div>
                </td>
                <td className="px-4 py-2 text-gray-700 flex items-center gap-1 max-w-md truncate">
                  <LinkIcon size={12} />{p.validationUrl}
                </td>
                <td className="px-4 py-2">{p.validationMethod}</td>
                <td className="px-4 py-2">{p.tokenTtlSeconds}s</td>
                <td className="px-4 py-2">{p.useCount || 0}</td>
                <td className="px-4 py-2">
                  {p.enabled ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                      <Check size={12} /> active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                      <X size={12} /> disabled
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <button onClick={() => toggle(p)} title={p.enabled ? 'Disable' : 'Enable'}
                    className="p-1 text-gray-500 hover:text-gray-900"><Power size={16} /></button>
                  <button onClick={() => openEdit(p)} title="Edit"
                    className="p-1 text-gray-500 hover:text-gray-900"><Edit2 size={16} /></button>
                  <button onClick={() => rotate(p)} title="Rotate sfpk_ key"
                    className="p-1 text-gray-500 hover:text-orange-600"><RefreshCw size={16} /></button>
                  <button onClick={() => del(p)} title="Delete"
                    className="p-1 text-gray-500 hover:text-red-600"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/edit modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {editing ? `Edit ${editing.name}` : 'Add partner'}
                </h2>
                <button onClick={() => setShowForm(false)}><X size={18} /></button>
              </div>

              <div className="space-y-3 text-sm">
                <label className="block">
                  <div className="text-gray-600 mb-1">Name</div>
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="appmint"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    disabled={!!editing}
                  />
                </label>

                <label className="block">
                  <div className="text-gray-600 mb-1">Validation URL</div>
                  <input
                    className="w-full border rounded px-3 py-2 font-mono text-xs"
                    placeholder="https://api.partner.com/auth/spinforge-verify"
                    value={form.validationUrl}
                    onChange={(e) => setForm({ ...form, validationUrl: e.target.value })}
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    We call this URL with <code>Authorization: Bearer &lt;customer's token&gt;</code>.
                    Partner returns <code>{`{customerId, email, name}`}</code> to allow.
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-gray-600 mb-1">Method</div>
                    <select
                      className="w-full border rounded px-3 py-2"
                      value={form.validationMethod}
                      onChange={(e) => setForm({ ...form, validationMethod: e.target.value as any })}
                    >
                      <option>GET</option>
                      <option>POST</option>
                      <option>PUT</option>
                      <option>PATCH</option>
                    </select>
                  </label>
                  <label className="block">
                    <div className="text-gray-600 mb-1">Token TTL (seconds)</div>
                    <input
                      type="number" min={60} max={86400}
                      className="w-full border rounded px-3 py-2"
                      value={form.tokenTtlSeconds}
                      onChange={(e) => setForm({ ...form, tokenTtlSeconds: Number(e.target.value) })}
                    />
                  </label>
                </div>

                <label className="block">
                  <div className="text-gray-600 mb-1">Static headers (JSON, optional)</div>
                  <textarea
                    rows={4}
                    className="w-full border rounded px-3 py-2 font-mono text-xs"
                    placeholder={'{\n  "X-Shared-Secret": "..."\n}'}
                    value={form.headersRaw}
                    onChange={(e) => setForm({ ...form, headersRaw: e.target.value })}
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    Dynamic per-customer headers (e.g. <code>orgid</code>) go in the auth request body, not here.
                  </div>
                </label>

                {editing && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.enabled !== false}
                      onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >Cancel</button>
                <button
                  onClick={save}
                  disabled={saving || !form.name || !form.validationUrl}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                >{saving ? 'Saving…' : editing ? 'Save' : 'Create'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* One-time key reveal */}
      <AnimatePresence>
        {revealKey && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <Eye size={18} className="text-orange-500" />
                <h2 className="text-lg font-semibold">Save this API key now</h2>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                This is <b>{revealKey.name}</b>'s partner key. It will <b>not</b> be shown again — we
                only keep a hash server-side. Send it privately to the partner.
              </p>
              <div className="flex items-center gap-2 p-3 bg-gray-100 rounded font-mono text-xs break-all">
                <code className="flex-1">{revealKey.apiKey}</code>
                <button
                  onClick={copyKey}
                  className="p-2 rounded hover:bg-gray-200"
                  title="Copy"
                >
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                </button>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setRevealKey(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >I've saved it</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
