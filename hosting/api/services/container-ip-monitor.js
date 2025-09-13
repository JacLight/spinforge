/**
 * Container IP Monitor Service
 * Monitors Docker events and updates container IP addresses in Redis
 * Solves the issue of IP changes on container restart/rebuild
 */

const Docker = require('dockerode');
const redis = require('../utils/redis');
const logger = require('../utils/logger');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

class ContainerIPMonitor {
  constructor() {
    this.eventStream = null;
    this.networkName = 'spinforge_spinforge'; // The network both OpenResty and containers share
  }

  /**
   * Start monitoring Docker events
   */
  async start() {
    logger.info('Starting Container IP Monitor Service');

    // Initial IP update for all running containers
    await this.updateAllContainerIPs();

    // Start watching Docker events
    this.watchDockerEvents();
  }

  /**
   * Get container IP on the SpinForge network
   */
  async getContainerIP(containerName) {
    try {
      const container = docker.getContainer(containerName);
      const info = await container.inspect();

      // Try to get IP from the SpinForge network
      if (info.NetworkSettings && info.NetworkSettings.Networks) {
        // Check both possible network names
        const ip = info.NetworkSettings.Networks[this.networkName]?.IPAddress ||
                   info.NetworkSettings.Networks['spinforge']?.IPAddress;

        if (ip) {
          return ip;
        }

        // Fallback: get first available IP
        const networks = Object.values(info.NetworkSettings.Networks);
        if (networks.length > 0 && networks[0].IPAddress) {
          logger.warn(`Using fallback IP for ${containerName}: ${networks[0].IPAddress}`);
          return networks[0].IPAddress;
        }
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get IP for container ${containerName}:`, error.message);
      return null;
    }
  }

  /**
   * Update IP for all running containers
   */
  async updateAllContainerIPs() {
    try {
      const containers = await docker.listContainers({ all: false });
      logger.info(`Updating IPs for ${containers.length} running containers`);

      for (const containerInfo of containers) {
        const containerName = containerInfo.Names[0].replace('/', '');
        if (containerName.startsWith('spinforge-') && !containerName.includes('spinforge-keydb')) {
          await this.updateContainerIP(containerInfo.Id, containerName);
        }
      }
    } catch (error) {
      logger.error('Failed to update container IPs:', error);
    }
  }

  /**
   * Update IP for a specific container
   */
  async updateContainerIP(containerId, containerName) {
    try {
      // Get the new IP address
      const newIP = await this.getContainerIP(containerName);
      if (!newIP) {
        logger.warn(`Could not get IP for container ${containerName}`);
        return;
      }

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

            // Extract port from current target or config
            let port = '3000'; // default
            if (site.target) {
              const match = site.target.match(/:(\d+)$/);
              if (match) port = match[1];
            } else if (site.containerConfig?.port) {
              port = site.containerConfig.port;
            }

            // Update target with new IP
            const newTarget = `http://${newIP}:${port}`;
            const oldTarget = site.target;

            if (oldTarget !== newTarget) {
              site.target = newTarget;
              site.containerIP = newIP;
              site.lastIPUpdate = new Date().toISOString();
              site.enabled = true;

              await redis.set(key, JSON.stringify(site));
              logger.info(`Updated IP for ${site.domain}: ${oldTarget} -> ${newTarget}`);
            }

            // Also update additional endpoints if they exist
            if (site.additionalEndpoints && site.additionalEndpoints.length > 0) {
              for (const endpoint of site.additionalEndpoints) {
                if (endpoint.enabled && endpoint.domain && endpoint.port) {
                  const endpointKey = `site:${endpoint.domain}`;
                  const endpointData = await redis.get(endpointKey);

                  if (endpointData) {
                    const endpointSite = JSON.parse(endpointData);
                    const newEndpointTarget = `http://${newIP}:${endpoint.port}`;

                    if (endpointSite.target !== newEndpointTarget) {
                      endpointSite.target = newEndpointTarget;
                      endpointSite.containerIP = newIP;
                      endpointSite.lastIPUpdate = new Date().toISOString();

                      await redis.set(endpointKey, JSON.stringify(endpointSite));
                      logger.info(`Updated IP for endpoint ${endpoint.domain}: -> ${newEndpointTarget}`);
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          logger.error(`Error processing site ${key}:`, e);
        }
      }
    } catch (error) {
      logger.error(`Failed to update IP for container ${containerName}:`, error);
    }
  }

  /**
   * Watch Docker events for container starts/restarts
   */
  async watchDockerEvents() {
    try {
      this.eventStream = await docker.getEvents({
        filters: {
          type: ['container'],
          event: ['start', 'restart', 'die', 'stop', 'kill', 'create']
        }
      });

      this.eventStream.on('data', async (chunk) => {
        try {
          const event = JSON.parse(chunk.toString());
          const containerName = event.Actor.Attributes.name;
          const containerId = event.Actor.ID;

          // Only process SpinForge containers
          if (!containerName.startsWith('spinforge-') || containerName.includes('spinforge-keydb')) {
            return;
          }

          logger.info(`Docker event: ${event.Action} for container ${containerName}`);

          if (event.Action === 'start' || event.Action === 'restart') {
            // Wait for container to be fully ready and get IP
            setTimeout(async () => {
              logger.info(`Updating IP for started/restarted container: ${containerName}`);
              await this.updateContainerIP(containerId, containerName);
            }, 5000); // Give container 5 seconds to fully initialize
          } else if (event.Action === 'create') {
            // For newly created containers, wait longer
            setTimeout(async () => {
              logger.info(`Updating IP for newly created container: ${containerName}`);
              await this.updateContainerIP(containerId, containerName);
            }, 10000);
          } else if (event.Action === 'die' || event.Action === 'stop' || event.Action === 'kill') {
            // Mark routes as disabled
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

      logger.info('Docker event monitoring started successfully');
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
            site.stoppedAt = new Date().toISOString();

            await redis.set(key, JSON.stringify(site));
            logger.info(`Disabled route for stopped container: ${site.domain || key.replace('site:', '')}`);
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
   * Stop the monitoring service
   */
  stop() {
    if (this.eventStream) {
      this.eventStream.destroy();
      this.eventStream = null;
    }
    logger.info('Container IP Monitor Service stopped');
  }
}

module.exports = ContainerIPMonitor;