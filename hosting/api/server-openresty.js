const express = require('express');
const redis = require('redis');
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
  database: process.env.REDIS_DB || 1
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect();

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const yaml = require('js-yaml');
const ComposeManager = require('./compose-manager');

// Static root for file storage
const STATIC_ROOT = process.env.STATIC_ROOT || '/var/www/static';

// Initialize compose manager
const composeManager = new ComposeManager(redisClient);

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
    
    // Handle Docker Compose deployment
    if (site.type === 'container' && site.composeConfig) {
      try {
        // Parse the YAML to create a compose deployment
        const composeYaml = site.composeConfig;
        const composeData = yaml.load(composeYaml);
        
        // Deploy using compose manager
        const result = await composeManager.deployCompose(site.domain, composeData);
        
        // Store the result in the site object
        site.composeProject = result.projectName;
        site.containers = result.containers;
        site.services = result.services;
        
        console.log(`Compose deployment successful for ${site.domain}`);
      } catch (error) {
        console.error('Compose deployment failed:', error);
        return res.status(500).json({ 
          error: 'Compose deployment failed', 
          details: error.message 
        });
      }
    }
    // Handle simple container deployment
    else if (site.type === 'container' && site.containerConfig) {
      try {
        const containerName = `spinforge-${site.domain.replace(/\./g, '-')}`;
        const config = site.containerConfig;
        
        // Build docker run command
        let dockerCmd = `docker run -d --name ${containerName}`;
        dockerCmd += ` --network spinforge_spinforge`;
        dockerCmd += ` --restart ${config.restartPolicy || 'unless-stopped'}`;
        
        // Don't expose port - container will be accessed internally through network
        
        // Add environment variables
        if (config.env && config.env.length > 0) {
          config.env.forEach(env => {
            dockerCmd += ` -e "${env.key}=${env.value}"`;
          });
        }
        
        // Add volume mounts
        if (config.volumes && config.volumes.length > 0) {
          config.volumes.forEach(vol => {
            dockerCmd += ` -v "${vol.host}:${vol.container}"`;
          });
        }
        
        // Add resource limits
        if (config.memoryLimit) {
          dockerCmd += ` --memory="${config.memoryLimit}"`;
        }
        if (config.cpuLimit) {
          dockerCmd += ` --cpus="${config.cpuLimit}"`;
        }
        
        // Add labels for metadata
        dockerCmd += ` --label spinforge.domain="${site.domain}"`;
        dockerCmd += ` --label spinforge.type="container"`;
        dockerCmd += ` --label spinforge.created="${site.createdAt}"`;
        
        // Add the image
        dockerCmd += ` ${config.image}`;
        
        // Add command override if specified
        if (config.command) {
          dockerCmd += ` ${config.command}`;
        }
        
        console.log('Deploying container:', dockerCmd);
        
        // Execute docker run
        const { stdout, stderr } = await execAsync(dockerCmd);
        const containerId = stdout.trim();
        
        // Store container ID in site config
        site.containerId = containerId;
        site.containerName = containerName;
        
        // Wait a moment for container to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get container IP address
        const inspectCmd = `docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerName}`;
        const { stdout: containerIp } = await execAsync(inspectCmd);
        
        // Set the target to the container's internal address
        site.target = `http://${containerIp.trim()}:${config.port}`;
        
        console.log(`Container deployed: ${containerName} -> ${site.target}`);
      } catch (error) {
        console.error('Container deployment failed:', error);
        return res.status(500).json({ 
          error: 'Container deployment failed', 
          details: error.message 
        });
      }
    }
    
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
    
    // Handle container cleanup
    if (site.type === 'container') {
      // Check if it's a compose deployment
      if (site.composeProject) {
        try {
          console.log(`Stopping compose project: ${site.composeProject}`);
          await composeManager.stopCompose(domain);
        } catch (error) {
          console.error('Compose cleanup failed:', error);
          // Continue with deletion even if cleanup fails
        }
      } else if (site.containerName) {
        try {
          console.log(`Stopping and removing container: ${site.containerName}`);
          await execAsync(`docker stop ${site.containerName}`);
          await execAsync(`docker rm ${site.containerName}`);
        } catch (error) {
          console.error('Container cleanup failed:', error);
          // Continue with deletion even if container cleanup fails
        }
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

// Global metrics across all sites
app.get('/api/metrics/global', async (req, res) => {
  try {
    const timeRange = req.query.range || '24h';
    
    // Get all site keys
    const siteKeys = await redisClient.keys('site:*');
    
    let totalRequests = 0;
    let totalBandwidth = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    const topRoutes = [];
    const requestsByStatus = {};
    const requestsByType = {};
    
    // Calculate time filter based on range
    const now = Date.now();
    let timeFilter = now - (24 * 60 * 60 * 1000); // Default 24h
    
    if (timeRange === '1h') {
      timeFilter = now - (60 * 60 * 1000);
    } else if (timeRange === '7d') {
      timeFilter = now - (7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '30d') {
      timeFilter = now - (30 * 24 * 60 * 60 * 1000);
    }
    
    // Process each site
    for (const siteKey of siteKeys) {
      const domain = siteKey.replace('site:', '');
      const siteData = await redisClient.get(siteKey);
      
      if (!siteData) continue;
      
      const site = JSON.parse(siteData);
      const logsKey = `logs:${domain}`;
      
      // Get recent logs for this site
      const logs = await redisClient.lRange(logsKey, 0, 999);
      let siteRequests = 0;
      let siteBandwidth = 0;
      let siteResponseTime = 0;
      let siteResponseCount = 0;
      const siteStatusCodes = {};
      
      for (const log of logs) {
        try {
          const logEntry = JSON.parse(log);
          
          // Filter by time range
          if (logEntry.timestamp < timeFilter) continue;
          
          siteRequests++;
          siteBandwidth += logEntry.bytes || 0;
          
          if (logEntry.responseTime > 0) {
            siteResponseTime += logEntry.responseTime;
            siteResponseCount++;
          }
          
          // Count status codes
          const statusGroup = Math.floor(logEntry.status / 100) + 'xx';
          siteStatusCodes[statusGroup] = (siteStatusCodes[statusGroup] || 0) + 1;
          requestsByStatus[statusGroup] = (requestsByStatus[statusGroup] || 0) + 1;
        } catch (e) {
          // Skip invalid log entries
        }
      }
      
      // Add to totals
      totalRequests += siteRequests;
      totalBandwidth += siteBandwidth;
      
      if (siteResponseCount > 0) {
        totalResponseTime += siteResponseTime;
        responseTimeCount += siteResponseCount;
      }
      
      // Count by type
      const type = site.type || 'unknown';
      requestsByType[type] = (requestsByType[type] || 0) + siteRequests;
      
      // Add to top routes if has traffic
      if (siteRequests > 0) {
        const avgResponseTime = siteResponseCount > 0 ? siteResponseTime / siteResponseCount : 0;
        const errorCount = (siteStatusCodes['4xx'] || 0) + (siteStatusCodes['5xx'] || 0);
        
        topRoutes.push({
          domain,
          requests: siteRequests,
          bandwidth: siteBandwidth,
          avgResponseTime,
          errorRate: siteRequests > 0 ? errorCount / siteRequests : 0
        });
      }
    }
    
    // Calculate average response time
    const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    
    // Sort and limit top routes
    topRoutes.sort((a, b) => b.requests - a.requests);
    
    res.json({
      totalRequests,
      totalBandwidth,
      avgResponseTime,
      topRoutes: topRoutes.slice(0, 10),
      requestsByStatus,
      requestsByType
    });
  } catch (error) {
    console.error('Error in global metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Metrics endpoint (compatible with UI expectations)
// Get system metrics
async function getSystemMetrics() {
  try {
    // Get CPU usage
    const { stdout: cpuInfo } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//'");
    const cpuUsage = parseFloat(cpuInfo.trim()) || 0;
    
    // Get memory usage
    const { stdout: memInfo } = await execAsync("free -m | awk 'NR==2{printf \"%.1f %.1f %.1f\", $3*100/$2, $3, $2}'");
    const [memPercent, memUsed, memTotal] = memInfo.trim().split(' ').map(parseFloat);
    
    // Get disk usage
    const { stdout: diskInfo } = await execAsync("df -h / | awk 'NR==2 {print $5\" \"$3\" \"$2}' | sed 's/%//'");
    const [diskPercent, diskUsed, diskTotal] = diskInfo.trim().split(' ');
    
    // Get CPU core count
    const { stdout: coreCount } = await execAsync("nproc");
    
    return {
      cpu: {
        usage: cpuUsage,
        cores: parseInt(coreCount.trim())
      },
      memory: {
        usagePercent: memPercent || 0,
        used: (memUsed || 0) * 1024 * 1024, // Convert to bytes
        total: (memTotal || 0) * 1024 * 1024,
        free: ((memTotal || 0) - (memUsed || 0)) * 1024 * 1024
      },
      disk: {
        usagePercent: parseFloat(diskPercent) || 0,
        used: diskUsed,
        total: diskTotal
      }
    };
  } catch (error) {
    console.error('Error getting system metrics:', error);
    return {
      cpu: { usage: 0, cores: 1 },
      memory: { usagePercent: 0, used: 0, total: 0, free: 0 },
      disk: { usagePercent: 0, used: '0', total: '0' }
    };
  }
}

// Get Docker container stats
async function getDockerStats() {
  try {
    const { stdout: containerList } = await execAsync("docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.ID}}'");
    const lines = containerList.split('\n').slice(1).filter(line => line.trim());
    
    const containers = [];
    let runningCount = 0;
    
    for (const line of lines) {
      const [name, image, status, id] = line.split('\t');
      if (!name || name === 'NAMES') continue;
      
      const isRunning = status.includes('Up');
      if (isRunning) runningCount++;
      
      let cpu = 0, memory = { percent: 0, usage: 0 }, network = { rx: 0, tx: 0 };
      
      if (isRunning) {
        try {
          const { stdout: statsOutput } = await execAsync(`docker stats ${name} --no-stream --format "{{.CPUPerc}}\t{{.MemPerc}}\t{{.MemUsage}}\t{{.NetIO}}"`);
          const [cpuPerc, memPerc, memUsage, netIO] = statsOutput.trim().split('\t');
          
          cpu = parseFloat(cpuPerc.replace('%', '')) || 0;
          memory.percent = parseFloat(memPerc.replace('%', '')) || 0;
          
          // Parse network I/O (format: "1.2kB / 3.4kB")
          if (netIO && netIO.includes('/')) {
            const [rx, tx] = netIO.split('/').map(s => s.trim());
            network.rx = parseBytes(rx);
            network.tx = parseBytes(tx);
          }
        } catch (e) {
          // Skip if stats unavailable
        }
      }
      
      containers.push({
        id: id.substring(0, 12),
        name: name,
        image: image,
        status: status,
        cpu: cpu,
        memory: memory,
        network: network
      });
    }
    
    return {
      containers: containers,
      running: runningCount,
      total: containers.length
    };
  } catch (error) {
    console.error('Error getting Docker stats:', error);
    return { containers: [], running: 0, total: 0 };
  }
}

// Parse bytes from Docker format (e.g., "1.2kB", "3.4MB")
function parseBytes(str) {
  if (!str) return 0;
  const match = str.match(/^([\d.]+)([A-Za-z]+)$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  const multipliers = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  return value * (multipliers[unit] || 1);
}

// Get Redis/KeyDB metrics
async function getKeyDBMetrics() {
  try {
    const info = await redisClient.info();
    const lines = info.split('\r\n');
    
    const metrics = {};
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        metrics[key] = value;
      }
    });
    
    return {
      connected: true,
      info: {
        totalKeys: parseInt(metrics.db1?.split(',')[0]?.split('=')[1]) || 0,
        memoryUsedHuman: metrics.used_memory_human || '0B',
        memoryUsed: parseInt(metrics.used_memory) || 0,
        uptime: parseInt(metrics.uptime_in_seconds) || 0
      },
      stats: {
        opsPerSec: parseInt(metrics.instantaneous_ops_per_sec) || 0,
        hitRate: parseFloat(metrics.keyspace_hit_rate) || 0,
        totalConnections: parseInt(metrics.total_connections_received) || 0,
        totalCommands: parseInt(metrics.total_commands_processed) || 0
      }
    };
  } catch (error) {
    console.error('Error getting KeyDB metrics:', error);
    return {
      connected: false,
      info: { totalKeys: 0, memoryUsedHuman: '0B', memoryUsed: 0, uptime: 0 },
      stats: { opsPerSec: 0, hitRate: 0, totalConnections: 0, totalCommands: 0 }
    };
  }
}

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
  
  // Check Nginx (by checking if it's in Docker)
  try {
    await execAsync('docker ps | grep nginx');
    services.push({
      name: 'Nginx',
      status: 'healthy',
      uptime: Date.now() / 1000,
      lastCheck: new Date().toISOString()
    });
  } catch (error) {
    services.push({
      name: 'Nginx',
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
    
    // Get request stats from site metrics
    let totalRequests = 0;
    let totalErrors = 0;
    
    for (const site of sites) {
      try {
        const metricsData = await redisClient.hGetAll(`metrics:${site.domain}`);
        totalRequests += parseInt(metricsData.requests || 0);
        totalErrors += parseInt(metricsData.errors || 0);
      } catch (e) {
        // Skip if no metrics
      }
    }
    
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
      proxySites: sites.filter(v => v.type === 'proxy').length,
      containerSites: sites.filter(v => v.type === 'container').length,
      
      // Request metrics
      totalRequests: totalRequests,
      totalErrors: totalErrors,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Comprehensive all metrics endpoint
app.get('/api/_metrics/all', async (req, res) => {
  try {
    const [systemMetrics, dockerStats, keydbMetrics, services] = await Promise.all([
      getSystemMetrics(),
      getDockerStats(),
      getKeyDBMetrics(),
      getServiceHealth()
    ]);
    
    res.json({
      system: systemMetrics,
      docker: dockerStats,
      keydb: keydbMetrics,
      services: services,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting all metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Parse Nginx access logs for bandwidth and request metrics
async function parseNginxLogs() {
  try {
    // Parse recent access log entries (last 1000 lines)
    const { stdout: logData } = await execAsync('tail -n 1000 /var/log/nginx/access.log 2>/dev/null || echo ""');
    const lines = logData.split('\n').filter(line => line.trim());
    
    const domainMetrics = {};
    let totalBandwidth = 0;
    let totalRequests = 0;
    let totalErrors = 0;
    
    lines.forEach(line => {
      // Parse standard Nginx log format: IP - - [timestamp] "method url protocol" status bytes "referer" "user-agent"
      const match = line.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) ([^"]+)" (\d+) (\d+) "([^"]*)" "([^"]*)"/);
      
      if (match) {
        const [, ip, timestamp, method, url, protocol, status, bytes, referer, userAgent] = match;
        const statusCode = parseInt(status);
        const bytesSent = parseInt(bytes) || 0;
        
        // Extract domain from URL or use Host header parsing
        let domain = 'unknown';
        try {
          const urlObj = new URL(url.startsWith('http') ? url : `http://localhost${url}`);
          domain = urlObj.hostname !== 'localhost' ? urlObj.hostname : 'default';
        } catch (e) {
          // If URL parsing fails, try to extract from request
          domain = 'default';
        }
        
        if (!domainMetrics[domain]) {
          domainMetrics[domain] = {
            requests: 0,
            errors: 0,
            bandwidthOut: 0,
            responseTimes: [],
            statusCodes: {}
          };
        }
        
        domainMetrics[domain].requests++;
        domainMetrics[domain].bandwidthOut += bytesSent;
        
        if (statusCode >= 400) {
          domainMetrics[domain].errors++;
          totalErrors++;
        }
        
        // Track status codes
        domainMetrics[domain].statusCodes[status] = (domainMetrics[domain].statusCodes[status] || 0) + 1;
        
        totalBandwidth += bytesSent;
        totalRequests++;
      }
    });
    
    // Store metrics in Redis
    for (const [domain, metrics] of Object.entries(domainMetrics)) {
      const metricsKey = `metrics:${domain}`;
      await redisClient.hSet(metricsKey, {
        requests: metrics.requests.toString(),
        errors: metrics.errors.toString(),
        bandwidthOut: metrics.bandwidthOut.toString(),
        totalBandwidth: metrics.bandwidthOut.toString(),
        avgResponseTime: '0', // Would need response time from logs
        lastUpdated: new Date().toISOString()
      });
    }
    
    return { domainMetrics, totalBandwidth, totalRequests, totalErrors };
  } catch (error) {
    console.error('Error parsing Nginx logs:', error);
    return { domainMetrics: {}, totalBandwidth: 0, totalRequests: 0, totalErrors: 0 };
  }
}

// Get bandwidth statistics
async function getDeploymentStats() {
  try {
    const keys = await redisClient.keys('site:*');
    const deployments = [];
    const frameworks = {};
    let totalDeployments = 0;
    let successfulDeployments = 0;
    let failedDeployments = 0;
    let totalBuildTime = 0;
    let deploymentsWithBuildTime = 0;
    
    for (const key of keys) {
      const domain = key.replace('site:', '');
      try {
        const siteData = await redisClient.get(key);
        if (siteData) {
          const site = JSON.parse(siteData);
          totalDeployments++;
          
          // Track framework
          const framework = site.framework || site.type || 'unknown';
          frameworks[framework] = (frameworks[framework] || 0) + 1;
          
          // Assume deployment is successful if site exists and has valid config
          if (site.target || site.containerName || site.staticPath) {
            successfulDeployments++;
          } else {
            failedDeployments++;
          }
          
          // Build time (simulated - we don't track this currently)
          if (site.buildTime) {
            totalBuildTime += site.buildTime;
            deploymentsWithBuildTime++;
          } else {
            // Simulate build time based on type
            let estimatedBuildTime = 30; // default 30s
            if (site.type === 'container') estimatedBuildTime = 120; // 2 min for containers
            if (site.type === 'compose') estimatedBuildTime = 180; // 3 min for compose
            totalBuildTime += estimatedBuildTime;
            deploymentsWithBuildTime++;
          }
          
          // Add to recent deployments
          deployments.push({
            id: domain,
            framework: framework,
            status: (site.target || site.containerName || site.staticPath) ? 'success' : 'failed',
            timestamp: site.createdAt || new Date().toISOString(),
            buildTime: site.buildTime || (site.type === 'container' ? 120 : site.type === 'compose' ? 180 : 30)
          });
        }
      } catch (error) {
        console.error(`Error processing deployment ${domain}:`, error);
        failedDeployments++;
      }
    }
    
    const avgBuildTime = deploymentsWithBuildTime > 0 ? totalBuildTime / deploymentsWithBuildTime : 0;
    const successRate = totalDeployments > 0 ? ((successfulDeployments / totalDeployments) * 100).toFixed(1) + '%' : '0%';
    
    // Sort recent deployments by timestamp, newest first
    const recentDeployments = deployments
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
    
    return {
      total: totalDeployments,
      successful: successfulDeployments,
      failed: failedDeployments,
      successRate: successRate,
      avgBuildTime: avgBuildTime,
      byFramework: frameworks,
      recentDeployments: recentDeployments
    };
  } catch (error) {
    console.error('Error getting deployment stats:', error);
    return {
      total: 0,
      successful: 0,
      failed: 0,
      successRate: '0%',
      avgBuildTime: 0,
      byFramework: {},
      recentDeployments: []
    };
  }
}

async function getBandwidthStats() {
  try {
    const keys = await redisClient.keys('site:*');
    let totalBandwidthOut = 0;
    let totalBandwidthIn = 0;
    const domainBandwidth = {};
    
    for (const key of keys) {
      const domain = key.replace('site:', '');
      try {
        const metricsData = await redisClient.hGetAll(`metrics:${domain}`);
        const bandwidthOut = parseInt(metricsData.bandwidthOut || 0);
        const bandwidthIn = parseInt(metricsData.bandwidthIn || 0);
        
        totalBandwidthOut += bandwidthOut;
        totalBandwidthIn += bandwidthIn;
        
        domainBandwidth[domain] = {
          bandwidthOut: bandwidthOut,
          bandwidthIn: bandwidthIn,
          total: bandwidthOut + bandwidthIn
        };
      } catch (e) {
        // Skip if no metrics
      }
    }
    
    return {
      totalBandwidthOut,
      totalBandwidthIn,
      totalBandwidth: totalBandwidthOut + totalBandwidthIn,
      byDomain: domainBandwidth
    };
  } catch (error) {
    console.error('Error getting bandwidth stats:', error);
    return {
      totalBandwidthOut: 0,
      totalBandwidthIn: 0,
      totalBandwidth: 0,
      byDomain: {}
    };
  }
}

// Request metrics endpoint
app.get('/api/_metrics/requests', async (req, res) => {
  try {
    // Parse Nginx logs for real-time data
    const logData = await parseNginxLogs();
    
    const keys = await redisClient.keys('site:*');
    let totalRequests = 0;
    let totalErrors = 0;
    let totalBandwidth = 0;
    let requestsByDomain = {};
    
    for (const key of keys) {
      const domain = key.replace('site:', '');
      try {
        const metricsData = await redisClient.hGetAll(`metrics:${domain}`);
        const requests = parseInt(metricsData.requests || 0);
        const errors = parseInt(metricsData.errors || 0);
        const bandwidth = parseInt(metricsData.totalBandwidth || 0);
        
        totalRequests += requests;
        totalErrors += errors;
        totalBandwidth += bandwidth;
        
        requestsByDomain[domain] = {
          requests: requests,
          errors: errors,
          bandwidth: bandwidth,
          bandwidthFormatted: formatBytes(bandwidth),
          avgResponseTime: parseFloat(metricsData.avgResponseTime || 0)
        };
      } catch (e) {
        // Skip if no metrics
      }
    }
    
    res.json({
      total: totalRequests,
      errors: totalErrors,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      avgResponseTime: Object.values(requestsByDomain).reduce((sum, d) => sum + d.avgResponseTime, 0) / Math.max(Object.keys(requestsByDomain).length, 1),
      totalBandwidth: totalBandwidth,
      totalBandwidthFormatted: formatBytes(totalBandwidth),
      byDomain: requestsByDomain,
      spinlets: requestsByDomain // Alias for compatibility
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bandwidth metrics endpoint
app.get('/api/_metrics/bandwidth', async (req, res) => {
  try {
    const bandwidthStats = await getBandwidthStats();
    res.json(bandwidthStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deployment metrics endpoint
app.get('/api/_metrics/deployments', async (req, res) => {
  try {
    const deploymentStats = await getDeploymentStats();
    res.json(deploymentStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Format bytes into human readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Health check endpoint
app.get('/api/_health', async (req, res) => {
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

// Container management endpoints
app.post('/api/sites/:domain/container/stop', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    await execAsync(`docker stop ${site.containerName}`);
    res.json({ message: 'Container stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sites/:domain/container/start', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    await execAsync(`docker start ${site.containerName}`);
    
    // Update container IP address after start
    await new Promise(resolve => setTimeout(resolve, 2000));
    const { stdout: containerIp } = await execAsync(`docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${site.containerName}`);
    site.target = `http://${containerIp.trim()}:${site.containerConfig.port}`;
    
    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    res.json({ message: 'Container started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sites/:domain/container/restart', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    await execAsync(`docker restart ${site.containerName}`);
    
    // Update container IP address after restart
    await new Promise(resolve => setTimeout(resolve, 2000));
    const { stdout: containerIp } = await execAsync(`docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${site.containerName}`);
    site.target = `http://${containerIp.trim()}:${site.containerConfig.port}`;
    
    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    res.json({ message: 'Container restarted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sites/:domain/container/logs', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    const lines = req.query.lines || 100;
    const { stdout } = await execAsync(`docker logs --tail ${lines} ${site.containerName}`);
    res.json({ logs: stdout });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sites/:domain/container/stats', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    const { stdout } = await execAsync(`docker stats ${site.containerName} --no-stream --format "json"`);
    const stats = JSON.parse(stdout);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// System health check endpoint
app.get('/api/health/system', async (req, res) => {
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

  // Check nginx health endpoint
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

// Container health check endpoint
app.get('/api/sites/:domain/container/health', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    // Check if container is running
    try {
      const { stdout } = await execAsync(`docker inspect -f '{{.State.Running}}' ${site.containerName}`);
      const isRunning = stdout.trim() === 'true';
      
      if (!isRunning) {
        return res.json({ healthy: false, status: 'stopped' });
      }
      
      // Get container health status if available
      const { stdout: healthStatus } = await execAsync(`docker inspect -f '{{.State.Health.Status}}' ${site.containerName}`);
      const health = healthStatus.trim();
      
      res.json({ 
        healthy: isRunning && (health === 'healthy' || health === '<no value>'),
        status: isRunning ? 'running' : 'stopped',
        health: health === '<no value>' ? 'no healthcheck' : health
      });
    } catch (error) {
      res.json({ healthy: false, status: 'not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute command in container
app.post('/api/sites/:domain/container/exec', async (req, res) => {
  try {
    const domain = req.params.domain;
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    // Execute command in container
    try {
      const { stdout, stderr } = await execAsync(`docker exec ${site.containerName} /bin/sh -c "${command.replace(/"/g, '\\"')}"`);
      res.json({ 
        output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''),
        stdout,
        stderr,
        exitCode: 0
      });
    } catch (error) {
      // Extract exit code from error
      const exitCode = error.code || 1;
      res.json({ 
        output: error.stdout + (error.stderr ? `\nSTDERR:\n${error.stderr}` : '') + `\nCommand failed with exit code ${exitCode}`,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Multi-container endpoints for compose deployments
app.get('/api/sites/:domain/containers', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    const containers = [];
    
    if (site.type === 'container' && site.containerName) {
      // Single container deployment
      containers.push({
        name: 'main',
        containerName: site.containerName,
        domain: site.domain
      });
    } else if (site.type === 'compose' && site.containers) {
      // Multi-container compose deployment
      site.containers.forEach(c => {
        containers.push({
          name: c.service,
          containerName: c.name,
          domain: site.services[c.service]?.subdomain || site.domain
        });
      });
    }
    
    // Get detailed stats for each container
    const containersWithStats = await Promise.all(containers.map(async (container) => {
      try {
        // Get container status
        const { stdout: statusOut } = await execAsync(`docker inspect -f '{{.State.Status}}' ${container.containerName}`);
        const status = statusOut.trim();
        
        // Get container stats if running
        let stats = null;
        if (status === 'running') {
          const { stdout: statsOut } = await execAsync(`docker stats ${container.containerName} --no-stream --format "json"`);
          stats = JSON.parse(statsOut);
        }
        
        // Get health check status
        let health = null;
        try {
          const { stdout: healthOut } = await execAsync(`docker inspect -f '{{json .State.Health}}' ${container.containerName}`);
          if (healthOut.trim() !== 'null') {
            health = JSON.parse(healthOut);
          }
        } catch (e) {
          // No health check configured
        }
        
        return {
          ...container,
          status,
          stats,
          health
        };
      } catch (error) {
        return {
          ...container,
          status: 'not found',
          error: error.message
        };
      }
    }));
    
    res.json({ containers: containersWithStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Container-specific operations for multi-container deployments
app.post('/api/sites/:domain/container/:service/:action', async (req, res) => {
  try {
    const { domain, service, action } = req.params;
    
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    let containerName = null;
    
    if (site.type === 'container' && service === 'main') {
      containerName = site.containerName;
    } else if (site.type === 'compose' && site.containers) {
      const container = site.containers.find(c => c.service === service);
      if (container) {
        containerName = container.name;
      }
    }
    
    if (!containerName) {
      return res.status(404).json({ error: 'Container not found' });
    }
    
    await execAsync(`docker ${action} ${containerName}`);
    
    // Update IP address if starting
    if (action === 'start' || action === 'restart') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (site.type === 'container') {
        const { stdout: containerIp } = await execAsync(`docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerName}`);
        site.target = `http://${containerIp.trim()}:${site.containerConfig.port}`;
        await redisClient.set(`site:${domain}`, JSON.stringify(site));
      }
    }
    
    res.json({ message: `Container ${action}ed successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get logs for specific container in multi-container deployment
app.get('/api/sites/:domain/container/:service/logs', async (req, res) => {
  try {
    const { domain, service } = req.params;
    const lines = req.query.lines || 100;
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    let containerName = null;
    
    if (site.type === 'container' && service === 'main') {
      containerName = site.containerName;
    } else if (site.type === 'compose' && site.containers) {
      const container = site.containers.find(c => c.service === service);
      if (container) {
        containerName = container.name;
      }
    }
    
    if (!containerName) {
      return res.status(404).json({ error: 'Container not found' });
    }
    
    const { stdout, stderr } = await execAsync(`docker logs --tail ${lines} ${containerName} 2>&1`);
    res.json({ logs: stdout });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute command in specific container
app.post('/api/sites/:domain/container/:service/exec', async (req, res) => {
  try {
    const { domain, service } = req.params;
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    let containerName = null;
    
    if (site.type === 'container' && service === 'main') {
      containerName = site.containerName;
    } else if (site.type === 'compose' && site.containers) {
      const container = site.containers.find(c => c.service === service);
      if (container) {
        containerName = container.name;
      }
    }
    
    if (!containerName) {
      return res.status(404).json({ error: 'Container not found' });
    }
    
    try {
      const { stdout, stderr } = await execAsync(`docker exec ${containerName} /bin/sh -c "${command.replace(/"/g, '\\"')}"`);
      res.json({ 
        output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''),
        stdout,
        stderr,
        exitCode: 0
      });
    } catch (error) {
      const exitCode = error.code || 1;
      res.json({ 
        output: error.stdout + (error.stderr ? `\nSTDERR:\n${error.stderr}` : '') + `\nCommand failed with exit code ${exitCode}`,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`SpinForge API (OpenResty version) listening on port ${PORT}`);
  console.log('No Caddy reloads needed - routes are read directly from Redis!');
});