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
const { execAsync } = require('../utils/docker');
const { formatBytes, parseBytes } = require('../utils/site-helpers');

// Get hosting metrics for a specific site
router.get('/sites/:domain/metrics', async (req, res) => {
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
router.get('/sites/:domain/logs', async (req, res) => {
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
router.get('/global', async (req, res) => {
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
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };
  } catch (error) {
    console.error('Error getting system metrics:', error);
    return {
      cpu: { usage: 0, cores: 1 },
      memory: { usagePercent: 0, used: 0, total: 0, free: 0 },
      disk: { usagePercent: 0, used: '0', total: '0' },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
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
  
  // Check Nginx/OpenResty
  try {
    await execAsync('docker ps | grep openresty');
    services.push({
      name: 'OpenResty',
      status: 'healthy',
      uptime: Date.now() / 1000,
      lastCheck: new Date().toISOString()
    });
  } catch (error) {
    services.push({
      name: 'OpenResty',
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

// Basic metrics endpoint (for UI compatibility)
router.get('/', async (req, res) => {
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
router.get('/all', async (req, res) => {
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

// Get deployment stats
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

// Deployment metrics endpoint
router.get('/deployments', async (req, res) => {
  try {
    const deploymentStats = await getDeploymentStats();
    res.json(deploymentStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bandwidth statistics
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

// Bandwidth metrics endpoint
router.get('/bandwidth', async (req, res) => {
  try {
    const bandwidthStats = await getBandwidthStats();
    res.json(bandwidthStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request metrics endpoint
router.get('/requests', async (req, res) => {
  try {
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

module.exports = router;