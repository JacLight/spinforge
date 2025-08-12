/**
 * Service Registry for reliable container routing
 * Maintains a cache of container -> IP mappings
 */

const Docker = require('dockerode');
const redis = require('../utils/redis');
const logger = require('../utils/logger');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

class ServiceRegistry {
  constructor() {
    this.registry = new Map();
    this.updateInterval = null;
  }

  async start() {
    logger.info('Starting Service Registry');
    
    // Initial registry population
    await this.updateRegistry();
    
    // Update registry every 10 seconds
    this.updateInterval = setInterval(() => {
      this.updateRegistry().catch(err => {
        logger.error('Registry update failed:', err);
      });
    }, 10000);
  }

  async updateRegistry() {
    try {
      const containers = await docker.listContainers({ all: false });
      
      for (const containerInfo of containers) {
        const name = containerInfo.Names[0].replace('/', '');
        
        // Get container details
        const container = docker.getContainer(containerInfo.Id);
        const inspection = await container.inspect();
        
        // Find IP in the spinforge network
        const networks = inspection.NetworkSettings.Networks;
        let ip = null;
        
        if (networks['spinforge_spinforge']) {
          ip = networks['spinforge_spinforge'].IPAddress;
        } else if (networks['bridge']) {
          ip = networks['bridge'].IPAddress;
        }
        
        if (ip && name.startsWith('spinforge-')) {
          // Store in registry
          this.registry.set(name, {
            ip: ip,
            id: containerInfo.Id,
            ports: containerInfo.Ports,
            updated: new Date().toISOString()
          });
          
          // Also store in Redis for persistence
          await redis.set(`registry:${name}`, JSON.stringify({
            ip: ip,
            id: containerInfo.Id,
            hostname: name,
            updated: new Date().toISOString()
          }));
          
          logger.debug(`Registry updated: ${name} -> ${ip}`);
        }
      }
      
      // Clean up stale entries
      await this.cleanupStaleEntries();
      
    } catch (error) {
      logger.error('Failed to update registry:', error);
    }
  }

  async cleanupStaleEntries() {
    const keys = await redis.keys('registry:*');
    const runningContainers = Array.from(this.registry.keys());
    
    for (const key of keys) {
      const containerName = key.replace('registry:', '');
      if (!runningContainers.includes(containerName)) {
        await redis.del(key);
        logger.debug(`Removed stale registry entry: ${containerName}`);
      }
    }
  }

  async getContainerIP(containerName) {
    // First check memory cache
    const cached = this.registry.get(containerName);
    if (cached) {
      return cached.ip;
    }
    
    // Check Redis
    const data = await redis.get(`registry:${containerName}`);
    if (data) {
      const entry = JSON.parse(data);
      return entry.ip;
    }
    
    // Not found - trigger update
    await this.updateRegistry();
    const updated = this.registry.get(containerName);
    return updated ? updated.ip : null;
  }

  async resolveTarget(site) {
    if (site.type === 'container' && site.containerName) {
      const ip = await this.getContainerIP(site.containerName);
      if (ip) {
        const port = site.containerConfig?.port || 80;
        return `http://${ip}:${port}`;
      }
    }
    return site.target;
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    logger.info('Service Registry stopped');
  }
}

module.exports = new ServiceRegistry();