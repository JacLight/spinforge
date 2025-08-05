#!/usr/bin/env node

import Redis from 'ioredis';
import { createLogger } from '@spinforge/shared';

const logger = createLogger('DomainCleanup');

async function cleanupDomain(domain: string) {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'keydb',
    port: parseInt(process.env.REDIS_PORT || '16378'),
    password: process.env.REDIS_PASSWORD
  });

  try {
    // Check if the domain exists
    const routeData = await redis.hget('spinforge:routes', domain);
    
    if (routeData) {
      const route = JSON.parse(routeData);
      logger.info(`Found route for domain: ${domain}`, {
        customerId: route.customerId,
        spinletId: route.spinletId,
        buildPath: route.buildPath
      });
      
      // Ask for confirmation
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise<string>(resolve => {
        readline.question(`Do you want to remove this route? (yes/no): `, resolve);
      });
      
      readline.close();
      
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        // Remove the route
        await redis.hdel('spinforge:routes', domain);
        logger.info(`Successfully removed route for domain: ${domain}`);
        
        // Also remove from customer routes if exists
        if (route.customerId) {
          await redis.srem(`spinforge:customer:${route.customerId}:routes`, domain);
        }
      } else {
        logger.info('Cleanup cancelled');
      }
    } else {
      logger.warn(`No route found for domain: ${domain}`);
    }
  } catch (error) {
    logger.error('Failed to cleanup domain', { error });
  } finally {
    await redis.quit();
  }
}

// Main execution
async function main() {
  const domain = process.argv[2];
  
  if (!domain) {
    console.error('Usage: cleanup-domain <domain>');
    console.error('Example: cleanup-domain proxy-test.localhost');
    process.exit(1);
  }
  
  logger.info(`Cleaning up domain: ${domain}`);
  await cleanupDomain(domain);
}

// Run the script
main().catch(error => {
  logger.error('Unexpected error', { error });
  process.exit(1);
});