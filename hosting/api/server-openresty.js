const express = require('express');
const redis = require('redis');

const app = express();
app.use(express.json());

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

// List all virtual hosts
app.get('/api/vhost', async (req, res) => {
  try {
    const keys = await redisClient.keys('vhost:*');
    const vhosts = keys.map(key => key.replace('vhost:', ''));
    res.json({ vhosts });
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'spinforge-api-openresty' });
});

// Metrics endpoint
app.get('/api/metrics', async (req, res) => {
  try {
    // Get all request metrics
    const totalRequests = await redisClient.get('metrics:requests:total') || '0';
    const domains = await redisClient.keys('metrics:requests:domain:*');
    
    const domainMetrics = {};
    for (const key of domains) {
      const domain = key.replace('metrics:requests:domain:', '');
      const count = await redisClient.get(key);
      domainMetrics[domain] = parseInt(count || '0');
    }
    
    res.json({
      totalRequests: parseInt(totalRequests),
      domains: domainMetrics
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