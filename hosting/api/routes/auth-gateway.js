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
      return res.json({ enabled: false, authRules: { paths: [], apiKeys: [], oauth: null } });
    }
    
    // Get all auth configuration
    const [paths, keysData, oauth] = await Promise.all([
      redisClient.get(`auth:${domain}:paths`),
      redisClient.hGetAll(`auth:${domain}:keys`),
      redisClient.get(`auth:${domain}:oauth`)
    ]);
    
    // Parse stored data
    const pathRules = paths ? JSON.parse(paths) : [];
    const apiKeys = Object.entries(keysData || {}).map(([id, data]) => {
      const keyInfo = JSON.parse(data);
      return { id, ...keyInfo };
    });
    const oauthConfig = oauth ? JSON.parse(oauth) : null;
    
    res.json({
      enabled: true,
      authRules: {
        paths: pathRules,
        apiKeys: apiKeys.map(k => ({
          id: k.id,
          name: k.name,
          createdAt: k.createdAt,
          lastUsed: k.lastUsed,
          useCount: k.useCount
          // Never return the hashed key
        })),
        oauth: oauthConfig
      }
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

// Add path rule
router.post('/sites/:domain/auth/paths', async (req, res) => {
  try {
    const domain = req.params.domain;
    const rule = req.body;
    
    if (!rule.pattern) {
      return res.status(400).json({ error: 'Path pattern is required' });
    }
    
    // Generate rule ID
    rule.id = generateId();
    rule.createdAt = new Date().toISOString();
    
    // Get existing paths
    const existingPaths = await redisClient.get(`auth:${domain}:paths`);
    const paths = existingPaths ? JSON.parse(existingPaths) : [];
    
    // Add new rule
    paths.push(rule);
    
    // Sort by specificity (more specific patterns first)
    paths.sort((a, b) => {
      // Exact matches first
      if (!a.pattern.includes('*') && b.pattern.includes('*')) return -1;
      if (a.pattern.includes('*') && !b.pattern.includes('*')) return 1;
      // Then by length (longer = more specific)
      return b.pattern.length - a.pattern.length;
    });
    
    // Store in Redis
    await redisClient.set(`auth:${domain}:paths`, JSON.stringify(paths));
    
    // Enable auth for this domain
    await redisClient.set(`auth:${domain}:enabled`, '1');
    
    // Invalidate OpenResty cache
    await invalidateAuthCache(domain);
    
    res.json({ rule });
  } catch (error) {
    console.error('Failed to add path rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete path rule
router.delete('/sites/:domain/auth/paths/:ruleId', async (req, res) => {
  try {
    const { domain, ruleId } = req.params;
    
    // Get existing paths
    const existingPaths = await redisClient.get(`auth:${domain}:paths`);
    if (!existingPaths) {
      return res.status(404).json({ error: 'Path rule not found' });
    }
    
    const paths = JSON.parse(existingPaths);
    const updatedPaths = paths.filter(p => p.id !== ruleId);
    
    if (updatedPaths.length === paths.length) {
      return res.status(404).json({ error: 'Path rule not found' });
    }
    
    // Update or delete
    if (updatedPaths.length > 0) {
      await redisClient.set(`auth:${domain}:paths`, JSON.stringify(updatedPaths));
    } else {
      await redisClient.del(`auth:${domain}:paths`);
      
      // Check if any auth rules remain
      const remainingKeys = await redisClient.hLen(`auth:${domain}:keys`);
      if (remainingKeys === 0) {
        // No auth rules left, disable auth for performance
        await redisClient.del(`auth:${domain}:enabled`);
      }
    }
    
    // Invalidate OpenResty cache
    await invalidateAuthCache(domain);
    
    res.json({ message: 'Path rule deleted' });
  } catch (error) {
    console.error('Failed to delete path rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update OAuth configuration
router.put('/sites/:domain/auth/oauth', async (req, res) => {
  try {
    const domain = req.params.domain;
    const oauthConfig = req.body;
    
    if (!oauthConfig.authUrl) {
      // If clearing OAuth config
      await redisClient.del(`auth:${domain}:oauth`);
    } else {
      // Store in Redis
      await redisClient.set(`auth:${domain}:oauth`, JSON.stringify(oauthConfig));
    }
    
    // Invalidate OpenResty cache
    await invalidateAuthCache(domain);
    
    res.json({ message: 'OAuth configuration saved' });
  } catch (error) {
    console.error('Failed to save OAuth config:', error);
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