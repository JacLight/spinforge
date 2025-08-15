#!/usr/bin/env node
/**
 * Setup static site configurations
 */

const redis = require('redis');

async function setupStaticSites() {
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

    // Static sites configuration
    const staticSites = [
      {
        domain: 'luxesaver.com',
        type: 'static',
        static_path: '/data/static/luxesaver_com',
        ssl_enabled: true,
        description: 'LuxeSaver Static Website',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        domain: 'vibe-studio.appmint.app',
        type: 'static',
        static_path: '/data/static/vibe-studio_appmint_app',
        ssl_enabled: true,
        description: 'Vibe Studio Static Website',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        domain: 'appmint.app',
        type: 'static',
        static_path: '/data/static/appmint_app',
        ssl_enabled: true,
        description: 'AppMint Static Website',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Add all static sites
    for (const site of staticSites) {
      const key = `site:${site.domain}`;
      await redisClient.set(key, JSON.stringify(site));
      console.log(`Created static site: ${site.domain} -> ${site.static_path}`);
    }

    console.log(`\nSetup ${staticSites.length} static sites successfully`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await redisClient.quit();
  }
}

setupStaticSites();