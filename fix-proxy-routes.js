#!/usr/bin/env node
/**
 * Script to fix proxy routes in Redis to use container names instead of IPs
 */

const redis = require('redis');

async function fixProxyRoutes() {
  // Create Redis client
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

    // Get all site keys
    const keys = await redisClient.keys('site:*');
    console.log(`Found ${keys.length} sites to check`);

    let updated = 0;
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        try {
          const site = JSON.parse(data);
          
          // Check if it's a container site with an IP-based target
          if (site.type === 'container' && site.containerName && site.target) {
            // Check if target uses an IP address (matches pattern like http://172.x.x.x:port)
            const ipPattern = /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/;
            if (ipPattern.test(site.target)) {
              const port = site.containerConfig?.port || site.target.split(':').pop();
              const oldTarget = site.target;
              site.target = `http://${site.containerName}:${port}`;
              
              // Save updated site
              await redisClient.set(key, JSON.stringify(site));
              console.log(`Updated ${site.domain}: ${oldTarget} -> ${site.target}`);
              updated++;
            }
          }
          
          // Also check for internal service proxies (admin-ui, website, api)
          if (site.type === 'proxy' && site.target) {
            const internalServices = {
              'http://172.18.0.14:80': 'http://admin-ui:80',
              'http://172.18.0.15:3000': 'http://website:3000',
              'http://172.18.0.12:8080': 'http://api:8080',
              'http://172.19.0.14:80': 'http://admin-ui:80',
              'http://172.19.0.15:3000': 'http://website:3000',
              'http://172.19.0.12:8080': 'http://api:8080'
            };
            
            // Check if it matches any known internal service IP
            for (const [ipTarget, nameTarget] of Object.entries(internalServices)) {
              if (site.target.startsWith(ipTarget.split(':').slice(0, -1).join(':'))) {
                const oldTarget = site.target;
                site.target = nameTarget;
                
                // Save updated site
                await redisClient.set(key, JSON.stringify(site));
                console.log(`Updated ${site.domain}: ${oldTarget} -> ${site.target}`);
                updated++;
                break;
              }
            }
          }
        } catch (e) {
          console.error(`Error parsing site data for ${key}:`, e);
        }
      }
    }

    console.log(`\nFixed ${updated} proxy routes`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await redisClient.quit();
  }
}

// Run the script
fixProxyRoutes();