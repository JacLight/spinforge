#!/usr/bin/env node

import { SpinHub } from './SpinHub';
import { createLogger } from '@spinforge/shared';

const logger = createLogger('SpinHub:Server');

async function main() {
  const hub = new SpinHub({
    port: parseInt(process.env.PORT || '8080'),
    host: process.env.HOST || '0.0.0.0',
    ssl: {
      enabled: process.env.SSL_ENABLED === 'true',
      cert: process.env.SSL_CERT,
      key: process.env.SSL_KEY
    },
    rateLimits: {
      global: {
        windowMs: 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_GLOBAL || '1000'),
        standardHeaders: true,
        legacyHeaders: false
      },
      perCustomer: {
        windowMs: 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_CUSTOMER || '100'),
        standardHeaders: true,
        legacyHeaders: false
      }
    }
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      await hub.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    shutdown('unhandledRejection');
  });

  try {
    await hub.start();
    logger.info('SpinHub started successfully');
  } catch (error) {
    logger.error('Failed to start SpinHub', { error });
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});