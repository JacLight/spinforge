const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const redis = require('./utils/redis');
const EventStream = require('./services/EventStream');
const JobService = require('./services/JobService');
const DispatchService = require('./services/DispatchService');
const RunnerRegistry = require('./services/RunnerRegistry');
const VaultService = require('./services/VaultService');
const SigningProfileService = require('./services/SigningProfileService');
const SessionService = require('./services/SessionService');
const DispatchRouter = require('./services/DispatchRouter');
const HostingDeployService = require('./services/HostingDeployService');
const DeploymentService = require('./services/DeploymentService');
const CustomerPolicyService = require('./services/CustomerPolicyService');
const ActionRegistry = require('./services/ActionRegistry');
const PipelineService = require('./services/PipelineService');
const BuildService = require('./services/BuildService');
const actionCatalog = require('./services/actions/catalog');
const inprocHandlers = require('./services/handlers/inproc');
const nomadHandlers = require('./services/handlers/nomad');
const healthRoute = require('./routes/health');
const routes = require('./routes');
const { authenticateAdmin } = require('./utils/admin-auth');
const metrics = require('./utils/metrics');

const app = express();

// CORS — admin UI (https://admin.spinforge.dev) calls this service cross-origin
// with Authorization: Bearer <admin JWT>. Must be mounted BEFORE express.json
// and BEFORE authenticateAdmin so preflights (OPTIONS) are answered without
// auth. Non-browser callers (curl/postman) send no Origin and are allowed.
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'https://admin.spinforge.dev,http://localhost:5173,http://localhost:3000')
  .split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Tools like curl/postman send no Origin — allow.
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Admin-Token', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  maxAge: 600,
}));

app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Core services — attached to app.locals so routes pick them up without
// re-instantiating. Matches hosting/api's pattern.
const events = new EventStream(redis, { logger });
const jobs = new JobService(redis, { logger, events });
const runners = new RunnerRegistry(redis, { logger });
// Vault is optional at boot — if VAULT_TOKEN isn't set, signing routes
// will 503 but the rest of the API works fine. This keeps dev bring-up
// cheap while still surfacing the dependency clearly.
const vault = new VaultService({ logger });
const signing = new SigningProfileService(redis, { vault, logger });
const nomadDispatch = new DispatchService({ jobs, events, runners, signing, vault, logger });
// DispatchRouter is currently a thin pass-through over nomadDispatch
// (task 127 collapsed the Proxmox branch). Kept as an object so future
// backends can plug in without touching every route.
const dispatch = new DispatchRouter({ nomad: nomadDispatch, events, logger });
const sessions = new SessionService(redis, { logger, events });

// Deployment pipeline — the customer-facing primitive. A Deployment owns
// a build phase (delegated to JobService) and a deploy phase (delegated
// to HostingDeployService). JobService.onTerminal fires into
// DeploymentService.onBuildJobTransition so a build completing advances
// its parent deployment's state machine.
const hostingDeploy = new HostingDeployService(redis, { logger, events, vault });
const deployments = new DeploymentService(redis, {
  logger, events, jobs, hostingDeploy,
  policies: CustomerPolicyService,
});
jobs.onTerminal = async (jobId, status, { error, job } = {}) => {
  try {
    await deployments.onBuildJobTransition(jobId, status, {
      error,
      // Build runners collect output into /data/artifacts/<jobId>/ —
      // that's the contract used by the static deploy path (unpack
      // artifact.zip or mirror directory contents).
      artifactDir: `/data/artifacts/${jobId}`,
    });
  } catch (err) {
    logger.warn(`[jobs.onTerminal] deployments hook failed for ${jobId}: ${err.message}`);
  }
};

// Pipeline model — action catalog + pipeline CRUD. Execution of a
// pipeline as a Build lives in BuildService (wired separately once the
// executor is in). For this cut, the routes let operators author and
// inspect pipeline definitions while the existing /api/jobs +
// /api/deployments paths remain unchanged.
const actions = new ActionRegistry({ logger });
for (const def of actionCatalog) {
  try { actions.register(def); }
  catch (err) { logger.error(`[actions] register ${def.id} failed: ${err.message}`); }
}
const pipelines = new PipelineService(redis, { logger, actions, events });
// Compose handler maps — inproc (file-shuffle, git clone, hosting hand-off,
// webhook) + nomad (build.static, build.node via builder-linux image).
// build.container / build.android / sign.* / publish.* remain
// unregistered; BuildService emits `skipped_unimplemented` with a clear
// reason until each gets a dedicated runner workflow.
const allHandlers = new Map([
  ...inprocHandlers.build({ hostingDeploy, logger }),
  ...nomadHandlers.build({ logger }),
]);
const builds = new BuildService(redis, {
  logger, events, pipelines, actions,
  handlers: allHandlers,
});

