/**
 * Customer-facing primitive: a Deployment. One submission, one final
 * destination (live URL / store / binary).
 *
 * A deployment internally manages:
 *   - a build phase     (via JobService — optional; skipped for raw static)
 *   - a deploy phase    (via HostingDeployService — static / container / mobile)
 *
 * The state machine is:
 *   queued → building (if needsBuild) → deploying → succeeded
 *                                   \→ failed
 *   queued → deploying → succeeded / failed
 *
 * KeyDB keys owned by this service:
 *   deployment:<id>                JSON record
 *   deployments:recent             ZSET score=createdAt, value=id
 *   customer:<id>:deployments      ZSET per customer
 *   job:<jobId>:deployment         reverse index — JobService terminal
 *                                  hook reads this to find the parent dep.
 */

const { ulid } = require('ulid');

const TERMINAL = new Set(['succeeded', 'failed', 'canceled']);

class DeploymentService {
  constructor(redis, { logger, events, jobs, hostingDeploy, policies } = {}) {
    this.redis = redis;
    this.logger = logger || console;
    this.events = events;
    this.jobs = jobs;
    this.hostingDeploy = hostingDeploy;
    this.policies = policies; // CustomerPolicyService module
  }

  async create({ customerId, domain, source, target, metadata = {} }) {
    if (!customerId) throw new Error('customerId required');
    if (!source || !source.type) throw new Error('source.type required');

    // Web deployments need a domain; mobile doesn't.
    const isWeb = ['static', 'build-static', 'build-container'].includes(source.type);
    if (isWeb && !domain) throw new Error('domain required for web deployments');

    const id = 'dep_' + ulid();
    const record = {
      id,
      customerId,
      domain: domain || null,
      source,
      target: target || null,
      phases: {
        build:  { status: 'pending', jobId: null, startedAt: null, completedAt: null, error: null, artifactDir: null },
        deploy: { status: 'pending', type: null,  startedAt: null, completedAt: null, error: null },
      },
      status: 'queued', // queued | building | deploying | succeeded | failed | canceled
      url: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      metadata,
    };

    await this.redis.set(`deployment:${id}`, JSON.stringify(record));
    await this.redis.zAdd('deployments:recent', { score: Date.now(), value: id });
    await this.redis.zAdd(`customer:${customerId}:deployments`, { score: Date.now(), value: id });

    if (this.events) {
      this.events.publish('deployment.created', id, {
        context: { customerId, domain, sourceType: source.type },
      }).catch(() => {});
    }

    // Drive it forward asynchronously — the response returns immediately
    // and the phases progress out of band.
    this._advance(id).catch((err) => {
      this.logger.error(`[deployment ${id}] advance failed: ${err.message}`);
    });
    return record;
  }

  async get(id) {
    const raw = await this.redis.get(`deployment:${id}`);
    return raw ? JSON.parse(raw) : null;
  }

  async list({ customerId, status, limit = 100, offset = 0 } = {}) {
    const indexKey = customerId ? `customer:${customerId}:deployments` : 'deployments:recent';
    const total = await this.redis.zCard(indexKey);
    const ids = await this.redis.zRange(
      indexKey,
      -(offset + limit),
      -(offset + 1),
      { REV: true }
    );
    const out = [];
    for (const id of ids) {
      const d = await this.get(id);
      if (!d) continue;
      if (status && d.status !== status) continue;
      out.push(d);
    }
    return { deployments: out, total };
  }

  /**
   * State machine — called after creation and after each phase resolves.
   * Idempotent: safe to call multiple times for the same id.
   */
  async _advance(id) {
    const d = await this.get(id);
    if (!d || TERMINAL.has(d.status)) return;

    // Phase 1: build (if needed)
    if (d.phases.build.status === 'pending') {
      if (this._needsBuild(d.source.type)) {
        await this._startBuild(d);
      } else {
        // static → skip build, mark complete. artifactDir is the
        // workspacePath where the route handler unzipped the upload.
        await this._patch(id, {
          'phases.build.status': 'skipped',
          'phases.build.completedAt': new Date().toISOString(),
          'phases.build.artifactDir': d.source.workspacePath || null,
        });
      }
      // Re-read + re-enter the machine
      return this._advance(id);
    }
    if (d.phases.build.status === 'building') {
      // Still building — onBuildJobTransition will re-advance us.
      return;
    }
    if (d.phases.build.status === 'failed') {
      await this._patch(id, { status: 'failed', completedAt: new Date().toISOString() });
      if (this.events) {
        this.events.publish('deployment.failed', id, {
          severity: 'error',
          context: { phase: 'build', error: d.phases.build.error },
        }).catch(() => {});
      }
      return;
    }

    // Phase 2: deploy
    if (d.phases.deploy.status === 'pending') {
      await this._startDeploy(d);
      return this._advance(id);
    }
    if (d.phases.deploy.status === 'deploying') {
      // _startDeploy resolves synchronously for v1 (writes keydb, submits
      // to Nomad). If it's in-flight we're being re-called from a racing
      // path — just return.
      return;
    }
    if (d.phases.deploy.status === 'succeeded') {
      const latest = await this.get(id);
      await this._patch(id, {
        status: 'succeeded',
        completedAt: new Date().toISOString(),
      });
      if (this.events) {
        this.events.publish('deployment.succeeded', id, {
          context: { url: latest?.url },
        }).catch(() => {});
      }
      return;
    }
    if (d.phases.deploy.status === 'failed') {
      await this._patch(id, { status: 'failed', completedAt: new Date().toISOString() });
      if (this.events) {
        this.events.publish('deployment.failed', id, {
          severity: 'error',
          context: { phase: 'deploy', error: d.phases.deploy.error },
        }).catch(() => {});
      }
      return;
    }
  }

