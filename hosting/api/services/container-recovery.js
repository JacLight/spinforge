/**
 * Container Recovery Service
 * Monitors Docker events and restores routes when containers restart
 */

const Docker = require('dockerode');
const redis = require('../utils/redis');
const logger = require('../utils/logger');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

class ContainerRecoveryService {
  constructor() {
    this.eventStream = null;
  }

  /**
   * Start monitoring Docker events
   */
  async start() {
    logger.info('Starting container recovery service');
    
    // Initial recovery check for all running containers
    await this.recoverAllContainers();
    
    // Start watching Docker events
    this.watchDockerEvents();
  }

  /**
   * Recover routes for all running containers
   */
  async recoverAllContainers() {
    try {
      const containers = await docker.listContainers({ all: false });
      logger.info(`Checking ${containers.length} running containers for recovery`);
      
      for (const containerInfo of containers) {
        await this.recoverContainer(containerInfo.Id, containerInfo.Names[0].replace('/', ''));
      }
    } catch (error) {
      logger.error('Failed to recover containers:', error);
    }
  }

  /**
   * Recover routes for a specific container
   */
  async recoverContainer(containerId, containerName) {
    try {
      // Look for sites that reference this container
      const keys = await redis.keys('site:*');
      
      for (const key of keys) {
        const data = await redis.get(key);
        if (!data) continue;
        
        try {
          const site = JSON.parse(data);
          
          // Check if this site references the container
          if (site.containerId === containerId || 
              site.containerName === containerName ||
              (site.target && site.target.includes(containerName))) {
            
            // Update the target to ensure it uses the current container name
            if (site.type === 'proxy' || site.type === 'container') {
              const port = site.containerConfig?.port || site.port || this.extractPort(site.target) || '80';
              // Always use container name, never IP addresses
              site.target = `http://${containerName}:${port}`;
              site.enabled = true;
              site.recoveredAt = new Date().toISOString();
              
              await redis.set(key, JSON.stringify(site));
              logger.info(`Recovered route: ${site.domain || key.replace('site:', '')} -> ${containerName}:${port}`);
            }
            
            // Also recover additional endpoints
            if (site.additionalEndpoints && site.additionalEndpoints.length > 0) {
              for (const endpoint of site.additionalEndpoints) {
                if (endpoint.enabled && endpoint.domain && endpoint.port) {
                  const endpointRoute = {
                    type: 'proxy',
                    domain: endpoint.domain,
                    target: `http://${containerName}:${endpoint.port}`,
                    enabled: true,
                    parentSite: site.domain,
                    isAdditionalEndpoint: true,
                    recoveredAt: new Date().toISOString()
                  };
                  
                  await redis.set(`site:${endpoint.domain}`, JSON.stringify(endpointRoute));
                  logger.info(`Recovered additional endpoint: ${endpoint.domain} -> ${containerName}:${endpoint.port}`);
                }
              }
            }
          }
        } catch (e) {
          logger.error(`Error processing site ${key}:`, e);
        }
      }
    } catch (error) {
      logger.error(`Failed to recover container ${containerName}:`, error);
    }
  }

  /**
   * Extract port from target URL
   */
  extractPort(target) {
    if (!target) return null;
    const match = target.match(/:(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Watch Docker events for container starts/restarts
   */
  async watchDockerEvents() {
    try {
      this.eventStream = await docker.getEvents({
        filters: {
          type: ['container'],
          event: ['start', 'restart', 'die', 'stop']
        }
      });

      this.eventStream.on('data', async (chunk) => {
        try {
          const event = JSON.parse(chunk.toString());
          const containerName = event.Actor.Attributes.name;
          const containerId = event.Actor.ID;
          
          logger.info(`Docker event: ${event.Action} for container ${containerName}`);
          
          if (event.Action === 'start' || event.Action === 'restart') {
            // Wait a bit for container to be fully up
            setTimeout(async () => {
              await this.recoverContainer(containerId, containerName);
            }, 3000);
          } else if (event.Action === 'die' || event.Action === 'stop') {
            // Mark routes as disabled but don't delete
            await this.disableContainerRoutes(containerId, containerName);
          }
        } catch (error) {
          logger.error('Error processing Docker event:', error);
        }
      });

      this.eventStream.on('error', (err) => {
        logger.error('Docker event stream error:', err);
        // Restart watching after a delay
        setTimeout(() => this.watchDockerEvents(), 5000);
      });
    } catch (error) {
      logger.error('Failed to watch Docker events:', error);
      // Retry after delay
      setTimeout(() => this.watchDockerEvents(), 5000);
    }
  }

  /**
   * Disable routes for stopped container
   */
  async disableContainerRoutes(containerId, containerName) {
    try {
      const keys = await redis.keys('site:*');
      
      for (const key of keys) {
        const data = await redis.get(key);
        if (!data) continue;
        
        try {
          const site = JSON.parse(data);
          
          if (site.containerId === containerId || 
              site.containerName === containerName ||
              (site.target && site.target.includes(containerName))) {
            
            site.enabled = false;
            site.disabledAt = new Date().toISOString();
            site.disabledReason = 'Container stopped';
            
            await redis.set(key, JSON.stringify(site));
            logger.info(`Disabled route: ${site.domain || key.replace('site:', '')}`);
          }
        } catch (e) {
          logger.error(`Error disabling site ${key}:`, e);
        }
      }
    } catch (error) {
      logger.error(`Failed to disable routes for container ${containerName}:`, error);
    }
  }

  /**
   * Stop the recovery service
   */
  stop() {
    if (this.eventStream) {
      this.eventStream.destroy();
      this.eventStream = null;
    }
    logger.info('Container recovery service stopped');
  }
}

module.exports = new ContainerRecoveryService();