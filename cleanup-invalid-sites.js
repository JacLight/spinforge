#!/usr/bin/env node

const redis = require('redis');

async function cleanupInvalidSites() {
  const redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 16378
    },
    password: process.env.REDIS_PASSWORD || '',
    database: process.env.REDIS_DB || 1
  });
  
  await redisClient.connect();

  try {
    console.log('Fetching all sites from Redis...');
    
    // Get all site keys
    const keys = await redisClient.keys('site:*');
    console.log(`Found ${keys.length} total sites`);
    
    let deletedCount = 0;
    const sitesToDelete = [];
    
    for (const key of keys) {
      const siteData = await redisClient.get(key);
      
      if (!siteData) {
        sitesToDelete.push(key);
        continue;
      }
      
      try {
        const site = JSON.parse(siteData);
        
        // Check if site has no domain or domain is empty/undefined
        if (!site.domain || site.domain === '' || site.domain === 'undefined' || site.domain === 'null') {
          console.log(`Marking for deletion: ${key} (no domain configured)`);
          sitesToDelete.push(key);
        } else if (site.isAdditionalEndpoint && !site.parentSite) {
          // Clean up orphaned additional endpoints
          console.log(`Marking for deletion: ${key} (orphaned endpoint)`);
          sitesToDelete.push(key);
        } else {
          console.log(`Keeping: ${site.domain} (${site.type})`);
        }
      } catch (e) {
        console.log(`Invalid JSON in ${key}, marking for deletion`);
        sitesToDelete.push(key);
      }
    }
    
    // Delete invalid sites
    if (sitesToDelete.length > 0) {
      console.log(`\nDeleting ${sitesToDelete.length} invalid sites...`);
      
      for (const key of sitesToDelete) {
        await redisClient.del(key);
        console.log(`Deleted: ${key}`);
        deletedCount++;
      }
    }
    
    console.log(`\nCleanup complete. Deleted ${deletedCount} invalid sites.`);
    
    // Show remaining valid sites
    const remainingKeys = await redisClient.keys('site:*');
    console.log(`\nRemaining sites (${remainingKeys.length}):`);
    
    for (const key of remainingKeys) {
      const siteData = await redis.get(key);
      if (siteData) {
        try {
          const site = JSON.parse(siteData);
          console.log(`- ${site.domain} (${site.type})`);
        } catch (e) {
          // Skip
        }
      }
    }
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await redisClient.disconnect();
  }
}

// Run the cleanup
cleanupInvalidSites();