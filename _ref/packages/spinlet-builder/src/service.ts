#!/usr/bin/env node

import { createClient } from 'redis';
import { createLogger } from '@spinforge/shared';
import { Builder } from './Builder';
import { BuildConfig } from './types';
import path from 'path';
import fs from 'fs-extra';

const logger = createLogger('BuilderService');

class BuilderService {
  private redisClient: any;
  private builder: Builder;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.builder = new Builder(2); // Allow 2 concurrent builds
  }

  async start() {
    logger.info('Starting builder service...');

    // Connect to Redis
    await this.connectRedis();

    // Start polling for build jobs
    this.isRunning = true;
    this.startPolling();

    logger.info('Builder service started successfully');
  }

  private async connectRedis() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '16378');
    const redisPassword = process.env.REDIS_PASSWORD;

    this.redisClient = createClient({
      socket: {
        host: redisHost,
        port: redisPort
      },
      password: redisPassword
    });

    this.redisClient.on('error', (err: any) => {
      logger.error('Redis client error', { error: err });
    });

    this.redisClient.on('connect', () => {
      logger.info('Connected to Redis', { host: redisHost, port: redisPort });
    });

    await this.redisClient.connect();
  }

  private startPolling() {
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.checkForBuildJobs();
      } catch (error) {
        logger.error('Error checking for build jobs', { error });
      }
    }, 5000); // Check every 5 seconds
  }

  private async checkForBuildJobs() {
    // Check for pending build jobs in Redis queue
    const job = await this.redisClient.lPop('build:queue');
    
    if (!job) {
      return;
    }

    try {
      const buildRequest = JSON.parse(job);
      logger.info('Processing build job', { 
        customerId: buildRequest.customerId,
        spinletId: buildRequest.spinletId,
        domain: buildRequest.domain
      });

      await this.processBuildJob(buildRequest);
    } catch (error) {
      logger.error('Failed to process build job', { error, job });
      
      // Put the job back in the queue if it fails
      await this.redisClient.rPush('build:queue', job);
    }
  }

  private async processBuildJob(buildRequest: any) {
    const { customerId, spinletId, sourceDir, domain } = buildRequest;
    
    // Update build status
    await this.updateBuildStatus(customerId, spinletId, 'building');

    const buildConfig: BuildConfig = {
      sourceDir: sourceDir || path.join('/spinforge/apps', customerId, spinletId, 'source'),
      outputDir: path.join(process.env.BUILD_OUTPUT_DIR || '/spinforge/builds', customerId, spinletId),
      framework: 'auto',
      customerId,
      spinletId,
      env: buildRequest.env || {}
    };

    try {
      // Ensure source directory exists
      if (!await fs.pathExists(buildConfig.sourceDir)) {
        throw new Error(`Source directory not found: ${buildConfig.sourceDir}`);
      }

      // Execute build
      const result = await this.builder.build(buildConfig);

      if (result.success) {
        logger.info('Build completed successfully', {
          customerId,
          spinletId,
          framework: result.framework,
          duration: result.duration
        });

        // Update build status and result in Redis
        await this.updateBuildStatus(customerId, spinletId, 'success');
        await this.saveBuildResult(customerId, spinletId, result);

        // Notify hub that build is complete
        await this.notifyBuildComplete(customerId, spinletId, domain, result);
      } else {
        logger.error('Build failed', {
          customerId,
          spinletId,
          errors: result.errors
        });

        await this.updateBuildStatus(customerId, spinletId, 'failed', result.errors);
      }
    } catch (error: any) {
      logger.error('Build process error', {
        customerId,
        spinletId,
        error: error.message
      });

      await this.updateBuildStatus(customerId, spinletId, 'failed', [error.message]);
    }
  }

  private async updateBuildStatus(customerId: string, spinletId: string, status: string, errors?: string[]) {
    const key = `spinlet:${customerId}:${spinletId}:build:status`;
    const data = {
      status,
      timestamp: new Date().toISOString(),
      errors: errors || []
    };

    await this.redisClient.set(key, JSON.stringify(data), {
      EX: 3600 // Expire after 1 hour
    });
  }

  private async saveBuildResult(customerId: string, spinletId: string, result: any) {
    const key = `spinlet:${customerId}:${spinletId}:build:result`;
    await this.redisClient.set(key, JSON.stringify(result), {
      EX: 86400 // Expire after 24 hours
    });
  }

  private async notifyBuildComplete(customerId: string, spinletId: string, domain: string, result: any) {
    // Publish build completion event
    await this.redisClient.publish('build:complete', JSON.stringify({
      customerId,
      spinletId,
      domain,
      framework: result.framework,
      entryPoint: result.entryPoint,
      buildPath: result.buildPath,
      timestamp: new Date().toISOString()
    }));
  }

  async stop() {
    logger.info('Stopping builder service...');
    
    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Wait for pending builds to complete
    await this.builder.waitForIdle();

    // Disconnect from Redis
    if (this.redisClient) {
      await this.redisClient.quit();
    }

    logger.info('Builder service stopped');
  }
}

// Main function
async function main() {
  const service = new BuilderService();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      await service.stop();
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
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    process.exit(1);
  });

  try {
    await service.start();
  } catch (error) {
    logger.error('Failed to start builder service', { error });
    process.exit(1);
  }
}

// Run the service
main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});