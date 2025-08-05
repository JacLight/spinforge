/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */

const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'spinforge-api'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const sitesTotal = new promClient.Gauge({
  name: 'spinforge_sites_total',
  help: 'Total number of sites',
  labelNames: ['type', 'status']
});

const deploymentTotal = new promClient.Counter({
  name: 'spinforge_deployments_total',
  help: 'Total number of deployments',
  labelNames: ['type', 'status']
});

const keydbConnections = new promClient.Gauge({
  name: 'spinforge_keydb_connections',
  help: 'Number of KeyDB connections'
});

const keydbCommands = new promClient.Counter({
  name: 'spinforge_keydb_commands_total',
  help: 'Total KeyDB commands executed',
  labelNames: ['command']
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(sitesTotal);
register.registerMetric(deploymentTotal);
register.registerMetric(keydbConnections);
register.registerMetric(keydbCommands);

// Middleware to track HTTP metrics
const httpMetricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
  });
  
  next();
};

module.exports = {
  register,
  httpMetricsMiddleware,
  metrics: {
    httpRequestDuration,
    httpRequestTotal,
    sitesTotal,
    deploymentTotal,
    keydbConnections,
    keydbCommands
  }
};