const express = require('express');
const redis = require('redis');

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Redis client
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'keydb',
    port: process.env.REDIS_PORT || 16378
  },
  password: process.env.REDIS_PASSWORD || '',
  database: process.env.REDIS_DB || 1
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect();

const fs = require('fs');
const path = require('path');

// Static root for file storage
const STATIC_ROOT = process.env.STATIC_ROOT || '/var/www/static';

// List all sites with file checks and search
app.get('/api/sites', async (req, res) => {
  try {
    // Get search parameters
    const search = req.query.search || '';
    const customer = req.query.customer || '';
    const type = req.query.type || '';
    const limit = parseInt(req.query.limit) || 0;
    const offset = parseInt(req.query.offset) || 0;
    
    const keys = await redisClient.keys('site:*');
    const sites = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        try {
          const site = JSON.parse(data);
          
          // Check if static files exist
          if (site.type === 'static') {
            // Use filesystem-friendly folder name (dots replaced with underscores)
            const folderName = site.domain.replace(/\./g, '_');
            const staticPath = site.static_path || path.join(STATIC_ROOT, folderName);
            site.files_exist = false;
            site.actual_domain = null;
            
            try {
              // Check if directory exists
              if (fs.existsSync(staticPath)) {
                site.files_exist = true;
                
                // Check for deploy.json to get actual domain
                const deployJsonPath = path.join(staticPath, 'deploy.json');
                if (fs.existsSync(deployJsonPath)) {
                  try {
                    const deployData = JSON.parse(fs.readFileSync(deployJsonPath, 'utf8'));
                    site.actual_domain = deployData.domain || null;
                  } catch (e) {
                    console.error(`Error reading deploy.json for ${site.domain}:`, e);
                  }
                }
              }
            } catch (e) {
              console.error(`Error checking files for ${site.domain}:`, e);
            }
          }
          
          // Apply search filter
          if (search) {
            const searchLower = search.toLowerCase();
            const matchesSearch = 
              (site.domain).toLowerCase().includes(searchLower) ||
              (site.domain || '').toLowerCase().includes(searchLower) ||
              (site.customerId || '').toLowerCase().includes(searchLower);
            
            if (!matchesSearch) continue;
          }
          
          // Apply customer filter
          if (customer && site.customerId !== customer) {
            continue;
          }
          
          // Apply type filter
          if (type && site.type !== type) {
            continue;
          }
          
          sites.push(site);
        } catch (e) {
          console.error(`Error parsing site data for ${key}:`, e);
        }
      }
    }
    
    // Sort by creation date (newest first)
    sites.sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt || 0);
      const dateB = new Date(b.created_at || b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Apply pagination if requested
    let paginatedSites = sites;
    if (limit > 0) {
      paginatedSites = sites.slice(offset, offset + limit);
    }
    
    // Return results with metadata
    res.json({
      data: paginatedSites,
      total: sites.length,
      limit: limit || sites.length,
      offset: offset,
      hasMore: limit > 0 && (offset + limit) < sites.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get virtual host details
app.get('/api/sites/:domain', async (req, res) => {
  try {
    const data = await redisClient.get(`site:${req.params.domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    const site = JSON.parse(data);
    
    // Check if static files exist
    if (site.type === 'static') {
      // Use filesystem-friendly folder name (dots replaced with underscores)
      const folderName = site.domain.replace(/\./g, '_');
      const staticPath = site.static_path || path.join(STATIC_ROOT, folderName);
      site.files_exist = false;
      site.actual_domain = null;
      
      try {
        // Check if directory exists
        if (fs.existsSync(staticPath)) {
          site.files_exist = true;
          
          // Check for deploy.json to get actual domain
          const deployJsonPath = path.join(staticPath, 'deploy.json');
          if (fs.existsSync(deployJsonPath)) {
            try {
              const deployData = JSON.parse(fs.readFileSync(deployJsonPath, 'utf8'));
              site.actual_domain = deployData.domain || null;
            } catch (e) {
              console.error(`Error reading deploy.json for ${site.domain}:`, e);
            }
          }
        }
      } catch (e) {
        console.error(`Error checking files for ${site.domain}:`, e);
      }
    }
    res.json(site);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create virtual host
app.post('/api/sites', async (req, res) => {
  try {
    const site = req.body;
    
    // Validate required fields
    if (!site.domain || !site.type) {
      return res.status(400).json({ error: 'Domain and type are required' });
    }
    
    // Check if exists
    const exists = await redisClient.exists(`site:${site.domain}`);
    if (exists) {
      return res.status(409).json({ error: 'Site already exists' });
    }
    
    // Set defaults
    site.enabled = site.enabled !== false;
    site.createdAt = new Date().toISOString();
    site.updatedAt = site.createdAt;
    
    // Save to Redis - domain is the key!
    await redisClient.set(`site:${site.domain}`, JSON.stringify(site));
    
    // Handle aliases - each alias points to the primary domain
    if (site.aliases && site.aliases.length > 0) {
      for (const alias of site.aliases) {
        await redisClient.set(`alias:${alias}`, site.domain);
      }
    }
    
    res.status(201).json({ message: 'Site created', domain: site.domain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Update virtual host
app.put('/api/sites/:domain', async (req, res) => {
  try {
    const domain = req.params.domain;
    const updates = req.body;
    
    // Get existing site
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    
    // Apply updates
    Object.assign(site, updates);
    site.updatedAt = new Date().toISOString();
    
    // Save to Redis
    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    
    // Handle alias updates
    if (updates.aliases !== undefined) {
      // Clear old aliases
      const oldAliases = JSON.parse(data).aliases || [];
      for (const alias of oldAliases) {
        await redisClient.del(`alias:${alias}`);
      }
      // Add new aliases
      if (site.aliases && site.aliases.length > 0) {
        for (const alias of site.aliases) {
          await redisClient.set(`alias:${alias}`, domain);
        }
      }
    }
    
    // If domain/aliases were updated and this is a static site, update deploy.json
    if ((updates.domain || updates.aliases) && site.type === 'static') {
      const staticPath = site.static_path || path.join(STATIC_ROOT, site.domain.replace(/[^a-zA-Z0-9.-]/g, '-'));
      const deployJsonPath = path.join(staticPath, 'deploy.json');
      
      try {
        if (fs.existsSync(deployJsonPath)) {
          // Read existing deploy.json
          const deployData = JSON.parse(fs.readFileSync(deployJsonPath, 'utf8'));
          // Update domain and aliases
          if (updates.domain !== undefined) {
            deployData.domain = site.domain;
          }
          if (updates.aliases !== undefined) {
            deployData.aliases = site.aliases || [];
          }
          // Write back
          fs.writeFileSync(deployJsonPath, JSON.stringify(deployData, null, 2));
          console.log(`Updated deploy.json for ${domain}`);
        }
      } catch (e) {
        console.error(`Error updating deploy.json for ${domain}:`, e);
        // Don't fail the whole update if deploy.json update fails
      }
    }
    
    // Clear route cache
    
    res.json({ message: 'Site updated', domain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete virtual host
app.delete('/api/sites/:domain', async (req, res) => {
  try {
    const domain = req.params.domain;
    
    // Get site to clean up domain mappings
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    
    // Clear all domain mappings for this site
    if (site.domain) {
      await redisClient.del(`domain:${site.domain}`);
    }
    if (site.aliases) {
      for (const alias of site.aliases) {
        await redisClient.del(`domain:${alias}`);
      }
    }
    
    // Delete from Redis
    await redisClient.del(`site:${domain}`);
    
    // Clear route cache
    
    res.json({ message: 'Site deleted', domain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'spinforge-api-openresty' });
});

// API health endpoint (for UI compatibility)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    version: '1.0.0',
    service: 'SpinForge Hosting API',
    timestamp: new Date().toISOString()
  });
});

// Get all routes (returns sites formatted as routes for UI compatibility)
app.get('/api/routes', async (req, res) => {
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

// Get hosting metrics for a specific site
app.get('/api/sites/:domain/metrics', async (req, res) => {
  try {
    const { domain } = req.params;
    const timeRange = req.query.range || '24h'; // 1h, 24h, 7d, 30d
    
    // Get metrics from Redis
    const metricsKey = `metrics:${domain}`;
    const logsKey = `logs:${domain}`;
    
    // Get current metrics
    const currentMetrics = await redisClient.hGetAll(metricsKey);
    
    // Get recent access logs (last 100)
    const logs = await redisClient.lRange(logsKey, 0, 99);
    const parsedLogs = logs.map(log => {
      try {
        return JSON.parse(log);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    // Calculate stats
    const now = Date.now();
    const timeRanges = {
      '1h': 3600000,
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000
    };
    const cutoff = now - (timeRanges[timeRange] || timeRanges['24h']);
    
    const recentLogs = parsedLogs.filter(log => new Date(log.timestamp).getTime() > cutoff);
    
    // Status code distribution
    const statusCodes = {};
    recentLogs.forEach(log => {
      const status = log.status || 'unknown';
      statusCodes[status] = (statusCodes[status] || 0) + 1;
    });
    
    // Response time stats
    const responseTimes = recentLogs.map(log => log.responseTime || 0).filter(t => t > 0);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    res.json({
      domain,
      timeRange,
      lastAccessed: currentMetrics.lastAccessed || null,
      totalRequests: parseInt(currentMetrics.totalRequests || '0'),
      totalBandwidth: parseInt(currentMetrics.totalBandwidth || '0'),
      uniqueVisitors: parseInt(currentMetrics.uniqueVisitors || '0'),
      metrics: {
        requests: recentLogs.length,
        avgResponseTime: Math.round(avgResponseTime),
        statusCodes,
        bandwidth: recentLogs.reduce((sum, log) => sum + (log.bytes || 0), 0),
        errorRate: recentLogs.filter(log => log.status >= 400).length / (recentLogs.length || 1),
      },
      recentLogs: parsedLogs.slice(0, 10) // Last 10 logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get request logs for a specific site
app.get('/api/sites/:domain/logs', async (req, res) => {
  try {
    const { domain } = req.params;
    const { limit = 100, offset = 0, status, search } = req.query;
    
    const logsKey = `logs:${domain}`;
    const logs = await redisClient.lRange(logsKey, 0, -1);
    
    let parsedLogs = logs.map(log => {
      try {
        return JSON.parse(log);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    // Filter by status if provided
    if (status) {
      parsedLogs = parsedLogs.filter(log => log.status == status);
    }
    
    // Search in path and user agent
    if (search) {
      const searchLower = search.toLowerCase();
      parsedLogs = parsedLogs.filter(log => 
        (log.path && log.path.toLowerCase().includes(searchLower)) ||
        (log.userAgent && log.userAgent.toLowerCase().includes(searchLower)) ||
        (log.ip && log.ip.includes(search))
      );
    }
    
    // Paginate
    const total = parsedLogs.length;
    const paginatedLogs = parsedLogs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({
      logs: paginatedLogs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: parseInt(offset) + parseInt(limit) < total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Metrics endpoint (compatible with UI expectations)
app.get('/api/metrics', async (req, res) => {
  try {
    // Get all sites for metrics
    const keys = await redisClient.keys('site:*');
    const sites = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        try {
          sites.push(JSON.parse(data));
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
    
    // Calculate metrics
    const activeCount = sites.filter(v => v.enabled !== false).length;
    
    res.json({
      // Basic metrics for UI compatibility
      activeSpinlets: activeCount,
      totalSpinlets: sites.length,
      allocatedPorts: 0, // Not applicable for static hosting
      availablePorts: 1000, // Arbitrary number
      memoryUsage: 0,
      cpuUsage: 0,
      
      // Additional hosting-specific metrics
      totalSites: sites.length,
      activeSites: activeCount,
      staticSites: sites.filter(v => v.type === 'static').length,
      proxySites: sites.filter(v => v.type === 'proxy').length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`SpinForge API (OpenResty version) listening on port ${PORT}`);
  console.log('No Caddy reloads needed - routes are read directly from Redis!');
});