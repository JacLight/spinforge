/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const redisClient = require('../utils/redis');
const { execAsync } = require('../utils/docker');

// Basic health check endpoint
router.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'spinforge-api-openresty' });
});

// API health endpoint (for UI compatibility)
router.get('/api', (req, res) => {
  res.json({ 
    status: 'healthy',
    version: '1.0.0',
    service: 'SpinForge Hosting API',
    timestamp: new Date().toISOString()
  });
});

// System health check endpoint
router.get('/system', async (req, res) => {
  const health = {
    status: 'healthy',
    checks: {
      api: { status: 'healthy', message: 'API is running' },
      redis: { status: 'unknown', message: 'Checking...' },
      nginx: { status: 'unknown', message: 'Checking...' }
    },
    timestamp: new Date().toISOString()
  };

  // Check Redis connection
  try {
    // Set a timeout for Redis ping
    const pingPromise = redisClient.ping();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Redis ping timeout')), 2000)
    );
    
    await Promise.race([pingPromise, timeoutPromise]);
    health.checks.redis = { status: 'healthy', message: 'Redis is connected' };
  } catch (error) {
    health.checks.redis = { status: 'unhealthy', message: `Redis connection failed: ${error.message}` };
    health.status = 'unhealthy';
  }

  // Check nginx/openresty health endpoint
  try {
    const response = await axios.get('http://openresty:8081/health', { timeout: 2000 });
    if (response.status === 200) {
      health.checks.nginx = { status: 'healthy', message: 'Nginx is responding' };
    } else {
      health.checks.nginx = { status: 'unhealthy', message: `Nginx returned ${response.status}` };
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.nginx = { status: 'unhealthy', message: `Nginx health check failed: ${error.message}` };
    health.status = 'degraded';
  }

  res.json(health);
});

// Service health checks
async function getServiceHealth() {
  const services = [];
  
  // Check KeyDB
  try {
    await redisClient.ping();
    services.push({
      name: 'KeyDB',
      status: 'healthy',
      uptime: Date.now() / 1000,
      lastCheck: new Date().toISOString()
    });
  } catch (error) {
    services.push({
      name: 'KeyDB',
      status: 'unhealthy',
      uptime: 0,
      lastCheck: new Date().toISOString(),
      details: { error: error.message }
    });
  }
  
  // Check OpenResty
  try {
    await execAsync('docker ps | grep openresty');
    services.push({
      name: 'OpenResty',
      status: 'healthy',
      uptime: Date.now() / 1000,
      lastCheck: new Date().toISOString()
    });
  } catch (error) {
    services.push({
      name: 'OpenResty',
      status: 'unhealthy',
      uptime: 0,
      lastCheck: new Date().toISOString(),
      details: { error: 'Container not running' }
    });
  }
  
  // Check SpinHub API (self-check)
  services.push({
    name: 'SpinHub',
    status: 'healthy',
    uptime: process.uptime(),
    lastCheck: new Date().toISOString()
  });
  
  return services;
}

// Health check endpoint with service details
router.get('/_health', async (req, res) => {
  try {
    const services = await getServiceHealth();
    const allHealthy = services.every(s => s.status === 'healthy');
    
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      services: services,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;