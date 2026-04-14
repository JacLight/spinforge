/**
 * SpinForge - Nomad orchestration service
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Translates a SpinForge site record into a Nomad job spec and submits it
 * to the Nomad HTTP API. This is the replacement for the direct dockerode
 * calls scattered across routes/sites.js, routes/containers.js,
 * services/container-recovery.js, and services/container-ip-monitor.js —
 * Nomad now owns the entire lifecycle of customer workloads.
 *
 * Supported site types:
 *   container  → Nomad job using the `docker` driver. Customer supplies an
 *                image (like nginx:alpine, their own GHCR image, etc.).
 *                For stateful workloads (MongoDB, Postgres) the caller
 *                supplies a host_volume mount via containerConfig.volumes.
 *
 *   node       → Nomad job using the `raw_exec` driver. Customer supplies
 *                an artifact (git repo, tarball URL, or a static path on
 *                the shared CephFS volume) plus an entrypoint command.
 *                Small Node/Python apps, no image build needed.
 *
 * Consul integration:
 *   Every job registers a Consul service named `site-${slug(domain)}` on
 *   its allocated port. OpenResty's upstream resolver (task #71) looks up
 *   healthy allocations via Consul DNS or the health API.
 *
 * Job IDs:
 *   Stable and derived from domain: "site-${slug(domain)}". Updating a
 *   site by re-submitting the same job ID is how Nomad performs a rolling
 *   deploy. Deleting a site means `DELETE /v1/job/<id>?purge=true`.
 */
const axios = require('axios');
const logger = require('../utils/logger');

const DEFAULT_NOMAD_ADDR =
  process.env.NOMAD_ADDR || 'http://172.18.0.1:4646';

const DEFAULT_CONSUL_ADDR =
  process.env.CONSUL_HTTP_ADDR || 'http://172.18.0.1:8500';

// Map SpinForge site domains to safe Nomad job IDs. Nomad restricts IDs to
// [a-zA-Z0-9_-] — domains have dots, which we replace with single dashes.
function siteJobId(domain) {
  if (!domain) throw new Error('domain is required');
  const safe = String(domain).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `site-${safe}`;
}

// The Consul service name we register. Same slug as the job id so OpenResty
// can look it up deterministically from the site record.
function siteServiceName(domain) {
  return siteJobId(domain);
}

