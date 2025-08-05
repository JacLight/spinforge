/**
 * SpinForge - SSL Certificate Management Routes
 */

const express = require('express');
const router = express.Router();
const SSLCacheService = require('../services/SSLCacheService');
const redisClient = require('../utils/redis');

const sslCache = new SSLCacheService(redisClient);

// Cache a specific certificate
router.post('/cache/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const result = await sslCache.cacheCertificate(domain);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cache all certificates
router.post('/cache-all', async (req, res) => {
  try {
    const results = await sslCache.cacheAllCertificates();
    res.json({
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cache statistics
router.get('/cache-stats', async (req, res) => {
  try {
    const stats = await sslCache.getCacheStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Evict certificate from cache
router.delete('/cache/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const result = await sslCache.evictCertificate(domain);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;