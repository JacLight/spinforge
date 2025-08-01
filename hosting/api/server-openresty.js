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

// Get base domain from environment or default
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'spinforge.localhost';
const STATIC_ROOT = process.env.STATIC_ROOT || '/var/www/static';

// List all virtual hosts with file checks and search
app.get('/api/vhost', async (req, res) => {
  try {
    // Get search parameters
    const search = req.query.search || '';
    const customer = req.query.customer || '';
    const type = req.query.type || '';
    const limit = parseInt(req.query.limit) || 0;
    const offset = parseInt(req.query.offset) || 0;
    
    const keys = await redisClient.keys('vhost:*');
    const vhosts = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        try {
          const vhost = JSON.parse(data);
          
          // Check if static files exist
          if (vhost.type === 'static') {
            const staticPath = vhost.static_path || path.join(STATIC_ROOT, vhost.subdomain);
            vhost.files_exist = false;
            vhost.actual_domain = null;
            
            try {
              // Check if directory exists
              if (fs.existsSync(staticPath)) {
                vhost.files_exist = true;
                
                // Check for deploy.json to get actual domain
                const deployJsonPath = path.join(staticPath, 'deploy.json');
                if (fs.existsSync(deployJsonPath)) {
                  try {
                    const deployData = JSON.parse(fs.readFileSync(deployJsonPath, 'utf8'));
                    vhost.actual_domain = deployData.domain || null;
                  } catch (e) {
                    console.error(`Error reading deploy.json for ${vhost.subdomain}:`, e);
                  }
                }
              }
            } catch (e) {
              console.error(`Error checking files for ${vhost.subdomain}:`, e);
            }
          }
          
          // Use actual domain from deploy.json if available, otherwise use configured domain
          vhost.domain = vhost.actual_domain || `${vhost.subdomain}.${BASE_DOMAIN}`;
          
          // Apply search filter
          if (search) {
            const searchLower = search.toLowerCase();
            const matchesSearch = 
              vhost.subdomain.toLowerCase().includes(searchLower) ||
              (vhost.domain || '').toLowerCase().includes(searchLower) ||
              (vhost.customerId || '').toLowerCase().includes(searchLower);
            
            if (!matchesSearch) continue;
          }
          
          // Apply customer filter
          if (customer && vhost.customerId !== customer) {
            continue;
          }
          
          // Apply type filter
          if (type && vhost.type !== type) {
            continue;
          }
          
          vhosts.push(vhost);
        } catch (e) {
          console.error(`Error parsing vhost data for ${key}:`, e);
        }
      }
    }
    
    // Sort by creation date (newest first)
    vhosts.sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt || 0);
      const dateB = new Date(b.created_at || b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Apply pagination if requested
    let paginatedVhosts = vhosts;
    if (limit > 0) {
      paginatedVhosts = vhosts.slice(offset, offset + limit);
    }
    
    // Return results with metadata
    res.json({
      data: paginatedVhosts,
      total: vhosts.length,
      limit: limit || vhosts.length,
      offset: offset,
      hasMore: limit > 0 && (offset + limit) < vhosts.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get virtual host details
app.get('/api/vhost/:subdomain', async (req, res) => {
  try {
    const data = await redisClient.get(`vhost:${req.params.subdomain}`);
    if (!data) {
      return res.status(404).json({ error: 'Virtual host not found' });
    }
    const vhost = JSON.parse(data);
    
    // Check if static files exist
    if (vhost.type === 'static') {
      const staticPath = vhost.static_path || path.join(STATIC_ROOT, vhost.subdomain);
      vhost.files_exist = false;
      vhost.actual_domain = null;
      
      try {
        // Check if directory exists
        if (fs.existsSync(staticPath)) {
          vhost.files_exist = true;
          
          // Check for deploy.json to get actual domain
          const deployJsonPath = path.join(staticPath, 'deploy.json');
          if (fs.existsSync(deployJsonPath)) {
            try {
              const deployData = JSON.parse(fs.readFileSync(deployJsonPath, 'utf8'));
              vhost.actual_domain = deployData.domain || null;
            } catch (e) {
              console.error(`Error reading deploy.json for ${vhost.subdomain}:`, e);
            }
          }
        }
      } catch (e) {
        console.error(`Error checking files for ${vhost.subdomain}:`, e);
      }
    }
    
    // Use actual domain from deploy.json if available, otherwise use configured domain
    vhost.domain = vhost.actual_domain || `${vhost.subdomain}.${BASE_DOMAIN}`;
    res.json(vhost);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create virtual host
app.post('/api/vhost', async (req, res) => {
  try {
    const vhost = req.body;
    
    // Validate required fields
    if (!vhost.subdomain || !vhost.type) {
      return res.status(400).json({ error: 'Subdomain and type are required' });
    }
    
    // Check if exists
    const exists = await redisClient.exists(`vhost:${vhost.subdomain}`);
    if (exists) {
      return res.status(409).json({ error: 'Virtual host already exists' });
    }
    
    // Set defaults
    vhost.enabled = vhost.enabled !== false;
    vhost.createdAt = new Date().toISOString();
    vhost.updatedAt = vhost.createdAt;
    
    // Save to Redis - this is all we need for OpenResty!
    await redisClient.set(`vhost:${vhost.subdomain}`, JSON.stringify(vhost));
    
    // Clear route cache in OpenResty (optional - cache expires in 60s anyway)
    await redisClient.del(`routes_cache:${vhost.subdomain}`);
    
    res.status(201).json({ message: 'Virtual host created', subdomain: vhost.subdomain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update virtual host
app.put('/api/vhost/:subdomain', async (req, res) => {
  try {
    const subdomain = req.params.subdomain;
    const updates = req.body;
    
    // Get existing vhost
    const data = await redisClient.get(`vhost:${subdomain}`);
    if (!data) {
      return res.status(404).json({ error: 'Virtual host not found' });
    }
    
    const vhost = JSON.parse(data);
    
    // Apply updates
    Object.assign(vhost, updates);
    vhost.updatedAt = new Date().toISOString();
    
    // Save to Redis
    await redisClient.set(`vhost:${subdomain}`, JSON.stringify(vhost));
    
    // Clear route cache
    await redisClient.del(`routes_cache:${subdomain}`);
    
    res.json({ message: 'Virtual host updated', subdomain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete virtual host
app.delete('/api/vhost/:subdomain', async (req, res) => {
  try {
    const subdomain = req.params.subdomain;
    
    // Check if exists
    const exists = await redisClient.exists(`vhost:${subdomain}`);
    if (!exists) {
      return res.status(404).json({ error: 'Virtual host not found' });
    }
    
    // Delete from Redis
    await redisClient.del(`vhost:${subdomain}`);
    
    // Clear route cache
    await redisClient.del(`routes_cache:${subdomain}`);
    
    res.json({ message: 'Virtual host deleted', subdomain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const keys = await redisClient.keys('vhost:*');
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
          const vhost = JSON.parse(data);
          stats.total_sites++;
          
          // Count by type
          if (vhost.type === 'static') stats.static_sites++;
          else if (vhost.type === 'proxy') stats.proxy_sites++;
          else if (vhost.type === 'container') stats.container_sites++;
          else if (vhost.type === 'loadbalancer') stats.loadbalancer_sites++;
          
          // Count by status
          if (vhost.enabled !== false) stats.enabled_sites++;
          else stats.disabled_sites++;
        } catch (e) {
          console.error(`Error parsing vhost data for ${key}:`, e);
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

// Get all routes (returns vhosts formatted as routes for UI compatibility)
app.get('/api/routes', async (req, res) => {
  try {
    const keys = await redisClient.keys('vhost:*');
    const routes = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        try {
          const vhost = JSON.parse(data);
          // Format vhost as route for UI compatibility
          routes.push({
            domain: `${vhost.subdomain}.${BASE_DOMAIN}`,
            customerId: vhost.customerId || 'unknown',
            spinletId: vhost.subdomain, // Use subdomain as ID
            buildPath: vhost.static_path || '/',
            framework: vhost.type,
            config: {
              type: vhost.type,
              target: vhost.target,
              enabled: vhost.enabled !== false
            }
          });
        } catch (e) {
          console.error(`Error parsing vhost data for ${key}:`, e);
        }
      }
    }
    
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Metrics endpoint (compatible with UI expectations)
app.get('/api/metrics', async (req, res) => {
  try {
    // Get all vhosts for metrics
    const keys = await redisClient.keys('vhost:*');
    const vhosts = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        try {
          vhosts.push(JSON.parse(data));
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
    
    // Calculate metrics
    const activeCount = vhosts.filter(v => v.enabled !== false).length;
    
    res.json({
      // Basic metrics for UI compatibility
      activeSpinlets: activeCount,
      totalSpinlets: vhosts.length,
      allocatedPorts: 0, // Not applicable for static hosting
      availablePorts: 1000, // Arbitrary number
      memoryUsage: 0,
      cpuUsage: 0,
      
      // Additional hosting-specific metrics
      totalSites: vhosts.length,
      activeSites: activeCount,
      staticSites: vhosts.filter(v => v.type === 'static').length,
      proxySites: vhosts.filter(v => v.type === 'proxy').length
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