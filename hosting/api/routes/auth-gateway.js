/**
 * SpinForge - API Gateway Authentication Routes
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const redisClient = require('../utils/redis');

// Helper to generate unique ID
const generateId = () => crypto.randomBytes(8).toString('hex');

// Helper to hash API keys
const hashApiKey = (key) => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

// Get auth configuration for a domain
router.get('/sites/:domain/auth', async (req, res) => {
  try {
    const domain = req.params.domain;
    
    // Check if auth is enabled for this domain
    const enabled = await redisClient.get(`auth:${domain}:enabled`);
    if (!enabled) {
      return res.json({ enabled: false, routes: [], apiKeys: [] });
    }
    
    // Get all auth configuration
    const [routesData, keysData] = await Promise.all([
      redisClient.get(`auth:${domain}:routes`),
      redisClient.hGetAll(`auth:${domain}:keys`)
    ]);
    
    // Parse stored data
    const routes = routesData ? JSON.parse(routesData) : [];
    const apiKeys = Object.entries(keysData || {}).map(([id, data]) => {
      const keyInfo = JSON.parse(data);
      return { id, ...keyInfo };
    });
    
    res.json({
      enabled: true,
      routes: routes,
      apiKeys: apiKeys.map(k => ({
        id: k.id,
        name: k.name,
        createdAt: k.createdAt,
        lastUsed: k.lastUsed,
        useCount: k.useCount
        // Never return the hashed key
      }))
    });
  } catch (error) {
    console.error('Failed to get auth config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add API key
router.post('/sites/:domain/auth/keys', async (req, res) => {
  try {
    const domain = req.params.domain;
    const { name, key } = req.body;
    
    if (!name || !key) {
      return res.status(400).json({ error: 'Name and key are required' });
    }
    
    // Generate ID and hash the key
    const keyId = generateId();
    const hashedKey = hashApiKey(key);
    
    const keyInfo = {
      name,
      hashedKey,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      useCount: 0
    };
    
    // Store in Redis
    await redisClient.hSet(
      `auth:${domain}:keys`,
      keyId,
      JSON.stringify(keyInfo)
    );
    
    // Enable auth for this domain
    await redisClient.set(`auth:${domain}:enabled`, '1');
    
    // Invalidate OpenResty cache
    await invalidateAuthCache(domain);
    
    res.json({
      keyInfo: {
        id: keyId,
        name: keyInfo.name,
        createdAt: keyInfo.createdAt,
        lastUsed: keyInfo.lastUsed,
        useCount: keyInfo.useCount
      }
    });
  } catch (error) {
    console.error('Failed to add API key:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete API key
router.delete('/sites/:domain/auth/keys/:keyId', async (req, res) => {
  try {
    const { domain, keyId } = req.params;
    
    await redisClient.hDel(`auth:${domain}:keys`, keyId);
    
    // Check if any auth rules remain
    const remainingKeys = await redisClient.hLen(`auth:${domain}:keys`);
    const paths = await redisClient.get(`auth:${domain}:paths`);
    
    if (remainingKeys === 0 && !paths) {
      // No auth rules left, disable auth for performance
      await redisClient.del(`auth:${domain}:enabled`);
    }
    
    // Invalidate OpenResty cache
    await invalidateAuthCache(domain);
    
    res.json({ message: 'API key deleted' });
  } catch (error) {
    console.error('Failed to delete API key:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add route with auth configuration
router.post('/sites/:domain/auth/routes', async (req, res) => {
  try {
    const domain = req.params.domain;
    const route = req.body;
    
    if (!route.pattern) {
      return res.status(400).json({ error: 'Route pattern is required' });
    }
    
    // Generate route ID
    route.id = generateId();
    route.createdAt = new Date().toISOString();
    
    // Get existing routes
    const existingRoutes = await redisClient.get(`auth:${domain}:routes`);
    const routes = existingRoutes ? JSON.parse(existingRoutes) : [];
    
    // Add new route
    routes.push(route);
    
    // Sort by specificity (more specific patterns first)
    routes.sort((a, b) => {
      // Exact matches first
      if (!a.pattern.includes('*') && b.pattern.includes('*')) return -1;
      if (a.pattern.includes('*') && !b.pattern.includes('*')) return 1;
      // Then by length (longer = more specific)
      return b.pattern.length - a.pattern.length;
    });
    
    // Store in Redis
    await redisClient.set(`auth:${domain}:routes`, JSON.stringify(routes));
    
    // Enable auth for this domain
    await redisClient.set(`auth:${domain}:enabled`, '1');
    
    // Invalidate OpenResty cache
    await invalidateAuthCache(domain);
    
    res.json({ route });
  } catch (error) {
    console.error('Failed to add route:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update route
router.put('/sites/:domain/auth/routes', async (req, res) => {
  try {
    const domain = req.params.domain;
    const route = req.body;
    
    if (!route.id || !route.pattern) {
      return res.status(400).json({ error: 'Route ID and pattern are required' });
    }
    
    // Get existing routes
    const existingRoutes = await redisClient.get(`auth:${domain}:routes`);
    const routes = existingRoutes ? JSON.parse(existingRoutes) : [];
    
    // Find and update the route
    const index = routes.findIndex(r => r.id === route.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    routes[index] = { ...routes[index], ...route };
    
    // Re-sort by specificity
    routes.sort((a, b) => {
      if (!a.pattern.includes('*') && b.pattern.includes('*')) return -1;
      if (a.pattern.includes('*') && !b.pattern.includes('*')) return 1;
      return b.pattern.length - a.pattern.length;
    });
    
    // Store in Redis
    await redisClient.set(`auth:${domain}:routes`, JSON.stringify(routes));
    
    // Invalidate OpenResty cache
    await invalidateAuthCache(domain);
    
    res.json({ route: routes[index] });
  } catch (error) {
    console.error('Failed to update route:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete route
router.delete('/sites/:domain/auth/routes/:routeId', async (req, res) => {
  try {
    const { domain, routeId } = req.params;
    
    // Get existing routes
    const existingRoutes = await redisClient.get(`auth:${domain}:routes`);
    if (!existingRoutes) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    const routes = JSON.parse(existingRoutes);
    const updatedRoutes = routes.filter(r => r.id !== routeId);
    
    if (updatedRoutes.length === routes.length) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    // Update or delete
    if (updatedRoutes.length > 0) {
      await redisClient.set(`auth:${domain}:routes`, JSON.stringify(updatedRoutes));
    } else {
      await redisClient.del(`auth:${domain}:routes`);
      
      // Check if any auth rules remain
      const remainingKeys = await redisClient.hLen(`auth:${domain}:keys`);
      if (remainingKeys === 0) {
        // No auth rules left, disable auth for performance
        await redisClient.del(`auth:${domain}:enabled`);
      }
    }
    
    // Invalidate OpenResty cache
    await invalidateAuthCache(domain);
    
    res.json({ message: 'Route deleted' });
  } catch (error) {
    console.error('Failed to delete route:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear all auth configuration
router.delete('/sites/:domain/auth/clear', async (req, res) => {
  try {
    const domain = req.params.domain;
    
    // Clear all auth data
    await Promise.all([
      redisClient.del(`auth:${domain}:enabled`),
      redisClient.del(`auth:${domain}:routes`),
      redisClient.del(`auth:${domain}:keys`),
      redisClient.del(`auth:${domain}:oauth`),
      redisClient.del(`auth:${domain}:customAuth`),
      redisClient.del(`auth:${domain}:paths`)
    ]);
    
    // Invalidate OpenResty cache
    await invalidateAuthCache(domain);
    
    res.json({ message: 'Auth configuration cleared' });
  } catch (error) {
    console.error('Failed to clear auth config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate API key (internal endpoint for testing)
router.post('/sites/:domain/auth/validate', async (req, res) => {
  try {
    const domain = req.params.domain;
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    const hashedKey = hashApiKey(key);
    const keysData = await redisClient.hGetAll(`auth:${domain}:keys`);
    
    for (const [keyId, data] of Object.entries(keysData || {})) {
      const keyInfo = JSON.parse(data);
      if (keyInfo.hashedKey === hashedKey) {
        // Update usage stats
        keyInfo.lastUsed = new Date().toISOString();
        keyInfo.useCount = (keyInfo.useCount || 0) + 1;
        await redisClient.hSet(
          `auth:${domain}:keys`,
          keyId,
          JSON.stringify(keyInfo)
        );
        
        return res.json({ valid: true, keyId, name: keyInfo.name });
      }
    }
    
    res.status(401).json({ valid: false, error: 'Invalid API key' });
  } catch (error) {
    console.error('Failed to validate API key:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper to invalidate OpenResty cache
async function invalidateAuthCache(domain) {
  try {
    // Set a cache invalidation flag that OpenResty will check
    await redisClient.setEx(`auth:${domain}:cache_invalid`, 5, '1');
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
  }
}

module.exports = router;