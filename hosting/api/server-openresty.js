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

// MCP Discovery Routes
const mcpRoutes = require('./routes/mcp');
app.use('/api/mcp', mcpRoutes);

// MCP Server (actual protocol implementation)
const mcpServer = require('./routes/mcp-server');
app.use('/mcp', mcpServer);

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
  
  // Initialize SSL certificate cache
  try {
    const SSLCacheService = require('./services/SSLCacheService');
    const redisClient = require('./utils/redis');
    const sslCache = new SSLCacheService(redisClient);
    
    logger.info('Initializing SSL certificate cache...');
    await sslCache.cacheAllCertificates();
    
    // Start watching for certificate changes
    sslCache.watchCertificates();
    logger.info('SSL certificate cache initialized');
  } catch (error) {
    logger.error('Failed to initialize SSL cache:', error);
  }
});