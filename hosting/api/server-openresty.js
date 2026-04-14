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

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  logger.info(`SpinForge API (OpenResty version) listening on port ${PORT}`);

  try {
    await ensureSetupTokenIfNeeded(adminService);
  } catch (error) {
    logger.error('Failed to run admin setup-token check:', error);
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

  process.on('SIGTERM', () => {
    try { app.locals.acme?.renewalScheduler?.stop(); } catch (_) {}
    process.exit(0);
  });
});