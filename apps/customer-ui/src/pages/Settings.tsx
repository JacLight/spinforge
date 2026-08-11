/**
 * Customer Settings — account, API tokens, plan & limits.
 *
 * Talks only to /_api/customer/* endpoints. The admin Settings page
 * (identity, notifications, backup, system tokens) is operator-only
 * and lives in admin-ui.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  KeyRound,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  Eye,
  EyeOff,
  User as UserIcon,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { customerApi, CustomerToken } from "../services/customerApi";
import { useConfirm } from "../components/ConfirmModal";

export default function Settings() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account, API tokens, and view your plan limits.
        </p>
      </header>

      <AccountSection />
      <PasswordSection />
      <TokensSection />
      <PolicySection />
    </div>
  );
}

// ---------- Account ----------------------------------------------------

function AccountSection() {
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["customer", "profile"],
    queryFn: customerApi.getProfile,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (profile.data?.user) {
      setName(profile.data.user.name || "");
      setEmail(profile.data.user.email || "");
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => customerApi.updateProfile({ name, email }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["customer", "profile"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update profile"),
  });

  const dirty =
    profile.data?.user &&
    (name !== (profile.data.user.name || "") ||
      email !== (profile.data.user.email || ""));

  return (
    <Section icon={<UserIcon className="h-4 w-4" />} title="Account">
      {profile.isLoading ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <button
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ---------- Password ---------------------------------------------------

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const change = useMutation({
    mutationFn: () => customerApi.changePassword(current, next),
    onSuccess: () => {
      toast.success("Password changed");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to change password"),
  });

  const valid = current.length > 0 && next.length >= 8 && next === confirm;

  return (
    <Section icon={<Lock className="h-4 w-4" />} title="Password">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Current">
          <PasswordInput
            value={current}
            onChange={setCurrent}
            show={show}
            onToggleShow={() => setShow((v) => !v)}
          />
        </Field>
        <Field label="New (≥ 8 chars)">
          <PasswordInput
            value={next}
            onChange={setNext}
            show={show}
            onToggleShow={() => setShow((v) => !v)}
          />
        </Field>
        <Field label="Confirm new">
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            show={show}
            onToggleShow={() => setShow((v) => !v)}
          />
        </Field>
        <div className="md:col-span-3 flex justify-end">
          <button
            disabled={!valid || change.isPending}
            onClick={() => change.mutate()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2"
          >
            {change.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Change password
          </button>
        </div>
      </div>
    </Section>
  );
}

function PasswordInput({
  value,
  onChange,
  show,
  onToggleShow,
}: {
  value: string;
  onChange: (s: string) => void;
  show: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        onClick={onToggleShow}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ---------- Tokens -----------------------------------------------------

function TokensSection() {
  const qc = useQueryClient();
  const confirmModal = useConfirm();
  const tokens = useQuery({
    queryKey: ["customer", "tokens"],
    queryFn: customerApi.listTokens,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState<number | "">("");
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      customerApi.createToken(
        name.trim(),
        typeof days === "number" ? days : undefined
      ),
    onSuccess: (data) => {
      setIssued(data.token);
      setName("");
      setDays("");
      qc.invalidateQueries({ queryKey: ["customer", "tokens"] });
      toast.success("Token created — copy it now, it won't be shown again");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to create token"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => customerApi.deleteToken(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", "tokens"] });
      toast.success("Token revoked");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to revoke token"),
  });

  async function onRevoke(t: CustomerToken) {
    const ok = await confirmModal({
      title: "Revoke API token?",
      description: `"${t.name}" will stop working immediately.`,
      confirmLabel: "Revoke",
      severity: "danger",
    });
    if (ok) revoke.mutate(t.id);
  }

  function onCopy() {
    if (!issued) return;
    navigator.clipboard.writeText(issued).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Section
      icon={<KeyRound className="h-4 w-4" />}
      title="API tokens"
      action={
        <button
          onClick={() => {
            setShowCreate((v) => !v);
            setIssued(null);
          }}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          New token
        </button>
      }
    >
      {showCreate && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
          {issued ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                Copy this token now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono break-all">
                  {issued}
                </code>
                <button
                  onClick={onCopy}
                  className="px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={() => {
                  setIssued(null);
                  setShowCreate(false);
                }}
                className="text-xs text-gray-600 hover:text-gray-800 underline"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ci-build, laptop, etc."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="Expires in (days, optional)">
                <input
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDays(v === "" ? "" : Math.max(1, parseInt(v, 10) || 0));
                  }}
                  placeholder="never"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <div className="flex items-end">
                <button
                  disabled={!name.trim() || create.isPending}
                  onClick={() => create.mutate()}
                  className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center justify-center gap-2"
                >
                  {create.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Create token
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tokens.isLoading ? (
        <Loading />
      ) : tokens.data && tokens.data.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5">Last used</th>
                <th className="px-4 py-2.5">Expires</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tokens.data.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtTs(t.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtTs(t.lastUsedAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtTs(t.expiresAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onRevoke(t)}
                      className="text-red-600 hover:text-red-700 inline-flex items-center gap-1 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="No API tokens"
          body="Create one to use the SpinForge API from CI or scripts."
        />
      )}
    </Section>
  );
}

// ---------- Plan & Limits ---------------------------------------------

function PolicySection() {
  const policy = useQuery({
    queryKey: ["customer", "policy"],
    queryFn: customerApi.getPolicy,
  });

  const groups = useMemo(() => buildLimitGroups(policy.data || {}), [policy.data]);

  return (
    <Section icon={<ShieldCheck className="h-4 w-4" />} title="Plan & limits">
      {policy.isLoading ? (
        <Loading />
      ) : (
        <>
          {policy.data?.plan && (
            <div className="mb-4 inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              {String(policy.data.plan)}
            </div>
          )}
          {groups.length === 0 ? (
            <Empty title="No limits configured" body="Contact support if this is unexpected." />
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.title}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    {g.title}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {g.items.map((l) => (
                      <div
                        key={l.label}
                        className="p-3 rounded-lg border border-gray-200 bg-gray-50"
                      >
                        <div className="text-xs text-gray-500">{l.label}</div>
                        <div className="text-sm font-medium text-gray-900 mt-0.5 break-words">
                          {l.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}

// ---------- Shared bits ------------------------------------------------

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            {icon}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Loading() {
  return (
    <div className="py-8 flex items-center justify-center text-gray-400">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{body}</p>
    </div>
  );
}

function fmtTs(v: string | number | null | undefined) {
  if (v == null || v === "") return "—";
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

type LimitItem = { label: string; value: string };
type LimitGroup = { title: string; items: LimitItem[] };

const LIMIT_LABELS: Record<string, string> = {
  maxSites: "Sites",
  maxCustomDomains: "Custom domains",
  maxSslCerts: "SSL certificates",
  storageMB: "Storage",
  concurrentJobs: "Concurrent jobs",
  maxJobDurationMin: "Max job duration",
  maxJobMemoryMB: "Max job memory",
  maxArtifactMB: "Max artifact size",
  monthlyBuildMinutes: "Monthly build minutes",
  allowedPlatforms: "Allowed platforms",
  allowedRunnerClasses: "Runner classes",
};

const GROUP_TITLES: Record<string, string> = {
  hosting: "Hosting",
  build: "Build",
};

const MB_KEYS = new Set(["storageMB", "maxJobMemoryMB", "maxArtifactMB"]);
const MIN_KEYS = new Set(["maxJobDurationMin", "monthlyBuildMinutes"]);

function formatLimitValue(key: string, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") {
    if (MB_KEYS.has(key)) return v >= 1024 ? `${(v / 1024).toFixed(v % 1024 === 0 ? 0 : 1)} GB` : `${v} MB`;
    if (MIN_KEYS.has(key)) return key === "monthlyBuildMinutes" ? `${v.toLocaleString()} min/mo` : `${v} min`;
    return v.toLocaleString();
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function buildLimitGroups(policy: Record<string, unknown>): LimitGroup[] {
  const groups: LimitGroup[] = [];
  for (const [k, v] of Object.entries(policy)) {
    if (k === "plan") continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const items = Object.entries(v as Record<string, unknown>).map(([ck, cv]) => ({
        label: LIMIT_LABELS[ck] || ck,
        value: formatLimitValue(ck, cv),
      }));
      if (items.length) groups.push({ title: GROUP_TITLES[k] || k, items });
    } else {
      groups.push({
        title: GROUP_TITLES[k] || k,
        items: [{ label: LIMIT_LABELS[k] || k, value: formatLimitValue(k, v) }],
      });
    }
  }
  return groups;
}
