const express = require('express');
const redis = require('redis');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');

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
  database: process.env.REDIS_DB || 0
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect();

// Caddy admin API URL
const CADDY_API = process.env.CADDY_API || 'http://caddy:2019';
const SITES_DIR = '/etc/caddy/sites';

// Ensure sites directory exists
async function ensureSitesDir() {
  try {
    await fs.mkdir(SITES_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating sites directory:', error);
  }
}

// Generate Caddy configuration for a vhost
function generateCaddyConfig(vhost) {
  let config = `${vhost.subdomain}.spinforge.io {\n`;
  config += `\timport tls_on_demand\n`;
  config += `\timport security_headers\n`;
  
  // Add rate limiting if configured
  if (vhost.rateLimit) {
    config += `\timport rate_limit ${vhost.rateLimit.requests}\n`;
  }
  
  // Cookie-based routing
  if (vhost.cookieRouting && vhost.cookieRouting.length > 0) {
    vhost.cookieRouting.forEach(route => {
      config += `\n\t@${route.name} header Cookie *${route.cookie}*\n`;
      config += `\thandle @${route.name} {\n`;
      config += `\t\treverse_proxy ${route.backend} {\n`;
      config += `\t\t\timport common_proxy\n`;
      config += `\t\t}\n`;
      config += `\t}\n`;
    });
  }
  
  // Main routing configuration
  switch (vhost.type) {
    case 'proxy':
      config += `\n\thandle {\n`;
      config += `\t\treverse_proxy ${vhost.upstream} {\n`;
      config += `\t\t\timport common_proxy\n`;
      config += `\t\t}\n`;
      config += `\t}\n`;
      break;
      
    case 'static':
      config += `\n\troot * /var/www/static/${vhost.subdomain}\n`;
      config += `\tfile_server\n`;
      break;
      
    case 'container':
      const upstream = `http://${vhost.containerName}:${vhost.port || 80}`;
      config += `\n\thandle {\n`;
      config += `\t\treverse_proxy ${upstream} {\n`;
      config += `\t\t\timport common_proxy\n`;
      config += `\t\t}\n`;
      config += `\t}\n`;
      break;
      
    case 'loadbalancer':
      config += `\n\thandle {\n`;
      config += `\t\treverse_proxy ${vhost.backends.join(' ')} {\n`;
      config += `\t\t\timport common_proxy\n`;
      config += `\t\t\tlb_policy round_robin\n`;
      config += `\t\t\thealth_uri /health\n`;
      config += `\t\t\thealth_interval 10s\n`;
      config += `\t\t}\n`;
      config += `\t}\n`;
      break;
  }
  
  // Custom headers
  if (vhost.headers) {
    config += `\n\theader {\n`;
    for (const [key, value] of Object.entries(vhost.headers)) {
      config += `\t\t${key} "${value}"\n`;
    }
    config += `\t}\n`;
  }
  
  config += `}\n`;
  return config;
}

// Reload Caddy configuration
async function reloadCaddy() {
  try {
    await axios.post(`${CADDY_API}/load`, null, {
      headers: { 'Content-Type': 'application/json' }
    });
    return true;
  } catch (error) {
    console.error('Failed to reload Caddy:', error.message);
    return false;
  }
}

// API Routes

// List all virtual hosts
app.get('/api/vhost', async (req, res) => {
  try {
    const keys = await redisClient.keys('vhost:*');
    const vhosts = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        try {
          const vhost = JSON.parse(data);
          vhosts.push(vhost);
        } catch (e) {
          console.error(`Error parsing vhost data for ${key}:`, e);
        }
      }
    }
    
    res.json(vhosts);
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
    res.json(JSON.parse(data));
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
    
    // Save to Redis
    await redisClient.set(`vhost:${vhost.subdomain}`, JSON.stringify(vhost));
    
    // Generate and save Caddy config
    if (vhost.enabled) {
      const config = generateCaddyConfig(vhost);
      await fs.writeFile(path.join(SITES_DIR, `${vhost.subdomain}.caddy`), config);
      await reloadCaddy();
    }
    
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
    
    // Update Caddy config
    if (vhost.enabled) {
      const config = generateCaddyConfig(vhost);
      await fs.writeFile(path.join(SITES_DIR, `${subdomain}.caddy`), config);
    } else {
      // Remove config file if disabled
      try {
        await fs.unlink(path.join(SITES_DIR, `${subdomain}.caddy`));
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
    
    await reloadCaddy();
    
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
    
    // Remove config file
    try {
      await fs.unlink(path.join(SITES_DIR, `${subdomain}.caddy`));
      await reloadCaddy();
    } catch (error) {
      // Ignore if file doesn't exist
    }
    
    res.json({ message: 'Virtual host deleted', subdomain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Domain verification for on-demand TLS
app.get('/api/verify-domain', async (req, res) => {
  try {
    const domain = req.query.domain;
    if (!domain) {
      return res.status(400).send('Bad Request');
    }
    
    // Extract subdomain
    const match = domain.match(/^(.+)\.spinforge\.io$/);
    if (!match) {
      return res.status(403).send('Forbidden');
    }
    
    const subdomain = match[1];
    const data = await redisClient.get(`vhost:${subdomain}`);
    
    if (!data) {
      return res.status(404).send('Not Found');
    }
    
    const vhost = JSON.parse(data);
    if (!vhost.enabled) {
      return res.status(403).send('Forbidden');
    }
    
    res.status(200).send('OK');
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
});

// Check site files (for static sites)
app.get('/api/vhost/:subdomain/files', async (req, res) => {
  try {
    const subdomain = req.params.subdomain;
    const data = await redisClient.get(`vhost:${subdomain}`);
    
    if (!data) {
      return res.status(404).json({ error: 'Virtual host not found' });
    }
    
    const vhost = JSON.parse(data);
    
    if (vhost.type !== 'static') {
      return res.json({ 
        type: vhost.type,
        message: 'Not a static site',
        files: []
      });
    }
    
    const staticPath = vhost.static_path || `/var/www/static/${subdomain}`;
    
    try {
      const stats = await fs.stat(staticPath);
      if (!stats.isDirectory()) {
        return res.json({ exists: false, files: [] });
      }
      
      const files = await fs.readdir(staticPath);
      const fileDetails = [];
      
      for (const file of files) {
        try {
          const filePath = path.join(staticPath, file);
          const fileStats = await fs.stat(filePath);
          fileDetails.push({
            name: file,
            size: fileStats.size,
            isDirectory: fileStats.isDirectory(),
            modified: fileStats.mtime
          });
        } catch (e) {
          // Skip files we can't stat
        }
      }
      
      res.json({
        exists: true,
        path: staticPath,
        files: fileDetails
      });
    } catch (error) {
      res.json({ 
        exists: false, 
        error: error.message,
        files: [] 
      });
    }
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
          if (vhost.enabled) stats.enabled_sites++;
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

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

// Initialize and start server
async function start() {
  await ensureSitesDir();
  
  // Load existing configurations on startup
  try {
    const keys = await redisClient.keys('vhost:*');
    for (const key of keys) {
      const data = await redisClient.get(key);
      const vhost = JSON.parse(data);
      if (vhost.enabled) {
        const config = generateCaddyConfig(vhost);
        await fs.writeFile(path.join(SITES_DIR, `${vhost.subdomain}.caddy`), config);
      }
    }
    await reloadCaddy();
  } catch (error) {
    console.error('Error loading existing configurations:', error);
  }
  
  const PORT = process.env.PORT || 18080;
  app.listen(PORT, () => {
    console.log(`Config API listening on port ${PORT}`);
  });
}

start();