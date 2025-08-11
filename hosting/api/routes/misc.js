/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis');

// Get statistics
router.get('/stats', async (req, res) => {
  try {
    const keys = await redisClient.keys('site:*');
    const stats = {
      total_sites: 0,
      static_sites: 0,
      proxy_sites: 0,
      container_sites: 0,
      loadbalancer_sites: 0,
      enabled_sites: 0,
      disabled_sites: 0
    };
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        try {
          const site = JSON.parse(data);
          stats.total_sites++;
          
          // Count by type
          if (site.type === 'static') stats.static_sites++;
          else if (site.type === 'proxy') stats.proxy_sites++;
          else if (site.type === 'container') stats.container_sites++;
          else if (site.type === 'loadbalancer') stats.loadbalancer_sites++;
          
          // Count by status
          if (site.enabled !== false) stats.enabled_sites++;
          else stats.disabled_sites++;
        } catch (e) {
          console.error(`Error parsing site data for ${key}:`, e);
        }
      }
    }
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all routes (returns sites formatted as routes for UI compatibility)
router.get('/routes', async (req, res) => {
  try {
    const keys = await redisClient.keys('site:*');
    const routes = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        try {
          const site = JSON.parse(data);
          // Format site as route for UI compatibility
          routes.push({
            domain: site.domain || '',
            customerId: site.customerId || 'unknown',
            spinletId: site.domain, // Use id as primary
            buildPath: site.static_path || '/',
            framework: site.type,
            config: {
              type: site.type,
              target: site.target,
              enabled: site.enabled !== false
            }
          });
        } catch (e) {
          console.error(`Error parsing site data for ${key}:`, e);
        }
      }
    }
    
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;