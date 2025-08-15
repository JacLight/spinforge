/**
 * SpinForge - Reliable Redis Connection with Retry Logic
 * Provides automatic reconnection and DNS resolution fallbacks
 */

const redis = require('redis');
const dns = require('dns').promises;
const { metrics } = require('./prometheus');
const logger = require('./logger');

class ReliableRedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 10;
    this.retryDelay = 1000; // Start with 1 second
    this.hostOptions = this.getHostOptions();
  }

  getHostOptions() {
    // Multiple ways to reach Redis/KeyDB
    return [
      process.env.REDIS_HOST || 'keydb',
      'spinforge-keydb',
      'keydb',
      'spinforge_keydb_1',
      'localhost' // Last resort if running on host network
    ];
  }

  async resolveHost() {
    // Try each host option until one resolves
    for (const host of this.hostOptions) {
      try {
        // Try to resolve the hostname
        if (host === 'localhost' || host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          // IP address or localhost, no need to resolve
          logger.info(`Using host directly: ${host}`);
          return host;
        }
        
        const addresses = await dns.resolve4(host);
        if (addresses && addresses.length > 0) {
          logger.info(`Resolved ${host} to ${addresses[0]}`);
          return addresses[0];
        }
      } catch (err) {
        logger.warn(`Failed to resolve ${host}: ${err.message}`);
      }
    }
    
    // If all DNS resolution fails, return the first option and let Redis client try
    logger.warn('DNS resolution failed for all hosts, using fallback');
    return this.hostOptions[0];
  }

  async connect() {
    while (this.connectionAttempts < this.maxRetries) {
      try {
        this.connectionAttempts++;
        
        // Resolve host with fallback options
        const host = await this.resolveHost();
        
        logger.info(`Redis connection attempt ${this.connectionAttempts} to ${host}`);
        
        this.client = redis.createClient({
          socket: {
            host: host,
            port: process.env.REDIS_PORT || 16378,
            reconnectStrategy: (retries) => {
              if (retries > 10) {
                logger.error('Redis reconnection limit reached');
                return new Error('Redis reconnection limit reached');
              }
              const delay = Math.min(retries * 100, 3000);
              logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
              return delay;
            },
            connectTimeout: 5000,
          },
          password: process.env.REDIS_PASSWORD || '',
          database: process.env.REDIS_DB || 1,
          // Enable offline queue to buffer commands
          enableOfflineQueue: true,
          // Retry commands that fail
          retryStrategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              logger.error('Redis connection refused');
              return new Error('Redis connection refused');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
              logger.error('Redis retry time exhausted');
              return new Error('Retry time exhausted');
            }
            if (options.attempt > 10) {
              logger.error('Redis retry attempts exhausted');
              return undefined;
            }
            // Exponential backoff
            return Math.min(options.attempt * 100, 3000);
          }
        });

        // Set up event handlers
        this.client.on('error', (err) => {
          logger.error('Redis Client Error:', err);
          metrics.keydbConnections.set(0);
          this.isConnected = false;
        });

        this.client.on('connect', () => {
          logger.info(`Connected to KeyDB at ${host}`);
          metrics.keydbConnections.set(1);
          this.isConnected = true;
          this.connectionAttempts = 0; // Reset on successful connection
          this.retryDelay = 1000; // Reset delay
        });

        this.client.on('ready', () => {
          logger.info('KeyDB client ready');
        });

        this.client.on('reconnecting', () => {
          logger.info('Reconnecting to KeyDB...');
        });

        // Connect to Redis
        await this.client.connect();
        
        // Test the connection
        await this.client.ping();
        
        logger.info('Redis connection established successfully');
        return this.client;
        
      } catch (error) {
        logger.error(`Redis connection attempt ${this.connectionAttempts} failed:`, error.message);
        
        if (this.connectionAttempts >= this.maxRetries) {
          throw new Error(`Failed to connect to Redis after ${this.maxRetries} attempts`);
        }
        
        // Exponential backoff with jitter
        const jitter = Math.random() * 1000;
        const delay = Math.min(this.retryDelay * Math.pow(2, this.connectionAttempts - 1), 30000) + jitter;
        
        logger.info(`Retrying Redis connection in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Failed to establish Redis connection');
  }

  async getClient() {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }
    return this.client;
  }

  // Wrap Redis commands to track metrics
  wrapCommands() {
    if (!this.client) return;
    
    const originalSendCommand = this.client.sendCommand;
    this.client.sendCommand = function(commandName, ...args) {
      metrics.keydbCommands.inc({ command: commandName });
      return originalSendCommand.apply(this, [commandName, ...args]);
    };
  }
}

// Create singleton instance
const reliableRedis = new ReliableRedisClient();

// Initialize connection
(async () => {
  try {
    const client = await reliableRedis.getClient();
    reliableRedis.wrapCommands();
    module.exports = client;
  } catch (error) {
    logger.error('Failed to initialize Redis client:', error);
    // Export a proxy that will retry on first use
    module.exports = new Proxy({}, {
      get: async (target, prop) => {
        const client = await reliableRedis.getClient();
        return client[prop];
      }
    });
  }
})();