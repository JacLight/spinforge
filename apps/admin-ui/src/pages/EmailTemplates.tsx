/**
 * SpinForge - Email Templates admin page
 * Copyright (c) 2025 Jacob Ajiboye
 * Licensed under the MIT License
 *
 * Lists the transactional email templates seeded by the api. Operators
 * can edit subject/HTML/text, flip enabled on/off, fire a test render
 * against a recipient, and scan the recent send log. New templates can
 * only be added by editing services/email-templates.default.js + the
 * EVENTS list in NotificationService — not from the UI, because every
 * event also needs a code-side trigger.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Save, Send, AlertTriangle, Check, X, Power, Eye, RefreshCw, ChevronRight,
} from 'lucide-react';
import {
  api, EmailTemplate, EmailLogEntry, MailerStatus,
} from '../services/api';

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [mailer, setMailer] = useState<MailerStatus | null>(null);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [testModal, setTestModal] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testCtx, setTestCtx] = useState('{\n  "name": "Demo User",\n  "domain": "example.spinforge.dev"\n}');
  const [testing, setTesting] = useState(false);

  const [log, setLog] = useState<EmailLogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);

  async function load() {
    try {
      const { templates, mailer } = await api.listEmailTemplates();
      setTemplates(templates);
      setMailer(mailer);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to load');
    }
  }

  useEffect(() => { load(); }, []);

  function select(t: EmailTemplate) {
    setSelected({ ...t });
    setDirty(false);
    setErr(null); setInfo(null);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setErr(null);
    try {
      const updated = await api.updateEmailTemplate(selected.event, {
        subject: selected.subject,
        html:    selected.html,
        text:    selected.text || undefined,
        enabled: selected.enabled,
      });
      setSelected(updated);
      setDirty(false);
      setInfo('Saved.');
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!selected) return;
    let ctx: Record<string, any> = {};
    try {
      ctx = testCtx.trim() ? JSON.parse(testCtx) : {};
    } catch {
      setErr('Context must be valid JSON');
      return;
    }
    setTesting(true);
    setErr(null);
    try {
      const r = await api.sendTestEmail(selected.event, testTo, ctx);
      setInfo(`Test sent. SES MessageId: ${r.messageId}`);
      setTestModal(false);
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Send failed');
    } finally {
      setTesting(false);
    }
  }

  async function openLog() {
    setShowLog(true);
    try {
      const { entries } = await api.recentEmailLog(100);
      setLog(entries);
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Log fetch failed');
    }
  }

  const mailerReady = mailer?.hasRegion && mailer?.hasCredentials;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail size={22}/> Email Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Transactional notifications sent by SpinForge. New events require a code-side hook.
          </p>
        </div>
        <button
          onClick={openLog}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
        >
          <Eye size={14}/> Recent sends
        </button>
      </div>

      {mailer && (
        <div className={`mb-4 p-3 rounded flex items-start gap-2 text-sm ${mailerReady ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
          {mailerReady ? <Check size={16} className="mt-0.5"/> : <AlertTriangle size={16} className="mt-0.5"/>}
          <div>
            <div>
              <b>Mailer:</b> region <code>{mailer.region}</code>, from <code>{mailer.from}</code>
            </div>
            {!mailerReady && (
              <div>
                AWS credentials are not configured. Set <code>AWS_ACCESS_KEY_ID</code> and <code>AWS_SECRET_ACCESS_KEY</code> in <code>.env</code> and restart the api container.
              </div>
            )}
          </div>
        </div>
      )}

      {err  && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2"><AlertTriangle size={16}/>{err}</div>}
      {info && <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700 flex items-center gap-2"><Check size={16}/>{info}</div>}

      <div className="grid grid-cols-12 gap-4">
        {/* Left: list */}
        <div className="col-span-4 bg-white border rounded overflow-hidden">
          {templates.map((t) => (
            <button
              key={t.event}
              onClick={() => select(t)}
              className={`w-full flex items-center justify-between p-3 text-left border-b hover:bg-gray-50 ${selected?.event === t.event ? 'bg-blue-50' : ''}`}
            >
              <div>
                <div className="font-medium text-sm">{t.event}</div>
                <div className="text-xs text-gray-500 truncate max-w-[22rem]">{t.subject}</div>
              </div>
              <div className="flex items-center gap-2">
                {t.enabled
                  ? <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">on</span>
                  : <span className="text-xs text-gray-600 bg-gray-200 px-2 py-0.5 rounded">off</span>}
                <ChevronRight size={14} className="text-gray-400"/>
              </div>
            </button>
          ))}
          {templates.length === 0 && (
            <div className="p-4 text-sm text-gray-400">No templates seeded yet.</div>
          )}
        </div>

        {/* Right: editor */}
        <div className="col-span-8 bg-white border rounded p-4">
          {!selected ? (
            <div className="text-sm text-gray-400">Select a template to edit.</div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-sm">{selected.event}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setSelected({ ...selected, enabled: !selected.enabled }); setDirty(true); }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50"
                    title={selected.enabled ? 'Disable' : 'Enable'}
                  >
                    <Power size={12}/> {selected.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => setTestModal(true)}
                    disabled={!mailerReady}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
                    title={mailerReady ? 'Send test' : 'Mailer not configured'}
                  >
                    <Send size={12}/> Send test
                  </button>
                  <button
                    onClick={save}
                    disabled={!dirty || saving}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                  >
                    <Save size={12}/> {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              <label className="block mb-3">
                <div className="text-xs text-gray-600 mb-1">Subject</div>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={selected.subject}
                  onChange={(e) => { setSelected({ ...selected, subject: e.target.value }); setDirty(true); }}
                />
              </label>

              <label className="block mb-3">
                <div className="text-xs text-gray-600 mb-1">HTML body</div>
                <textarea
                  className="w-full border rounded px-3 py-2 font-mono text-xs"
                  rows={14}
                  value={selected.html}
                  onChange={(e) => { setSelected({ ...selected, html: e.target.value }); setDirty(true); }}
                />
              </label>

              <label className="block mb-3">
                <div className="text-xs text-gray-600 mb-1">Plain text (optional)</div>
                <textarea
                  className="w-full border rounded px-3 py-2 font-mono text-xs"
                  rows={4}
                  value={selected.text || ''}
                  onChange={(e) => { setSelected({ ...selected, text: e.target.value }); setDirty(true); }}
                />
              </label>

              {selected.variables && selected.variables.length > 0 && (
                <div className="text-xs text-gray-500">
                  <div className="font-medium mb-1">Available variables</div>
                  <div className="flex flex-wrap gap-1">
                    {selected.variables.map((v) => (
                      <code key={v} className="bg-gray-100 px-2 py-0.5 rounded">{`{{${v}}}`}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Send test modal */}
      <AnimatePresence>
        {testModal && selected && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Send test — {selected.event}</h2>
                <button onClick={() => setTestModal(false)}><X size={18}/></button>
              </div>
              <label className="block mb-3">
                <div className="text-xs text-gray-600 mb-1">To address</div>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="you@example.com"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
              </label>
              <label className="block mb-3">
                <div className="text-xs text-gray-600 mb-1">Context (JSON)</div>
                <textarea
                  className="w-full border rounded px-3 py-2 font-mono text-xs"
                  rows={8}
                  value={testCtx}
                  onChange={(e) => setTestCtx(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button onClick={() => setTestModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button
                  onClick={sendTest}
                  disabled={!testTo || testing}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                >{testing ? 'Sending…' : 'Send'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent sends drawer */}
      <AnimatePresence>
        {showLog && (
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowLog(false)}
          >
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-[520px] bg-white shadow-xl p-4 overflow-auto"
              initial={{ x: 560 }} animate={{ x: 0 }} exit={{ x: 560 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Recent sends</h2>
                <div className="flex items-center gap-2">
                  <button onClick={openLog} title="Refresh" className="p-1"><RefreshCw size={14}/></button>
                  <button onClick={() => setShowLog(false)}><X size={16}/></button>
                </div>
              </div>
              {log.length === 0 && <div className="text-sm text-gray-400">No sends yet.</div>}
              <div className="space-y-2">
                {log.map((e, i) => (
                  <div key={i} className="border rounded p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{e.event}</span>
                      <span className={`px-2 py-0.5 rounded ${e.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {e.status}
                      </span>
                    </div>
                    <div className="mt-1 text-gray-600">{e.subject}</div>
                    <div className="mt-1 text-gray-500">to {e.to}</div>
                    <div className="mt-1 text-gray-400">{e.sentAt || e.failedAt || e.queuedAt}</div>
                    {e.error && <div className="mt-1 text-red-600 break-words">{e.error}</div>}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
