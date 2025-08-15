#!/usr/bin/env node
/**
 * Setup internal service routes with reliable DNS
 */

const redis = require('redis');

async function setupInternalRoutes() {
  const redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || 'keydb',
      port: process.env.REDIS_PORT || 16378
    },
    password: process.env.REDIS_PASSWORD || '',
    database: process.env.REDIS_DB || 1
  });

  try {
    await redisClient.connect();
    console.log('Connected to Redis');

    // Define internal services - using both container names and IPs as fallback
    const internalServices = [
      {
        domain: 'admin.spinforge.dev',
        type: 'proxy',
        target: 'http://spinforge-admin-ui:80',  // Use full container name
        fallbackTarget: 'http://admin-ui:80',
        ssl_enabled: false,
        description: 'SpinForge Admin UI',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        domain: 'api.spinforge.dev', 
        type: 'proxy',
        target: 'http://spinforge-api:8080',  // Use full container name
        fallbackTarget: 'http://api:8080',
        ssl_enabled: false,
        description: 'SpinForge API',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        domain: 'www.spinforge.dev',
        type: 'proxy',
        target: 'http://spinforge-website:3000',  // Use full container name
        fallbackTarget: 'http://website:3000',
        ssl_enabled: false,
        description: 'SpinForge Website',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Also add localhost versions for local development
    const localhostServices = [
      {
        domain: 'admin.localhost',
        type: 'proxy',
        target: 'http://spinforge-admin-ui:80',
        ssl_enabled: false,
        description: 'SpinForge Admin UI (localhost)',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        domain: 'api.localhost',
        type: 'proxy', 
        target: 'http://spinforge-api:8080',
        ssl_enabled: false,
        description: 'SpinForge API (localhost)',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Add all routes
    const allServices = [...internalServices, ...localhostServices];
    
    for (const service of allServices) {
      const key = `site:${service.domain}`;
      await redisClient.set(key, JSON.stringify(service));
      console.log(`Created route: ${service.domain} -> ${service.target}`);
    }

    console.log(`\nSetup ${allServices.length} internal routes successfully`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await redisClient.quit();
  }
}

setupInternalRoutes();