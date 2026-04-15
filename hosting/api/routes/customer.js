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
const sitesIndex = require('../utils/sites-index');
const { checkStaticFiles } = require('../utils/site-helpers');
const CustomerTokenService = require('../services/CustomerTokenService');

const customerTokenService = new CustomerTokenService(redisClient);

// Customer authentication middleware. Accepts (in order):
//   1. apitoken:<token>          → legacy short-lived API token from /_auth/customer/login
//   2. session:<token>           → browser session from /_auth/customer/login
//   3. sfc_<token>               → long-lived customer API token from /_api/customer/tokens
const authenticateCustomer = async (req, res, next) => {
  const authToken = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-auth-token'];

  if (!authToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // 1+2. Legacy session/apitoken paths (cheapest, single Redis GET each)
    const tokenData = await redisClient.get(`apitoken:${authToken}`);
    if (tokenData) {
      const token = JSON.parse(tokenData);
      req.customerId = token.customerId;
      req.userId = token.userId;
      req.userEmail = token.email;
    } else {
      const sessionData = await redisClient.get(`session:${authToken}`);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        req.customerId = session.customerId;
        req.userId = session.userId;
        req.userEmail = session.email;
      } else {
        // 3. Long-lived customer API token
        const apiToken = await customerTokenService.validatePlaintext(authToken);
        if (!apiToken) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.customerId = apiToken.customerId;
        req.userId = apiToken.userId;
        req.userEmail = apiToken.userEmail;
        req.apiTokenId = apiToken.tokenId;
      }
    }

    if (!req.customerId) {
      return res.status(401).json({ error: 'Invalid customer token' });
    }

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Apply authentication to all routes
router.use(authenticateCustomer);

// ─── Customer API Tokens ───────────────────────────────────────────────────
// Per-customer long-lived tokens. Each token is scoped to its owning customer
// and grants the same access as that customer's session.

// List the customer's tokens
router.get('/tokens', async (req, res) => {
  try {
    const tokens = await customerTokenService.listTokens(req.customerId);
    res.json({ tokens });
  } catch (error) {
    console.error('Failed to list customer tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new customer API token. Plaintext returned exactly once.
router.post('/tokens', async (req, res) => {
  try {
    const { name, expiry } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Token name is required' });
    }
    const created = await customerTokenService.createToken({
      customerId: req.customerId,
      userId: req.userId,
      userEmail: req.userEmail,
      name,
      expiry,
    });
    res.status(201).json(created);
  } catch (error) {
    if (error.code === 'DUPLICATE_NAME') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Failed to create customer token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk revoke. NOTE: must be defined before /tokens/:id so the parameterized
// route does not capture the bare DELETE on /tokens.
router.delete('/tokens', async (req, res) => {
  try {
    const keepCurrent = req.query.keepCurrent === '1' || req.query.keepCurrent === 'true';
    const exceptId = keepCurrent ? req.apiTokenId : null;
    const revoked = await customerTokenService.deleteAll(req.customerId, { exceptId });
    res.json({
      success: true,
      revoked,
      kept: exceptId ? 1 : 0,
    });
  } catch (error) {
    console.error('Failed to bulk-revoke customer tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

// Revoke a single customer token by id
router.delete('/tokens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (req.apiTokenId === id) {
      return res.status(400).json({
        error: 'A token cannot revoke itself. Use a different token or session.',
      });
    }
    const ok = await customerTokenService.deleteToken(req.customerId, id);
    if (!ok) {
      return res.status(404).json({ error: 'Token not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete customer token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get customer's own sites/deployments
router.get('/deployments', async (req, res) => {
  try {
    const { customerId } = req;
    const keys = await sitesIndex.listAllSiteKeys();
    const deployments = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const site = JSON.parse(data);
        if (site.customerId === customerId) {
          // Check static files if needed
          const siteWithFiles = checkStaticFiles(site);
          
          deployments.push({
            id: site.domain,
            domain: site.domain,
            type: site.type,
            status: site.enabled ? 'active' : 'inactive',
            createdAt: site.createdAt,
            updatedAt: site.updatedAt,
            config: {
              ...site,
              files_exist: siteWithFiles.files_exist,
              actual_domain: siteWithFiles.actual_domain
            }
          });
        }
      }
    }
    
    // Sort by creation date (newest first)
    deployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({
      deployments,
      total: deployments.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer's domains
router.get('/domains', async (req, res) => {
  try {
    const { customerId } = req;
    const keys = await sitesIndex.listAllSiteKeys();
    const domains = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const site = JSON.parse(data);
        if (site.customerId === customerId) {
          domains.push({
            domain: site.domain,
            aliases: site.aliases || [],
            type: site.type,
            enabled: site.enabled !== false,
            ssl: site.ssl || false,
            createdAt: site.createdAt
          });
          
          // Add aliases as separate entries
          if (site.aliases && site.aliases.length > 0) {
            site.aliases.forEach(alias => {
              domains.push({
                domain: alias,
                isPrimary: false,
                primaryDomain: site.domain,
                type: site.type,
                enabled: site.enabled !== false,
                ssl: site.ssl || false,
                createdAt: site.createdAt
              });
            });
          }
        }
      }
    }
    
    res.json({
      domains,
      total: domains.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer's resource usage
router.get('/usage', async (req, res) => {
  try {
    const { customerId } = req;
    const keys = await sitesIndex.listAllSiteKeys();
    
    let siteCount = 0;
    let containerCount = 0;
    let totalBandwidth = 0;
    let totalStorage = 0;
    const siteTypes = {};
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const site = JSON.parse(data);
        if (site.customerId === customerId) {
          siteCount++;
          
          // Count by type
          siteTypes[site.type] = (siteTypes[site.type] || 0) + 1;
          
          if (site.type === 'container') {
            containerCount++;
          }
          
          // Get metrics for this site
          const metricsData = await redisClient.hGetAll(`metrics:${site.domain}`);
          if (metricsData) {
            totalBandwidth += parseInt(metricsData.totalBandwidth || 0);
          }
        }
      }
    }
    
    res.json({
      sites: {
        total: siteCount,
        byType: siteTypes
      },
      containers: {
        total: containerCount,
        running: containerCount // TODO: Check actual container status
      },
      bandwidth: {
        used: totalBandwidth,
        limit: 1000 * 1024 * 1024 * 1024, // 1TB default
        unit: 'bytes'
      },
      storage: {
        used: totalStorage,
        limit: 100 * 1024 * 1024 * 1024, // 100GB default
        unit: 'bytes'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deploy new application (simplified for now)
router.post('/deploy', async (req, res) => {
  try {
    const { customerId } = req;
    const { domain, type, config } = req.body;
    
    if (!domain || !type) {
      return res.status(400).json({ error: 'Domain and type are required' });
    }
    
    // Check if domain already exists
    const exists = await redisClient.exists(`site:${domain}`);
    if (exists) {
      return res.status(409).json({ error: 'Domain already exists' });
    }
    
    // Create the site
    const site = {
      domain,
      type,
      customerId,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...config
    };
    
    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    
    res.status(201).json({
      message: 'Deployment created',
      deployment: {
        id: domain,
        domain,
        type,
        status: 'pending',
        createdAt: site.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific deployment
router.get('/deployments/:id', async (req, res) => {
  try {
    const { customerId } = req;
    const { id } = req.params;
    
    const data = await redisClient.get(`site:${id}`);
    if (!data) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    // Check static files if needed
    const siteWithFiles = checkStaticFiles(site);
    
    res.json({
      id: site.domain,
      domain: site.domain,
      type: site.type,
      status: site.enabled ? 'active' : 'inactive',
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
      config: {
        ...site,
        files_exist: siteWithFiles.files_exist,
        actual_domain: siteWithFiles.actual_domain
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update deployment
router.put('/deployments/:id', async (req, res) => {
  try {
    const { customerId } = req;
    const { id } = req.params;
    const updates = req.body;
    
    const data = await redisClient.get(`site:${id}`);
    if (!data) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    // Apply updates
    const updatedSite = {
      ...site,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await redisClient.set(`site:${id}`, JSON.stringify(updatedSite));
    
    res.json({
      message: 'Deployment updated',
      deployment: {
        id: updatedSite.domain,
        domain: updatedSite.domain,
        type: updatedSite.type,
        status: updatedSite.enabled ? 'active' : 'inactive',
        updatedAt: updatedSite.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === SITES ENDPOINTS (used by UI) ===

// List customer's sites
router.get('/sites', async (req, res) => {
  try {
    const { customerId } = req;
    const keys = await sitesIndex.listAllSiteKeys();
    const sites = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const site = JSON.parse(data);
        if (site.customerId === customerId) {
          const siteWithFiles = checkStaticFiles(site);
          sites.push({
            ...site,
            files_exist: siteWithFiles.files_exist,
            actual_domain: siteWithFiles.actual_domain
          });
        }
      }
    }
    
    res.json(sites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search sites
router.get('/sites/search', async (req, res) => {
  try {
    const { customerId } = req;
    const { search, type } = req.query;
    const keys = await sitesIndex.listAllSiteKeys();
    const sites = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const site = JSON.parse(data);
        if (site.customerId === customerId) {
          // Apply filters
          if (type && site.type !== type) continue;
          if (search && !site.domain?.toLowerCase().includes(search.toLowerCase())) continue;
          
          const siteWithFiles = checkStaticFiles(site);
          sites.push({
            ...site,
            files_exist: siteWithFiles.files_exist,
            actual_domain: siteWithFiles.actual_domain
          });
        }
      }
    }
    
    res.json({
      data: sites,
      total: sites.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific site
router.get('/sites/:domain', async (req, res) => {
  try {
    const { customerId } = req;
    const { domain } = req.params;
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const siteWithFiles = checkStaticFiles(site);
    res.json({
      ...site,
      files_exist: siteWithFiles.files_exist,
      actual_domain: siteWithFiles.actual_domain
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new site
router.post('/sites', async (req, res) => {
  try {
    const { customerId } = req;
    const siteData = req.body;
    
    // Ensure customer ID is set from token
    siteData.customerId = customerId;
    
    if (!siteData.domain || !siteData.type) {
      return res.status(400).json({ error: 'Domain and type are required' });
    }
    
    // Check if domain already exists
    const exists = await redisClient.exists(`site:${siteData.domain}`);
    if (exists) {
      return res.status(409).json({ error: 'Domain already exists' });
    }
    
    // Create the site
    const site = {
      ...siteData,
      customerId, // Ensure customer ID from token
      enabled: siteData.enabled !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await redisClient.set(`site:${siteData.domain}`, JSON.stringify(site));

    // Caddy-style automatic SSL: fire a background ACME issuance if the
    // customer enabled SSL on this site. Doesn't block the response.
    require('../utils/auto-cert').maybeAutoIssueCert(site);

    res.status(201).json(site);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update site
router.put('/sites/:domain', async (req, res) => {
  try {
    const { customerId } = req;
    const { domain } = req.params;
    const updates = req.body;
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Apply updates (but never change customerId)
    const updatedSite = {
      ...site,
      ...updates,
      customerId, // Always keep customer ID from token
      updatedAt: new Date().toISOString()
    };
    
    await redisClient.set(`site:${domain}`, JSON.stringify(updatedSite));
    
    res.json(updatedSite);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete site
router.delete('/sites/:domain', async (req, res) => {
  try {
    const { customerId } = req;
    const { domain } = req.params;
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    await redisClient.del(`site:${domain}`);
    
    res.json({ message: 'Site deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload static site ZIP
router.post('/sites/:domain/upload', async (req, res) => {
  // TODO: Implement file upload
  res.status(501).json({ error: 'Not implemented yet' });
});

// Get container stats
router.get('/sites/:domain/containers', async (req, res) => {
  // TODO: Implement container stats
  res.json({ containers: [] });
});

// Container actions
router.post('/sites/:domain/container/:action', async (req, res) => {
  // TODO: Implement container actions
  res.status(501).json({ error: 'Not implemented yet' });
});

// Get container logs
router.get('/sites/:domain/logs', async (req, res) => {
  // TODO: Implement container logs
  res.json({ logs: [] });
});

// Delete deployment
router.delete('/deployments/:id', async (req, res) => {
  try {
    const { customerId } = req;
    const { id } = req.params;
    
    const data = await redisClient.get(`site:${id}`);
    if (!data) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    // TODO: Clean up containers, files, etc.
    
    await redisClient.del(`site:${id}`);
    
    res.json({ message: 'Deployment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get deployment logs
router.get('/deployments/:id/logs', async (req, res) => {
  try {
    const { customerId } = req;
    const { id } = req.params;
    const { lines = 100 } = req.query;
    
    const data = await redisClient.get(`site:${id}`);
    if (!data) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    // Get logs from Redis
    const logsKey = `logs:${site.domain}`;
    const logs = await redisClient.lRange(logsKey, 0, parseInt(lines) - 1);
    
    res.json({
      logs: logs.map(log => {
        try {
          return JSON.parse(log);
        } catch (e) {
          return { message: log };
        }
      })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get deployment metrics
router.get('/deployments/:id/metrics', async (req, res) => {
  try {
    const { customerId } = req;
    const { id } = req.params;
    
    const data = await redisClient.get(`site:${id}`);
    if (!data) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    // Get metrics from Redis
    const metricsData = await redisClient.hGetAll(`metrics:${site.domain}`);
    
    res.json({
      domain: site.domain,
      metrics: {
        requests: parseInt(metricsData.requests || 0),
        errors: parseInt(metricsData.errors || 0),
        bandwidth: parseInt(metricsData.totalBandwidth || 0),
        avgResponseTime: parseFloat(metricsData.avgResponseTime || 0),
        lastUpdated: metricsData.lastUpdated || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;