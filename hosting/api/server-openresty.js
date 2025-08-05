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
app.listen(PORT, () => {
  logger.info(`SpinForge API (OpenResty version) listening on port ${PORT}`);
});