app.locals.redis = redis;
app.locals.events = events;
app.locals.jobs = jobs;
app.locals.runners = runners;
app.locals.vault = vault;
app.locals.signing = signing;
app.locals.nomadDispatch = nomadDispatch;
app.locals.dispatch = dispatch;
app.locals.sessions = sessions;
app.locals.deployments = deployments;
app.locals.hostingDeploy = hostingDeploy;
app.locals.actions = actions;
app.locals.pipelines = pipelines;
app.locals.builds = builds;

// Friendly landing at / — returns an API index. Lets a browser hitting
// the root see "yes this is running" instead of a 404 JSON.
const API_INDEX = {
  service: 'building-api',
  version: '0.1.0',
  description: 'SpinBuild — AI-first microhosting build farm',
  docs: 'https://github.com/JacLight/spinforge (building/README.md)',
  health: '/health',
  metrics: '/metrics',
  routes: {
    deployments:     '/api/deployments',
    jobs:            '/api/jobs',
    customers:       '/api/customers/:id/policy',
    signingProfiles: '/api/signing-profiles',
    sessions:        '/api/sessions',
    runners:         '/api/runners',
    retentionRun:    '/api/admin/retention/run',
    vaultPlatform:   '/api/vault/platform',
    vaultCustomer:   '/api/vault/customers/:customerId/bootstrap',
  },
  internalRoutes: {
    workspaces: '/_internal/workspaces/:jobId',
    artifacts:  '/_internal/artifacts/:jobId',
  },
  note: 'All /api/* and /_internal/* routes require admin auth (Bearer JWT or X-API-Key).',
};
app.get('/', (_req, res) => res.json(API_INDEX));

// /health stays anonymous so Nomad/Consul checks and the load balancer
// can probe without credentials. Everything else requires the same admin
// token (Bearer JWT or X-API-Key) that hosting/api accepts.
app.use('/health', healthRoute);
// /metrics — Prometheus scrape target. Also anonymous so prometheus on
// the same cluster can poll without managing tokens. Mirrors hosting's
// openresty `/_metrics` surface, same prefix convention (`spinbuild_*`
// alongside `spinforge_*`). Must be mounted BEFORE authenticateAdmin.
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', metrics.registry.contentType);
  res.end(await metrics.registry.metrics());
});
app.use('/api', authenticateAdmin, routes);
// Internal mount for bare-metal runners over Tailscale (Mac et al.).
// See routes/internal.js for the security posture — never expose this
// outside the trusted mesh. Also gated by admin auth so a leaked mesh
// hop can't bypass identity.
app.use('/_internal', authenticateAdmin, routes.internal);

app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    method: req.method,
    path: req.originalUrl,
    knownMounts: [
      '/', '/health', '/metrics',
      '/api/deployments', '/api/jobs', '/api/customers/:id/policy',
      '/api/signing-profiles', '/api/sessions', '/api/runners',
      '/api/admin/retention/run',
      '/_internal/workspaces/:jobId', '/_internal/artifacts/:jobId',
    ],
  });
});

app.use((err, _req, res, _next) => {
  logger.error(`unhandled: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'internal_error' });
});

const PORT = Number(process.env.PORT || 8090);
const server = app.listen(PORT, () => {
  logger.info(`building-api listening on :${PORT}`);
  events.publish('service.up', 'building-api', {
    context: { pid: process.pid, port: PORT },
  }).catch(() => {});
  // One-time migration: ensure jobs:recent is populated for pre-existing
  // jobs. Runs after the HTTP listener is up so health checks aren't
  // blocked. Safe to call every boot — no-ops if already populated.
  jobs.backfillRecentIndex({ logger }).catch((err) => {
    logger.warn(`[startup] jobs backfill failed: ${err.message}`);
  });
});

const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down`);
  events.publish('service.down', 'building-api', {
    severity: 'warn',
    context: { signal },
  }).catch(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
