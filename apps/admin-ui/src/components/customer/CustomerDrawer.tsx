/**
 * Customer drawer — list + right-slide drawer with tabs.
 *
 * Tabs:
 *   - Overview   name, email, plan, active flag, legacy hosting limits
 *   - Policy     build/hosting/features policy (KeyDB `customer:{id}:policy`)
 *   - Secrets    Vault-backed per-customer secrets
 *   - Sites      vhosts owned by customer
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, User, Info, Shield, Globe, Server, Edit2, Save, Trash2, Calendar,
  CheckCircle, XCircle, RefreshCw, Mail, Hash, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, Customer } from '../../services/api';
import { buildApi, Policy, DEFAULT_POLICY, friendlyError } from '../../services/buildApi';
import { hostingAPI, VHost } from '../../services/hosting-api';
import { useConfirm } from '../ConfirmModal';
import { PolicyEditor } from './PolicyEditor';
import { SecretsPanel } from './SecretsPanel';

type TabId = 'overview' | 'policy' | 'secrets' | 'sites';

interface CustomerDrawerProps {
  customer: Customer | null;
  /** true when drawer is open for creating a brand-new customer */
  isNew?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'policy',   label: 'Policy',   icon: Shield },
  { id: 'secrets',  label: 'Secrets',  icon: Shield },
  { id: 'sites',    label: 'Sites',    icon: Globe },
];

