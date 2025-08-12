const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const redis = require('../utils/redis');
const logger = require('../utils/logger');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/**
 * Fix container routing by re-discovering all containers and updating their targets
 */
router.post('/fix-container-routing', async (req, res) => {
  try {
    logger.info('Starting container routing fix...');
    
    const results = {
      fixed: [],
      failed: [],
      notFound: []
    };
    
    // Get all running containers
    const containers = await docker.listContainers({ all: false });
    const containerMap = new Map();
    
    // Build a map of container names to their current network info
    for (const containerInfo of containers) {
      const containerName = containerInfo.Names[0].replace('/', '');
      const container = docker.getContainer(containerInfo.Id);
      const inspection = await container.inspect();
      
      // Get IP from spinforge network
      const networks = inspection.NetworkSettings.Networks;
      let containerIP = null;
      
      if (networks['spinforge_spinforge']) {
        containerIP = networks['spinforge_spinforge'].IPAddress;
      } else if (networks['spinforge']) {
        containerIP = networks['spinforge'].IPAddress;
      }
      
      if (containerIP) {
        containerMap.set(containerName, {
          id: containerInfo.Id,
          ip: containerIP,
          ports: inspection.Config.ExposedPorts
        });
      }
    }
    
    // Get all sites from Redis
    const keys = await redis.keys('site:*');
    
    for (const key of keys) {
      const data = await redis.get(key);
      if (!data) continue;
      
      try {
        const site = JSON.parse(data);
        
        // Only process container sites
        if (site.type === 'container' && site.containerName) {
          const containerInfo = containerMap.get(site.containerName);
          
          if (containerInfo) {
            // Update the target with current container info
            const port = site.containerConfig?.port || 80;
            const oldTarget = site.target;
            
            // Use IP address directly (more reliable than DNS)
            site.target = `http://${containerInfo.ip}:${port}`;
            
            // Store both IP and container name for reference
            site.actualIP = containerInfo.ip;
            site.containerIP = containerInfo.ip;
            site.lastFixed = new Date().toISOString();
            
            await redis.set(key, JSON.stringify(site));
            
            results.fixed.push({
              domain: site.domain,
              containerName: site.containerName,
              oldTarget: oldTarget,
              newTarget: site.target,
              actualIP: containerInfo.ip
            });
            
            logger.info(`Fixed routing for ${site.domain}: ${oldTarget} -> ${site.target}`);
          } else {
            results.notFound.push({
              domain: site.domain,
              containerName: site.containerName,
              reason: 'Container not running'
            });
          }
        }
        
        // Also fix additional endpoints
        if (site.additionalEndpoints && site.additionalEndpoints.length > 0) {
          for (const endpoint of site.additionalEndpoints) {
            if (endpoint.enabled && endpoint.domain && endpoint.port) {
              const endpointKey = `site:${endpoint.domain}`;
              const endpointData = await redis.get(endpointKey);
              
              if (endpointData) {
                const endpointSite = JSON.parse(endpointData);
                // Use IP address for additional endpoints too
                const containerInfo = containerMap.get(site.containerName);
                if (containerInfo) {
                  endpointSite.target = `http://${containerInfo.ip}:${endpoint.port}`;
                  endpointSite.containerIP = containerInfo.ip;
                }
                endpointSite.lastFixed = new Date().toISOString();
                await redis.set(endpointKey, JSON.stringify(endpointSite));
                
                results.fixed.push({
                  domain: endpoint.domain,
                  containerName: site.containerName,
                  newTarget: endpointSite.target,
                  type: 'additional-endpoint'
                });
              }
            }
          }
        }
        
      } catch (error) {
        results.failed.push({
          key: key,
          error: error.message
        });
      }
    }
    
    logger.info(`Container routing fix complete. Fixed: ${results.fixed.length}, Not found: ${results.notFound.length}, Failed: ${results.failed.length}`);
    
    res.json({
      success: true,
      message: `Fixed ${results.fixed.length} container routes`,
      results: results
    });
    
  } catch (error) {
    logger.error('Container routing fix failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get diagnostics information about container routing
 */
router.get('/container-routing-status', async (req, res) => {
  try {
    const diagnostics = {
      containers: [],
      sites: [],
      issues: []
    };
    
    // Get all running containers
    const containers = await docker.listContainers({ all: false });
    
    for (const containerInfo of containers) {
      const containerName = containerInfo.Names[0].replace('/', '');
      
      if (containerName.startsWith('spinforge-')) {
        const container = docker.getContainer(containerInfo.Id);
        const inspection = await container.inspect();
        
        const networks = inspection.NetworkSettings.Networks;
        let ip = null;
        
        if (networks['spinforge_spinforge']) {
          ip = networks['spinforge_spinforge'].IPAddress;
        }
        
        diagnostics.containers.push({
          name: containerName,
          id: containerInfo.Id.substring(0, 12),
          ip: ip,
          state: containerInfo.State,
          ports: containerInfo.Ports
        });
      }
    }
    
    // Check all container sites
    const keys = await redis.keys('site:*');
    
    for (const key of keys) {
      const data = await redis.get(key);
      if (!data) continue;
      
      try {
        const site = JSON.parse(data);
        
        if (site.type === 'container') {
          const containerRunning = diagnostics.containers.some(
            c => c.name === site.containerName
          );
          
          diagnostics.sites.push({
            domain: site.domain,
            containerName: site.containerName,
            target: site.target,
            containerRunning: containerRunning,
            lastFixed: site.lastFixed
          });
          
          if (!containerRunning) {
            diagnostics.issues.push({
              type: 'container_not_found',
              domain: site.domain,
              containerName: site.containerName,
              message: 'Container is not running'
            });
          }
          
          // Check if target uses IP instead of container name
          if (site.target && site.target.includes('172.')) {
            diagnostics.issues.push({
              type: 'using_ip_address',
              domain: site.domain,
              target: site.target,
              message: 'Target uses IP address instead of container name'
            });
          }
        }
      } catch (error) {
        // Skip invalid entries
      }
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics: diagnostics
    });
    
  } catch (error) {
    logger.error('Failed to get container routing status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;