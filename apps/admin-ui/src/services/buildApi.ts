/**
 * SpinForge - SpinBuild API client (building-api)
 *
 * Separate axios instance from services/api.ts because building-api
 * lives at a different origin (build.spinforge.dev) than hosting-api
 * (admin.spinforge.dev). Both validate the same admin JWT, so we
 * reuse the `adminToken` localStorage entry.
 *
 * Unlike the hosting-api client we do NOT auto-redirect on 401 —
 * a cross-origin 401 from building-api often means the build-api
 * is still rolling out or CORS isn't quite right; we let the page
 * show the error so the operator can read it.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = (import.meta.env.VITE_BUILD_API_URL as string) || 'https://build.spinforge.dev';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

client.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const tok = localStorage.getItem('adminToken');
  if (tok) cfg.headers.set('Authorization', `Bearer ${tok}`);
  return cfg;
});

client.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    // Don't auto-redirect on 401 (unlike hosting-api). Operator may be
    // re-authenticating in another tab or the admin token may not yet
    // be replicated to building-api. Let the page surface the error.
    return Promise.reject(err);
  }
);

// ─── Types ─────────────────────────────────────────────────────────────

export interface BuildJob {
  id: string;
  customerId: string;
  platform: string;
  status: string;   // queued, running, succeeded, failed, canceled, timeout
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  runnerId?: string;
  runnerClass?: string;
  manifest: Record<string, any>;
  usage?: { cpu_seconds?: number; build_seconds?: number; artifact_bytes?: number };
}

export interface BuildCustomer {
  id: string;
  policy: Policy;
  activeJobs: number;
  monthlyUsage: Record<string, string>;
}

export interface Policy {
  build: {
    concurrentJobs: number;
    maxJobDurationMin: number;
    maxJobCpuMhz: number;
    maxJobMemoryMB: number;
    maxArtifactMB: number;
    allowedPlatforms: string[];
    allowedRunnerClasses: string[];
    monthlyCpuSeconds: number;
    monthlyBuildMinutes: number;
  };
  hosting: {
    maxSites: number;
    maxCustomDomains: number;
    maxSslCerts: number;
    maxSigningProfiles: number;
    concurrentContainers: number;
    maxContainerMemoryMB: number;
    maxContainerCpuMhz: number;
    maxStaticStorageGB: number;
    monthlyEgressGB: number;
    monthlyRequestCount: number;
    requestsPerSecond: number;
  };
  features: {
    signingProfiles: boolean;
    customDomains: boolean;
    macBuilds: boolean;
  };
}

export interface SigningProfile {
  id: string;
  customerId: string;
  platform: string;    // ios, android, macos
  label: string;
  createdAt: string;
  expiresAt?: string;
}

export interface BuildSession {
  id: string;
  customerId: string;
  status: string;
  createdAt: string;
  runnerId?: string;
}

export interface BuildRunner {
  id: string;
  class: string;       // lxc, macos, nomad-docker
  status: string;
  lastHeartbeat: string;
  capabilities: string[];
  activeSlots: number;
  totalSlots: number;
}

// ─── Deployments ──────────────────────────────────────────────────────

export type DeploymentSourceType =
  | 'static'
  | 'build-static'
  | 'build-container'
  | 'build-mobile';

export interface Deployment {
  id: string;
  customerId: string;
  domain: string | null;
  source: {
    type: DeploymentSourceType;
    platform?: 'ios' | 'android';
    workspacePath?: string;
    build?: {
      command?: string;
      outputDir?: string;
      framework?: string;
      env?: Record<string, string>;
      dockerfile?: string;
    };
  };
  target?: any;
  phases: {
    build:  { status: string; jobId?: string | null; startedAt?: string | null; completedAt?: string | null; error?: string | null; artifactDir?: string | null };
    deploy: { status: string; type?: string | null; startedAt?: string | null; completedAt?: string | null; error?: string | null };
  };
  status: 'queued' | 'building' | 'deploying' | 'succeeded' | 'failed' | 'canceled';
  url: string | null;
  createdAt: string;
  completedAt: string | null;
  metadata?: Record<string, any>;
}

// ─── Default policy (new customer seed) ───────────────────────────────

export const DEFAULT_POLICY: Policy = {
  build: {
    concurrentJobs: 2,
    maxJobDurationMin: 45,
    maxJobCpuMhz: 4000,
    maxJobMemoryMB: 4096,
    maxArtifactMB: 1024,
    allowedPlatforms: ['web', 'linux', 'android'],
    allowedRunnerClasses: ['nomad-docker', 'lxc'],
    monthlyCpuSeconds: 360000,
    monthlyBuildMinutes: 3000,
  },
  hosting: {
    maxSites: 25,
    maxCustomDomains: 50,
    maxSslCerts: 50,
    maxSigningProfiles: 5,
    concurrentContainers: 10,
    maxContainerMemoryMB: 2048,
    maxContainerCpuMhz: 2000,
    maxStaticStorageGB: 20,
    monthlyEgressGB: 500,
    monthlyRequestCount: 5_000_000,
    requestsPerSecond: 100,
  },
  features: {
    signingProfiles: true,
    customDomains: true,
    macBuilds: false,
  },
};

// ─── API functions ─────────────────────────────────────────────────────

export const buildApi = {
  baseUrl: BASE_URL,

  // jobs
  listJobs: (params: { customerId?: string; status?: string; platform?: string; limit?: number; offset?: number } = {}) =>
    client.get<{ jobs: BuildJob[]; total: number }>('/api/jobs', { params }).then(r => r.data),
  getJob: (id: string) =>
    client.get<BuildJob>(`/api/jobs/${id}`).then(r => r.data),
  getJobEvents: (id: string) =>
    client.get<{ events: any[] }>(`/api/jobs/${id}/events`).then(r => r.data),
  getJobArtifacts: (id: string) =>
    client.get<{ artifacts: any[] }>(`/api/jobs/${id}/artifacts`).then(r => r.data),
  getJobUsage: (id: string) =>
    client.get<any>(`/api/jobs/${id}/usage`).then(r => r.data),
  cancelJob: (id: string) =>
    client.delete<{ ok: boolean }>(`/api/jobs/${id}`).then(r => r.data),
  createJob: (form: FormData) =>
    client.post<BuildJob>('/api/jobs', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  // deployments — the customer-facing primitive. A single submission
  // ends at a live URL, a running container, or a signed binary.
  listDeployments: (params: { customerId?: string; status?: string; limit?: number; offset?: number } = {}) =>
    client.get<{ deployments: Deployment[]; total: number }>('/api/deployments', { params }).then(r => r.data),
  getDeployment: (id: string) =>
    client.get<Deployment>(`/api/deployments/${id}`).then(r => r.data),
  createDeployment: (form: FormData) =>
    client.post<Deployment>('/api/deployments', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),
  cancelDeployment: (id: string) =>
    client.delete<{ ok: boolean }>(`/api/deployments/${id}`).then(r => r.data),

  // customers + policy
  listCustomers: () =>
    client.get<{ customers: BuildCustomer[]; total: number }>('/api/customers').then(r => r.data),
  getPolicy: (customerId: string) =>
    client.get<Policy>(`/api/customers/${encodeURIComponent(customerId)}/policy`).then(r => r.data),
  putPolicy: (customerId: string, policy: Policy) =>
    client.put<Policy>(`/api/customers/${encodeURIComponent(customerId)}/policy`, policy).then(r => r.data),

  // signing profiles
  listSigningProfiles: () =>
    client.get<{ profiles: SigningProfile[] }>('/api/signing-profiles').then(r => r.data),
  getSigningProfile: (id: string) =>
    client.get<SigningProfile>(`/api/signing-profiles/${id}`).then(r => r.data),
  deleteSigningProfile: (id: string) =>
    client.delete<{ ok: boolean }>(`/api/signing-profiles/${id}`).then(r => r.data),
  createSigningProfile: (form: FormData) =>
    client.post<SigningProfile>('/api/signing-profiles', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  // sessions
  listSessions: () =>
    client.get<{ sessions: BuildSession[] }>('/api/sessions').then(r => r.data),
  getSession: (id: string) =>
    client.get<BuildSession>(`/api/sessions/${id}`).then(r => r.data),
  createSession: (body: any) =>
    client.post<BuildSession>('/api/sessions', body).then(r => r.data),
  markReady: (id: string) =>
    client.post<BuildSession>(`/api/sessions/${id}/ready`, {}).then(r => r.data),
  deleteSession: (id: string) =>
    client.delete<{ ok: boolean }>(`/api/sessions/${id}`).then(r => r.data),

  // runners
  listRunners: () =>
    client.get<{ runners: BuildRunner[] }>('/api/runners').then(r => r.data),

  // vault — platform secrets
  listPlatformSecrets: () =>
    client.get<{ keys: string[] }>('/api/vault/platform').then(r => r.data),
  readPlatformSecret: (key: string) =>
    client.get<{ key: string; data: Record<string, any>; metadata: any }>(
      `/api/vault/platform/${encodeURIComponent(key)}`,
    ).then(r => r.data),
  writePlatformSecret: (key: string, data: Record<string, any>) =>
    client.put<{ ok: boolean; key: string; version: number }>(
      `/api/vault/platform/${encodeURIComponent(key)}`,
      { data },
    ).then(r => r.data),
  deletePlatformSecret: (key: string) =>
    client.delete<void>(`/api/vault/platform/${encodeURIComponent(key)}`).then(r => r.data),

  // vault — customer-scoped secrets
  bootstrapCustomerVault: (customerId: string, rotate = false) =>
    client.post<{
      customerId: string; reused: boolean; vaultAddr: string;
      token: string; accessor: string; policyName: string;
      leaseDurationSec: number;
      paths: { self: string; data: string; metadata: string };
    }>(
      `/api/vault/customers/${encodeURIComponent(customerId)}/bootstrap${rotate ? '?rotate=true' : ''}`,
    ).then(r => r.data),
  getCustomerVaultToken: (customerId: string) =>
    client.get<{
      customerId: string; vaultAddr: string;
      token: string; accessor: string; policyName: string;
      leaseDurationSec: number; mintedAt: number;
    }>(`/api/vault/customers/${encodeURIComponent(customerId)}/token`).then(r => r.data),
  listCustomerSecrets: (customerId: string) =>
    client.get<{ customerId: string; keys: string[] }>(
      `/api/vault/customers/${encodeURIComponent(customerId)}`,
    ).then(r => r.data),
  readCustomerSecret: (customerId: string, key: string) =>
    client.get<{ customerId: string; key: string; data: Record<string, any>; metadata: any }>(
      `/api/vault/customers/${encodeURIComponent(customerId)}/keys/${encodeURIComponent(key)}`,
    ).then(r => r.data),
  writeCustomerSecret: (customerId: string, key: string, data: Record<string, any>) =>
    client.put<{ ok: boolean; customerId: string; key: string; version: number }>(
      `/api/vault/customers/${encodeURIComponent(customerId)}/keys/${encodeURIComponent(key)}`,
      { data },
    ).then(r => r.data),
  deleteCustomerSecret: (customerId: string, key: string) =>
    client.delete<void>(
      `/api/vault/customers/${encodeURIComponent(customerId)}/keys/${encodeURIComponent(key)}`,
    ).then(r => r.data),

  // job streaming (SSE) — returned as EventSource, caller manages lifecycle
  openJobStream: (id: string): EventSource =>
    new EventSource(`${BASE_URL}/api/jobs/${id}/stream?token=${encodeURIComponent(localStorage.getItem('adminToken') || '')}`),

  // ─── Pipelines / Actions / Builds ───────────────────────────────────
  // The new CI-style pipeline system. A Pipeline is a saved customer-owned
  // config of ordered stages; a Build is one execution of that pipeline.
  // Actions are code-defined primitives exposed read-only for inspection.

  // actions catalog
  listActions: () =>
    client.get<{ count: number; actions: ActionDef[]; byCategory: Record<string, ActionDef[]> }>('/api/actions')
      .then(r => r.data),
  getActionSchema: (id: string) =>
    client.get<{ id: string; version: string; inputs: any; outputs: any }>(
      `/api/actions/${encodeURIComponent(id)}/schema`,
    ).then(r => r.data),

  // pipelines
  createPipeline: (body: {
    customerId: string;
    name: string;
    type?: PipelineType;
    source?: PipelineSource;
    stages: Stage[];
    trigger?: any;
    metadata?: any;
  }) =>
    client.post<Pipeline>('/api/pipelines', body).then(r => r.data),
  listPipelines: (q: { customerId?: string; limit?: number; offset?: number } = {}) =>
    client.get<{ pipelines: Pipeline[]; total: number }>('/api/pipelines', { params: q }).then(r => r.data),
  getPipeline: (id: string) =>
    client.get<Pipeline>(`/api/pipelines/${encodeURIComponent(id)}`).then(r => r.data),
  updatePipeline: (id: string, patch: {
    name?: string;
    type?: PipelineType;
    source?: PipelineSource;
    stages?: Stage[];
    trigger?: any;
    metadata?: any;
  }) =>
    client.put<Pipeline>(`/api/pipelines/${encodeURIComponent(id)}`, patch).then(r => r.data),
  deletePipeline: (id: string) =>
    client.delete<void>(`/api/pipelines/${encodeURIComponent(id)}`).then(r => r.data),
  validatePipeline: (stages: Stage[]) =>
    client.post<{ valid: boolean; errors: PipelineValidationError[] }>(
      '/api/pipelines/validate',
      { stages },
    ).then(r => r.data),

  // builds
  createBuild: (body: { pipelineId: string; trigger?: any; inputs?: Record<string, any>; customerId?: string }) =>
    client.post<Build>('/api/builds', body).then(r => r.data),
  listBuilds: (q: { pipelineId?: string; customerId?: string; status?: string; limit?: number; offset?: number } = {}) =>
    client.get<{ builds: Build[]; total: number }>('/api/builds', { params: q }).then(r => r.data),
  getBuild: (id: string) =>
    client.get<Build>(`/api/builds/${encodeURIComponent(id)}`).then(r => r.data),
  cancelBuild: (id: string) =>
    client.post<Build>(`/api/builds/${encodeURIComponent(id)}/cancel`, {}).then(r => r.data),
  resumeBuild: (id: string) =>
    client.post<Build>(`/api/builds/${encodeURIComponent(id)}/resume`, {}).then(r => r.data),
  retryStage: (id: string, stageId: string, overrides?: Record<string, any>) =>
    client.post<Build>(
      `/api/builds/${encodeURIComponent(id)}/stages/${encodeURIComponent(stageId)}/retry`,
      overrides ? { with: overrides } : {},
    ).then(r => r.data),
  getBuildEvents: (id: string, limit = 200) =>
    client.get<{ buildId: string; events: BuildEvent[] }>(
      `/api/builds/${encodeURIComponent(id)}/events`, { params: { limit } },
    ).then(r => r.data),
  getStageDetail: (buildId: string, stageId: string) =>
    client.get<{ buildId: string; stage: Stage; events: BuildEvent[]; log: StageLogLine[] }>(
      `/api/builds/${encodeURIComponent(buildId)}/stages/${encodeURIComponent(stageId)}`,
    ).then(r => r.data),
  // Fetch one artifact through the authenticated API and trigger a
  // browser download. For URL-type outputs the server responds with a
  // 302 to the external URL — axios follows it, and we save whatever
  // body comes back. Caller should special-case http(s) values and
  // window.open() them directly instead of calling this.
  downloadArtifact: async (buildId: string, stageId: string, key: string, filenameHint?: string) => {
    const r = await client.get(
      `/api/builds/${encodeURIComponent(buildId)}/artifacts/${encodeURIComponent(stageId)}/${encodeURIComponent(key)}`,
      { responseType: 'blob' },
    );
    const cd = r.headers['content-disposition'] as string | undefined;
    const m = cd && /filename="?([^"]+)"?/.exec(cd);
    const name = (m && m[1]) || filenameHint || `${stageId}-${key}`;
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

// ─── Pipeline / Build types ────────────────────────────────────────────

export type StageStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'skipped_unimplemented';
export type BuildStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

// Top-level pipeline type — drives the recipe the UI pre-fills on
// create, and is persisted on the pipeline record for later rendering.
// 'custom' is the escape hatch: no recipe, the author builds stages by hand.
export type PipelineType =
  | 'static-site'
  | 'node-service'
  | 'ios-app'
  | 'android-app'
  | 'container'
  | 'custom';

// Pipeline-level source. Moved off the first stage so every pipeline
// has one canonical place to say "where does the code come from".
// `git` carries the URL/ref/depth/token inline; `zip` carries no
// pipeline-level config — the archive is supplied at build-trigger time.
export interface PipelineSource {
  type: 'git' | 'zip';
  url?: string;
  ref?: string;
  depth?: number;
  token?: string;
}

export interface Stage {
  id: string;
  name?: string;
  action: string;
  actionVersion?: string;
  with: Record<string, any>;
  needs: string[];
  enabled?: boolean;
  continueOnError?: boolean;
  timeoutSec?: number | null;
  // runtime (build-only) fields — optional on pipeline records
  status?: StageStatus;
  attempt?: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  outputs?: Record<string, any>;
  error?: string;
}

export interface Pipeline {
  id: string;
  customerId: string;
  name: string;
  type: PipelineType;
  source: PipelineSource;
  stages: Stage[];
  trigger?: { type?: string; [k: string]: any };
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Build {
  id: string;
  pipelineId: string;
  customerId: string;
  pipelineSnapshot: { name: string; updatedAt: string };
  trigger: { type: string; [k: string]: any };
  inputs: Record<string, any>;
  workspace: string;
  stages: Stage[];
  status: BuildStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

export interface ActionDef {
  id: string;
  version: string;
  category: string;
  name: string;
  description: string;
  inputs: any;   // JSON Schema
  outputs: any;  // JSON Schema
  runner?: string;
}

export interface PipelineValidationError {
  stageIndex: number;
  stageId?: string;
  actionId?: string;
  path: string;
  code: string;
  message: string;
  params?: Record<string, any>;
}

export interface BuildEvent {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error' | string;
  phase: string;
  message: string;
  ts: string;
  context?: Record<string, any>;
}

export interface StageLogLine {
  id: string;
  stream: 'stdout' | 'stderr' | string;
  line: string;
}

// ─── Shared helpers ────────────────────────────────────────────────────

export function relativeTime(iso?: string | null): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatBytes(n?: number | string): string {
  if (n == null) return '—';
  const v = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(v)) return '—';
  if (v < 1024) return `${v} B`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 ** 3) return `${(v / 1024 ** 2).toFixed(1)} MB`;
  return `${(v / 1024 ** 3).toFixed(2)} GB`;
}

export function friendlyError(err: any): string {
  if (err?.response?.status === 401) {
    return 'Session expired, please reload admin UI.';
  }
  return err?.response?.data?.error || err?.message || 'Unknown error';
}