export default function CustomerDrawer({ customer, isNew, isOpen, onClose, onSaved }: CustomerDrawerProps) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isEditing, setIsEditing] = useState(!!isNew);
  const [formData, setFormData] = useState(() => initFormData(customer));

  useEffect(() => {
    setFormData(initFormData(customer));
    setIsEditing(!!isNew);
    setActiveTab('overview');
  }, [customer?.id, isNew]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name,
        email: formData.email,
        limits: {
          maxSpinlets: formData.limits.maxSpinlets ? parseInt(formData.limits.maxSpinlets, 10) : undefined,
          maxMemory:   formData.limits.maxMemory || undefined,
          maxDomains:  formData.limits.maxDomains ? parseInt(formData.limits.maxDomains, 10) : undefined,
        },
      };
      if (isNew || !customer) {
        return api.createCustomer(payload) as Promise<Customer>;
      }
      return api.updateCustomer(customer.id, payload) as Promise<Customer>;
    },
    onSuccess: () => {
      toast.success(isNew ? 'Customer created' : 'Customer updated');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsEditing(false);
      onSaved?.();
      if (isNew) onClose();
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!customer) return;
      return api.deleteCustomer(customer.id);
    },
    onSuccess: () => {
      toast.success('Customer deleted');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onSaved?.();
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Delete failed');
    },
  });

  async function handleDelete() {
    if (!customer) return;
    const ok = await confirm({
      title: 'Delete customer?',
      description: 'Their sites, tokens, and session data will all be removed. This cannot be undone.',
      severity: 'danger',
      confirmLabel: 'Delete customer',
      typeToConfirm: customer.email,
    });
    if (!ok) return;
    deleteMutation.mutate();
  }

  // Only the four tabs below make sense once we have a saved customer id
  const visibleTabs = isNew ? TABS.filter((t) => t.id === 'overview') : TABS;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-5xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 shadow-2xl z-50 flex flex-col overflow-hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          >
            {/* Header */}
            <div className="relative bg-white/70 backdrop-blur-2xl border-b border-white/50 shadow-lg">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl" />
              </div>

              <div className="relative px-8 py-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                        {isNew ? 'New customer' : (customer?.name || 'Customer')}
                      </h2>
                      {!isNew && customer && (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                          customer.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            customer.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                          }`} />
                          {customer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </div>
                    {!isNew && customer && (
                      <div className="flex items-center gap-4 text-sm text-gray-600 ml-[3.25rem]">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" /> {customer.email}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Hash className="h-3 w-3" /> {customer.id}
                        </span>
                        {customer.createdAt && (
                          <span className="flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            {new Date(customer.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => {
                            if (isNew) { onClose(); return; }
                            setFormData(initFormData(customer));
                            setIsEditing(false);
                          }}
                          className="px-4 py-2 bg-white/80 backdrop-blur-xl border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition shadow flex items-center gap-2 text-sm font-medium"
                        >
                          <X className="h-4 w-4" /> Cancel
                        </button>
                        <button
                          onClick={() => saveMutation.mutate()}
                          disabled={saveMutation.isPending || !formData.name || !formData.email}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 transition shadow flex items-center gap-2 text-sm font-medium"
                        >
                          <Save className="h-4 w-4" />
                          {saveMutation.isPending ? 'Saving…' : isNew ? 'Create customer' : 'Save changes'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition shadow flex items-center gap-2 text-sm font-medium"
                        >
                          <Edit2 className="h-4 w-4" /> Edit
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleteMutation.isPending}
                          className="px-4 py-2 bg-white/80 backdrop-blur-xl border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition shadow flex items-center gap-2 text-sm font-medium"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </>
                    )}

                    <div className="w-px h-8 bg-gray-300 mx-1" />

                    <button
                      onClick={onClose}
                      className="p-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow"
                    >
                      <X className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {visibleTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition flex items-center gap-2 ${
                          active
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                            : 'bg-white/60 hover:bg-white/80 text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-8 py-8 pb-24">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'overview' && (
                      <OverviewTab
                        customer={customer}
                        isNew={!!isNew}
                        isEditing={isEditing}
                        formData={formData}
                        setFormData={setFormData}
                      />
                    )}
                    {activeTab === 'policy' && customer && (
                      <PolicyTab customerId={customer.id} />
                    )}
                    {activeTab === 'secrets' && customer && (
                      <SecretsPanel customerId={customer.id} />
                    )}
                    {activeTab === 'sites' && customer && (
                      <SitesTab customerId={customer.id} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Overview tab ──────────────────────────────────────────────────────

interface FormData {
  name: string;
  email: string;
  limits: { maxSpinlets: string; maxMemory: string; maxDomains: string };
}
function initFormData(customer: Customer | null): FormData {
  return {
    name: customer?.name || '',
    email: customer?.email || '',
    limits: {
      maxSpinlets: customer?.limits?.maxSpinlets?.toString() || '',
      maxMemory:   customer?.limits?.maxMemory || '',
      maxDomains:  customer?.limits?.maxDomains?.toString() || '',
    },
  };
}

function OverviewTab({ customer, isNew, isEditing, formData, setFormData }: {
  customer: Customer | null;
  isNew: boolean;
  isEditing: boolean;
  formData: FormData;
  setFormData: (u: FormData | ((p: FormData) => FormData)) => void;
}) {
  return (
    <div className="space-y-4 max-w-3xl">
      <Card title="Identity">
        <Field label="Name">
          {isEditing ? (
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus={isNew}
            />
          ) : (
            <div className="text-sm text-gray-900">{customer?.name || '—'}</div>
          )}
        </Field>
        <Field label="Email">
          {isEditing ? (
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={!isNew}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            />
          ) : (
            <div className="text-sm text-gray-900">{customer?.email || '—'}</div>
          )}
        </Field>
        {!isNew && customer && (
          <Field label="Customer ID">
            <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">{customer.id}</code>
          </Field>
        )}
      </Card>

      <Card title="Legacy hosting limits" subtitle="Older per-customer caps. Prefer Policy tab for new limits.">
        <Field label="Max spinlets">
          {isEditing ? (
            <input
              type="number"
              min={0}
              value={formData.limits.maxSpinlets}
              onChange={(e) => setFormData({
                ...formData,
                limits: { ...formData.limits, maxSpinlets: e.target.value },
              })}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          ) : (
            <div className="text-sm text-gray-900">{customer?.limits?.maxSpinlets ?? '—'}</div>
          )}
        </Field>
        <Field label="Max memory">
          {isEditing ? (
            <input
              type="text"
              placeholder="e.g. 4GB"
              value={formData.limits.maxMemory}
              onChange={(e) => setFormData({
                ...formData,
                limits: { ...formData.limits, maxMemory: e.target.value },
              })}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          ) : (
            <div className="text-sm text-gray-900">{customer?.limits?.maxMemory ?? '—'}</div>
          )}
        </Field>
        <Field label="Max domains">
          {isEditing ? (
            <input
              type="number"
              min={0}
              value={formData.limits.maxDomains}
              onChange={(e) => setFormData({
                ...formData,
                limits: { ...formData.limits, maxDomains: e.target.value },
              })}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          ) : (
            <div className="text-sm text-gray-900">{customer?.limits?.maxDomains ?? '—'}</div>
          )}
        </Field>
      </Card>

      {isNew && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800">
          After creating the customer, the <strong>Policy</strong>, <strong>Secrets</strong>, and{' '}
          <strong>Sites</strong> tabs will become available. A default build/hosting/features policy
          is seeded automatically on first policy-tab visit.
        </div>
      )}
    </div>
  );
}

// ─── Policy tab ────────────────────────────────────────────────────────

function PolicyTab({ customerId }: { customerId: string }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const p = await buildApi.getPolicy(customerId);
      setPolicy(p);
      setErr(null);
    } catch (e: any) {
      // 404 → no policy row yet; seed with DEFAULT_POLICY so the editor
      // has something to work against. Save will create the row.
      if (e?.response?.status === 404) {
        setPolicy(DEFAULT_POLICY);
        setErr(null);
      } else {
        setErr(friendlyError(e));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [customerId]);

  if (loading) return <div className="text-sm text-gray-400">Loading policy…</div>;
  if (err) return <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>;
  if (!policy) return null;

  return (
    <div className="max-w-4xl">
      <PolicyEditor
        key={customerId}
        customerId={customerId}
        initialPolicy={policy}
        onSaved={load}
      />
    </div>
  );
}

// ─── Sites tab ─────────────────────────────────────────────────────────

function SitesTab({ customerId }: { customerId: string }) {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['customer-sites', customerId],
    queryFn: () => hostingAPI.listVHosts({ customer: customerId }),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm max-w-4xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-sm text-gray-900 inline-flex items-center gap-2">
          <Globe size={14} /> Sites owned by this customer
        </h3>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
        >
          <RefreshCw size={12} className={isRefetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
      ) : error ? (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {(error as any)?.message || 'Failed to load sites'}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">
          No sites owned by this customer yet.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {data.map((vhost: VHost) => (
            <li key={vhost.domain} className="px-5 py-3 hover:bg-gray-50 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm text-gray-900 truncate">{vhost.domain}</span>
                  <a
                    href={`http://${vhost.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-600"
                    title="Open site"
                  >
                    <ExternalLink size={12} />
                  </a>
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
                    vhost.enabled !== false
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {vhost.enabled !== false ? <CheckCircle size={10} /> : <XCircle size={10} />}
                    {vhost.enabled !== false ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <Server size={10} /> {vhost.type}
                  </span>
                  {vhost.target && <span className="truncate">→ {vhost.target}</span>}
                </div>
              </div>
              <a
                href={`/applications/${encodeURIComponent(vhost.domain)}`}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 font-medium"
              >
                Open
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Little building blocks ───────────────────────────────────────────

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 items-center">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="col-span-2">{children}</div>
    </div>
  );
}
