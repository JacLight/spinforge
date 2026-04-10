/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */

const express = require('express');
const corsMiddleware = require('./utils/cors');
const routes = require('./routes');
const { register, httpMetricsMiddleware } = require('./utils/prometheus');
const logger = require('./utils/logger');
const { authenticateAdminOrPublic } = require('./utils/admin-auth');

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

// Mount operations routes (now protected by the /api middleware above)
const operationsRoutes = require('./routes/operations');
app.use('/api/operations', operationsRoutes);

// Mount image management routes
const imagesRoutes = require('./routes/images');
app.use('/api/images', imagesRoutes);

// Mount customer API routes
const customerRoutes = require('./routes/customer');
app.use('/_api/customer', customerRoutes);

// Mount auth routes
const authRoutes = require('./routes/auth');
app.use('/_auth', authRoutes);

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
  
  // Start container recovery service
  try {
    const containerRecovery = require('./services/container-recovery');
    await containerRecovery.start();
    logger.info('Container recovery service started');
  } catch (error) {
    logger.error('Failed to start container recovery:', error);
  }
  
  // Resolve container IPs on startup
  try {
    const ContainerIPResolver = require('./resolve-container-ips');
    const resolver = new ContainerIPResolver();
    await resolver.connect();
    const stats = await resolver.resolveAllContainers();
    await resolver.disconnect();
    logger.info(`Container IPs resolved on startup: ${stats.updated} updated, ${stats.failed} failed`);
  } catch (error) {
    logger.error('Failed to resolve container IPs on startup:', error);
  }

  // Start Container IP Monitor Service for real-time updates
  try {
    const ContainerIPMonitor = require('./services/container-ip-monitor');
    const ipMonitor = new ContainerIPMonitor();
    await ipMonitor.start();
    logger.info('Container IP Monitor Service started - watching for container events');

    // Graceful shutdown — stop background services in reverse order of start
    process.on('SIGTERM', () => {
      try { app.locals.acme?.renewalScheduler?.stop(); } catch (_) {}
      try { ipMonitor.stop(); } catch (_) {}
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start Container IP Monitor:', error);
  }
});