class NomadService {
  constructor({ nomadAddr, consulAddr } = {}) {
    this.nomadAddr = nomadAddr || DEFAULT_NOMAD_ADDR;
    this.consulAddr = consulAddr || DEFAULT_CONSUL_ADDR;
    this.http = axios.create({
      baseURL: this.nomadAddr,
      timeout: 30_000,
      // Nomad HTTP API uses bare JSON for job submission and responses.
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (s) => s < 500,
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Submit a site as a Nomad job. Creates the job if it doesn't exist,
   * updates it (rolling deploy) if it does. Returns the dispatched eval id.
   */
  async deploySite(site) {
    const spec = this.siteToJob(site);
    const jobId = spec.ID;
    logger.info(`NomadService: deploying ${site.domain} as job ${jobId}`);

    // POST /v1/jobs with { Job: <spec> } is the "register or update" call.
    const res = await this.http.post('/v1/jobs', { Job: spec });
    if (res.status >= 400) {
      throw new Error(`Nomad register failed (${res.status}): ${JSON.stringify(res.data)}`);
    }

    return {
      jobId,
      evalId: res.data?.EvalID,
      warnings: res.data?.Warnings || null,
    };
  }

  /**
   * Stop a site's Nomad job. `purge=true` removes it from Nomad's state so
   * the job id is reusable. Returns null if the job didn't exist.
   */
  async stopSite(domain, { purge = true } = {}) {
    const jobId = siteJobId(domain);
    const res = await this.http.delete(
      `/v1/job/${encodeURIComponent(jobId)}?purge=${purge ? 'true' : 'false'}`
    );
    if (res.status === 404) return null;
    if (res.status >= 400) {
      throw new Error(`Nomad stop failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return { jobId, evalId: res.data?.EvalID };
  }

  /**
   * Returns a synthesized "site status" blob the api can hand back to the
   * admin UI without the caller needing to understand Nomad internals.
   * Shape: { jobId, status, allocations: [{id, node, status, healthy}] }.
   */
  async getSiteStatus(domain) {
    const jobId = siteJobId(domain);

    const jobRes = await this.http.get(`/v1/job/${encodeURIComponent(jobId)}`);
    if (jobRes.status === 404) return null;
    if (jobRes.status >= 400) {
      throw new Error(`Nomad job lookup failed (${jobRes.status})`);
    }
    const job = jobRes.data;

    const allocRes = await this.http.get(`/v1/job/${encodeURIComponent(jobId)}/allocations`);
    const allocs = Array.isArray(allocRes.data) ? allocRes.data : [];

    return {
      jobId,
      status: job.Status,
      type: job.Type,
      submitTime: job.SubmitTime,
      allocations: allocs.map((a) => ({
        id: a.ID,
        node: a.NodeName,
        status: a.ClientStatus,
        healthy: a.DeploymentStatus?.Healthy === true,
        taskStates: Object.fromEntries(
          Object.entries(a.TaskStates || {}).map(([t, s]) => [t, s.State])
        ),
        createTime: a.CreateTime,
      })),
    };
  }

  /**
   * Fetch the last N lines of logs for the first running allocation of a
   * site. `type` is "stdout" or "stderr". Returns null if no allocation
   * exists yet.
   */
  async getSiteLogs(domain, { lines = 200, type = 'stdout' } = {}) {
    const status = await this.getSiteStatus(domain);
    if (!status) return null;
    const alloc = status.allocations.find((a) => a.status === 'running') || status.allocations[0];
    if (!alloc) return null;

    // Task name is the job id by convention (see siteToJob below).
    const taskName = status.jobId;
    const res = await this.http.get(
      `/v1/client/fs/logs/${alloc.id}`,
      { params: { task: taskName, type, plain: true, origin: 'end', offset: lines * 200 } }
    );
    if (res.status >= 400) return null;
    return {
      alloc: alloc.id,
      node: alloc.node,
      task: taskName,
      body: res.data,
    };
  }

  // ─── Job spec generation ─────────────────────────────────────────────

  /**
   * Translate a site record into a Nomad JobSpec.
   * Dispatches by site.type. Adding a new site type means adding a new
   * `_jobFor<Type>` method.
   */
  siteToJob(site) {
    if (!site || !site.domain) {
      throw new Error('siteToJob requires a site with a domain');
    }
    switch (site.type) {
      case 'container':
        return this._jobForContainer(site);
      case 'node':
        return this._jobForNode(site);
      default:
        throw new Error(
          `NomadService: unsupported site type "${site.type}" (expected container or node)`
        );
    }
  }

  _jobForContainer(site) {
    const cfg = site.containerConfig || {};
    if (!cfg.image) throw new Error('containerConfig.image is required');

    const jobId = siteJobId(site.domain);
    const port = Number(cfg.port) || 80;

    // The docker driver gets port "to" mapped so the app inside the
    // container listens on its native port while Nomad maps a dynamic
    // host port. OpenResty proxies to the dynamic host port.
    const portMap = { http: port };

    return this._wrapJob({
      jobId,
      domain: site.domain,
      type: 'service',
      task: {
        Name: jobId,
        Driver: 'docker',
        Config: {
          image: cfg.image,
          ports: ['http'],
          // Allow env-driven image tag overrides without re-registering
          force_pull: false,
          volumes: this._volumeMounts(cfg.volumes),
        },
        Env: this._envMap(cfg.env),
        Resources: {
          CPU: Number(cfg.cpuMhz) || 200,
          MemoryMB: Number(cfg.memoryMB) || 256,
        },
        Services: [this._serviceBlock(site.domain, jobId, cfg.healthCheckPath)],
      },
      portMap,
    });
  }

  _jobForNode(site) {
    const cfg = site.nodeConfig || {};
    if (!cfg.entrypoint) {
      throw new Error('nodeConfig.entrypoint is required (e.g. "node server.js")');
    }

    const jobId = siteJobId(site.domain);

    // raw_exec: run a command on the host. Good for small Node apps.
    // The command reads $NOMAD_PORT_http for the port Nomad allocated,
    // matching the convention from our exec-driver verification job.
    const [cmd, ...args] = this._parseCommand(cfg.entrypoint);

    // Optional artifact fetching — git, http tarball, or s3:// URL. Nomad
    // downloads + extracts automatically before running the command.
    const artifacts = cfg.source ? [{ GetterSource: cfg.source }] : [];

    return this._wrapJob({
      jobId,
      domain: site.domain,
      type: 'service',
      task: {
        Name: jobId,
        Driver: 'raw_exec',
        Config: {
          command: cmd,
          args,
        },
        Env: {
          ...this._envMap(cfg.env),
          // Node apps usually use PORT; surface Nomad's allocation to them
          PORT: '${NOMAD_PORT_http}',
        },
        Artifacts: artifacts,
        Resources: {
          CPU: Number(cfg.cpuMhz) || 100,
          MemoryMB: Number(cfg.memoryMB) || 128,
        },
        Services: [this._serviceBlock(site.domain, jobId, cfg.healthCheckPath)],
      },
      portMap: { http: 0 }, // 0 = dynamic port, Nomad assigns and Env gets $NOMAD_PORT_http
    });
  }

  // ─── Shared job scaffolding ──────────────────────────────────────────

  _wrapJob({ jobId, domain, type, task, portMap }) {
    // Nomad job spec in JSON form. The shape mirrors what `nomad job run`
    // expects from HCL — same field names, just JSON-case.
    return {
      ID: jobId,
      Name: jobId,
      Type: type,
      Datacenters: ['spinforge-dc1'],
      Meta: {
        'spinforge.domain': domain,
        'spinforge.managed-by': 'spinforge-api',
      },
      TaskGroups: [
        {
          Name: 'app',
          Count: 1,
          Networks: [{
            DynamicPorts: Object.entries(portMap).map(([label, to]) => ({
              Label: label,
              To: to,
            })),
          }],
          RestartPolicy: {
            Attempts: 3,
            Interval: 60_000_000_000, // 60s in nanoseconds
            Delay: 5_000_000_000,     // 5s in nanoseconds
            Mode: 'delay',
          },
          Tasks: [task],
        },
      ],
    };
  }

  _serviceBlock(domain, jobId, healthCheckPath) {
    return {
      Name: siteServiceName(domain),
      PortLabel: 'http',
      Tags: ['spinforge', `site=${domain}`],
      Checks: [{
        Type: 'http',
        Path: healthCheckPath || '/',
        Interval: 15_000_000_000,  // 15s
        Timeout:  5_000_000_000,   // 5s
      }],
    };
  }

  _envMap(envArray) {
    // Accept either {KEY: 'value'} objects OR [{key, value}] arrays
    // (dashboard sends the latter shape).
    if (!envArray) return {};
    if (Array.isArray(envArray)) {
      return Object.fromEntries(
        envArray.filter(e => e && e.key).map(e => [e.key, String(e.value ?? '')])
      );
    }
    if (typeof envArray === 'object') return envArray;
    return {};
  }

  _volumeMounts(vols) {
    // Simple shape: ["hostPath:containerPath", ...]
    if (!Array.isArray(vols)) return [];
    return vols.map(v => String(v));
  }

  _parseCommand(entrypoint) {
    // Naive shlex: splits on whitespace. Customer can pre-escape if they
    // need fancy quoting, but this covers "node server.js" and
    // "python3 -m http.server 8000".
    return String(entrypoint).trim().split(/\s+/);
  }
}

NomadService.siteJobId = siteJobId;
NomadService.siteServiceName = siteServiceName;

module.exports = NomadService;
