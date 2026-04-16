/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */

// The JWT signing secret must be resolved before any module that reads
// process.env.ADMIN_TOKEN_SECRET is loaded (notably utils/admin-auth and
// services/AdminService). Do this first, above all other requires.
require('./utils/admin-bootstrap').loadOrCreateJwtSecret();

const express = require('express');
const corsMiddleware = require('./utils/cors');
const routes = require('./routes');
const { register, httpMetricsMiddleware } = require('./utils/prometheus');
const logger = require('./utils/logger');
const { authenticateAdminOrPublic, adminService } = require('./utils/admin-auth');
const { ensureSetupTokenIfNeeded } = require('./utils/admin-bootstrap');

const app = express();
app.use(express.json());

// Apply CORS middleware
app.use(corsMiddleware);

// Apply Prometheus metrics middleware
app.use(httpMetricsMiddleware);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Gate every /api/* mount behind the admin token. Paths listed in
// utils/admin-auth.js PUBLIC_API_PATHS (e.g. /api/health) stay public.
// Customer dashboard traffic uses /_api/customer/* which has its own auth.
app.use('/api', authenticateAdminOrPublic);

// Audit admin-authenticated activity. Covers writes on /api/* and
// everything under /_admin/* (including read endpoints since those are
// already low-volume and security-relevant).
const { auditAdminActivity } = require('./utils/audit');
app.use('/api', auditAdminActivity());
app.use('/_admin', auditAdminActivity());

// Mount all API routes
app.use('/api', routes);

// Also mount metric routes at root level for backward compatibility
const metricsRoutes = require('./routes/metrics');
app.use('/_metrics', metricsRoutes);

// Mount admin routes
const adminRoutes = require('./routes/admin');
app.use('/_admin', adminRoutes);

// Mount customer API routes
const customerRoutes = require('./routes/customer');
app.use('/_api/customer', customerRoutes);

// Mount auth routes
const authRoutes = require('./routes/auth');
app.use('/_auth', authRoutes);

// Mount third-party partner token exchange routes. This tree is NOT under
// /api/* because it's gated by X-Partner-Key (a per-partner credential),
// not by admin auth. See routes/partners.js for the exchange flow.
const partnersRoutes = require('./routes/partners');
app.use('/_partners', partnersRoutes);

// Mount clone and template routes
const cloneDeployRoutes = require('./routes/clone-deploy');
app.use('/api/clone', cloneDeployRoutes);

// Mount template library routes
const templateLibraryRoutes = require('./routes/template-library');
app.use('/api/template-library', templateLibraryRoutes);

// MCP Discovery Routes
const mcpRoutes = require('./routes/mcp');
app.use('/api/mcp', mcpRoutes);

// MCP Server (actual protocol implementation) — mounted at /mcp (not /api/mcp)
// and kept public so unauthenticated MCP clients can still perform protocol handshakes.
const mcpServer = require('./routes/mcp-server');
app.use('/mcp', mcpServer);

// Static file management routes
const staticRoutes = require('./routes/static');
app.use('/api/sites', staticRoutes);

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// JSON-only 404. Default Express returns "Cannot GET /foo" as HTML which
// is useless to API clients. This catches every unmatched route on the
// api process — anything outside /api/*, /_admin/*, /_api/*, /_partners/*,
// /_auth/*, /_metrics/*, /metrics, /health.
//
// 404 here means: the api process is up and reachable, but no route is
// registered for this METHOD on this PATH. Most common causes:
//   * Wrong HTTP method (POST endpoint hit with GET, etc.)
//   * Typo in the path (e.g. /partners/auth instead of /_partners/auth)
//   * Hitting an endpoint that was renamed or removed
//
// We surface the known mounts so the caller can see what *does* exist.
const KNOWN_MOUNTS = [
  '/api/*',          // admin-gated platform API (sites, ssl, metrics, …)
  '/_admin/*',       // admin user mgmt, partner mgmt, settings, tokens
  '/_api/customer/*',// customer-scoped surface used by partners + dashboard
  '/_partners/*',    // third-party partner exchange (POST /_partners/auth)
  '/_auth/*',        // customer login/register
  '/_metrics/*',     // metrics passthrough
  '/metrics',        // prometheus scrape
  '/health',         // process liveness
];
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found on the SpinForge API',
    method: req.method,
    path:   req.originalUrl,
    hint:   'The api is running but no handler matches this method+path. Check for a typo, wrong HTTP method, or a removed endpoint.',
    knownMounts: KNOWN_MOUNTS,
  });
});

// JSON-only error handler. Keep the body small — never leak stack traces
// to API consumers, log them server-side instead.
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error:   err.expose ? err.message : 'Internal server error',
    details: err.expose ? err.details : undefined,
  });
});

// Start the server. We wrap app in an explicit HTTP server so the
// platform WebSocket can share the same port (attached via 'upgrade').
const http = require('http');
const PORT = process.env.PORT || 8080;
const server = http.createServer(app);
server.listen(PORT, async () => {
  logger.info(`SpinForge API (OpenResty version) listening on port ${PORT}`);

  try {
    await ensureSetupTokenIfNeeded(adminService);
  } catch (error) {
    logger.error('Failed to run admin setup-token check:', error);
  }

  try {
    const sitesIndex = require('./utils/sites-index');
    const result = await sitesIndex.ensureIndexOnBoot();
    if (!result.skipped) {
      logger.info(`sites-index: rebuilt ${result.domains} domains across ${result.customers} customers`);
    }
  } catch (error) {
    logger.error('Failed to warm sites index:', error);
  }

  // ─── Notifications: seed templates + start send worker ─────────────
  try {
    const redisClient = require('./utils/redis');
    const EmailTemplateService = require('./services/EmailTemplateService');
    const EmailWorker = require('./services/EmailWorker');
    const NotificationService = require('./services/NotificationService');

    const templates = new EmailTemplateService(redisClient);
    const seed = await templates.seedDefaults();
    if (seed.created > 0) {
      logger.info(`email-templates: seeded ${seed.created} default(s) (${seed.total} total)`);
    }

    const notifications = new NotificationService(redisClient, { logger });
    const worker = new EmailWorker(redisClient, { logger });
    worker.start();
    logger.info('email-worker: started');

    app.locals.notifications = notifications;
    app.locals.emailWorker = worker;
  } catch (error) {
    logger.error('Failed to initialize notifications subsystem:', error);
  }

  // ─── SSL: warm hot-cache and start the renewal scheduler ────────────
  // Replaces the old SSLCacheService 5-minute polling loop AND the certbot
  // container's renewal cron with a single Node-side scheduler.
  try {
    const redisClient = require('./utils/redis');
    const CertStore = require('./services/CertStore');
    const AcmeService = require('./services/AcmeService');
    const CertRenewalScheduler = require('./services/CertRenewalScheduler');

    const certStore = new CertStore(redisClient, { logger });
    const acmeService = new AcmeService({ redis: redisClient, certStore, logger });
    const renewalScheduler = new CertRenewalScheduler({
      redis: redisClient,
      certStore,
      acmeService,
      logger,
    });

    logger.info('SSL: warming certificate hot-cache...');
    await certStore.warmupHotCache();

    renewalScheduler.start();
    logger.info('SSL: ACME renewal scheduler started');

    // Expose for graceful shutdown below
    app.locals.acme = { certStore, acmeService, renewalScheduler };
  } catch (error) {
    logger.error('Failed to initialize SSL/ACME services:', error);
  }

  // ─── Platform: heartbeat + events + WebSocket bridge ───────────────
  // Together these give the Platform Management UI a live view of
  // every node in the cluster without polling. Heartbeat writes this
  // node's state every 30s. EventStream is the shared "what just
  // happened" feed. WebSocket fans both out to connected admins.
  try {
    const redisClient = require('./utils/redis');
    const NodeHeartbeat = require('./services/NodeHeartbeat');
    const EventStream = require('./services/EventStream');
    const { mountPlatformWebSocket } = require('./services/PlatformWebSocket');
    const { identify } = require('./utils/admin-auth');

    const events = new EventStream(redisClient, { logger });
    const heartbeat = new NodeHeartbeat(redisClient, { logger, eventStream: events });
    await heartbeat.start();

    // Container crash watchdog — single cluster-wide loop (cluster
    // lock inside) that scans agent heartbeats and fires alerts +
    // emails when any customer container falls out of 'running'.
    const ContainerWatchdog = require('./services/ContainerWatchdog');
    const watchdog = new ContainerWatchdog(redisClient, { logger });
    watchdog.start();

    mountPlatformWebSocket({
      httpServer: server,
      redis: redisClient,
      authenticator: identify,
      logger,
    });

    app.locals.platform = { heartbeat, events, watchdog };
  } catch (error) {
    logger.error('Failed to initialize platform subsystem:', error);
  }

  process.on('SIGTERM', async () => {
    try { app.locals.acme?.renewalScheduler?.stop(); } catch (_) {}
    try { await app.locals.platform?.heartbeat?.stop(); } catch (_) {}
    try { app.locals.platform?.watchdog?.stop(); } catch (_) {}
    process.exit(0);
  });
});