  _needsBuild(sourceType) {
    return typeof sourceType === 'string' && sourceType.startsWith('build-');
  }

  async _startBuild(d) {
    // Customer policy check. We delegate quota/concurrency enforcement
    // to the existing CustomerPolicyService used by /api/jobs — the
    // build phase goes through JobService.create which the route
    // handler already guards. Here we just map source.type → platform.
    const platform = {
      'build-static':    'web',
      'build-container': 'linux',
      'build-mobile':    d.source.platform || 'android',
    }[d.source.type];

    const manifest = {
      buildCommand: (d.source.build && d.source.build.command) || 'npm ci && npm run build',
      outputDir:    (d.source.build && d.source.build.outputDir) || 'dist',
      framework:    d.source.build && d.source.build.framework,
      env:          (d.source.build && d.source.build.env) || {},
      // Container-specific: route handler copies Dockerfile + pushes image
      // after the runner build completes. For v1 static path only, this is
      // just threaded through.
      dockerfile:   d.source.build && d.source.build.dockerfile,
    };

    let job;
    try {
      job = await this.jobs.create({
        customerId: d.customerId,
        platform,
        framework: manifest.framework || null,
        manifest,
        source: 'deployment',
      });
    } catch (err) {
      this.logger.error(`[deployment ${d.id}] jobs.create failed: ${err.message}`);
      await this._patch(d.id, {
        'phases.build.status': 'failed',
        'phases.build.error': err.message,
        'phases.build.completedAt': new Date().toISOString(),
      });
      return;
    }

    // Reverse index — JobService's onTransition hook walks this to find
    // the parent deployment on terminal transitions.
    await this.redis.set(`job:${job.id}:deployment`, d.id);

    await this._patch(d.id, {
      'phases.build.status':    'building',
      'phases.build.jobId':     job.id,
      'phases.build.startedAt': new Date().toISOString(),
      status: 'building',
    });
    if (this.events) {
      this.events.publish('deployment.build_started', d.id, {
        context: { jobId: job.id, customerId: d.customerId },
      }).catch(() => {});
    }
  }

  /**
   * Wired in server.js as JobService's onTerminal hook. When a build
   * job tied to a deployment terminates, record the outcome and push
   * the state machine forward.
   */
  async onBuildJobTransition(jobId, status, { error, artifactDir } = {}) {
    const depId = await this.redis.get(`job:${jobId}:deployment`);
    if (!depId) return; // not a deployment-owned job

    const d = await this.get(depId);
    if (!d) return;

    if (status === 'succeeded') {
      await this._patch(d.id, {
        'phases.build.status':      'succeeded',
        'phases.build.completedAt': new Date().toISOString(),
        'phases.build.artifactDir': artifactDir || `/data/artifacts/${jobId}`,
      });
    } else if (['failed', 'canceled', 'timeout'].includes(status)) {
      await this._patch(d.id, {
        'phases.build.status':      'failed',
        'phases.build.error':       error || status,
        'phases.build.completedAt': new Date().toISOString(),
      });
    } else {
      // Non-terminal (e.g. 'running', 'assigned') — nothing to do here.
      return;
    }
    await this._advance(d.id);
  }

  async _startDeploy(d) {
    await this._patch(d.id, {
      'phases.deploy.status':    'deploying',
      'phases.deploy.startedAt': new Date().toISOString(),
      status: 'deploying',
    });
    if (this.events) {
      this.events.publish('deployment.deploy_started', d.id, {
        context: { customerId: d.customerId, domain: d.domain },
      }).catch(() => {});
    }

    try {
      const fresh = await this.get(d.id);
      const artifactDir = fresh.phases.build.artifactDir || fresh.source.workspacePath;
      const result = await this.hostingDeploy.deploy({
        deploymentId: fresh.id,
        customerId:   fresh.customerId,
        domain:       fresh.domain,
        source:       fresh.source,
        artifactDir,
      });
      await this._patch(d.id, {
        'phases.deploy.status':      'succeeded',
        'phases.deploy.type':        result.type,
        'phases.deploy.completedAt': new Date().toISOString(),
        url: result.url || null,
      });
    } catch (err) {
      this.logger.error(`[deployment ${d.id}] deploy failed: ${err.message}`);
      await this._patch(d.id, {
        'phases.deploy.status':      'failed',
        'phases.deploy.error':       err.message,
        'phases.deploy.completedAt': new Date().toISOString(),
      });
    }
  }

  async _patch(id, patches) {
    const d = await this.get(id);
    if (!d) return;
    for (const [dotted, value] of Object.entries(patches)) {
      const parts = dotted.split('.');
      let cur = d;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
    }
    d.updatedAt = new Date().toISOString();
    await this.redis.set(`deployment:${id}`, JSON.stringify(d));
  }
}

module.exports = DeploymentService;
module.exports.TERMINAL_STATES = TERMINAL;
