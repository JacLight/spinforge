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

// Backend health check endpoint for load balancers
router.post('/check', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    // Parse URL to check if it's a local service
    const urlObj = new URL(url);
    let checkUrl = url;
    
    // If it's localhost or a .localhost domain, check via internal network
    if (urlObj.hostname === 'localhost' || urlObj.hostname.endsWith('.localhost')) {
      // Replace with internal docker network URL using OpenResty
      checkUrl = `http://openresty:8081${urlObj.pathname}${urlObj.search}`;
      // Set host header for proper routing
      const hostHeader = urlObj.hostname;
      
      const response = await axios.get(checkUrl, {
        timeout: 5000,
        headers: {
          'Host': hostHeader
        },
        validateStatus: () => true // Accept any status code
      });
      
      const healthy = response.status >= 200 && response.status < 500;
      
      res.json({
        healthy,
        status: response.status,
        statusText: response.statusText,
        url: url,
        responseTime: response.headers['x-response-time'] || null,
        details: {
          headers: response.headers,
          checkedUrl: checkUrl
        }
      });
    } else {
      // External URL - check directly
      const startTime = Date.now();
      const response = await axios.get(url, {
        timeout: 5000,
        validateStatus: () => true // Accept any status code
      });
      const responseTime = Date.now() - startTime;
      
      const healthy = response.status >= 200 && response.status < 500;
      
      res.json({
        healthy,
        status: response.status,
        statusText: response.statusText,
        url: url,
        responseTime: responseTime,
        details: {
          headers: response.headers
        }
      });
    }
  } catch (error) {
    // Connection error or timeout
    res.json({
      healthy: false,
      status: 0,
      statusText: 'Connection Failed',
      url: url,
      error: error.message,
      details: {
        code: error.code,
        timeout: error.code === 'ECONNABORTED'
      }
    });
  }
});

module.exports = router;