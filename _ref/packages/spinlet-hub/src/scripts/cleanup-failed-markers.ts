#!/usr/bin/env node

import { readdir, stat, unlink, writeFile, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { createLogger } from '@spinforge/shared';

const logger = createLogger('CleanupScript');

async function cleanupFailedMarkers(deploymentPath: string) {
  logger.info(`Starting cleanup of failed markers in ${deploymentPath}`);
  
  try {
    await processDirectory(deploymentPath);
  } catch (error) {
    logger.error('Cleanup failed', { error });
    process.exit(1);
  }
}

async function processDirectory(dirPath: string, depth = 0): Promise<void> {
  if (depth > 3) return; // Don't go too deep
  
  const entries = await readdir(dirPath);
  
  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      // Recursively process subdirectories
      await processDirectory(fullPath, depth + 1);
    } else if (entry.startsWith('.failed-') && entry !== '.failed') {
      // Found an archived failed marker
      logger.info(`Found archived failed marker: ${fullPath}`);
      
      try {
        // Read the content
        const content = await readFile(fullPath, 'utf-8');
        const data = JSON.parse(content);
        
        // Check if there's a .failed file
        const failedPath = join(dirPath, '.failed');
        let existingContent: any[] = [];
        
        try {
          const existingData = await readFile(failedPath, 'utf-8');
          const parsed = JSON.parse(existingData);
          existingContent = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          // No existing .failed file
        }
        
        // Add this failure to the array
        existingContent.push(data);
        
        // Keep only the last 10
        if (existingContent.length > 10) {
          existingContent = existingContent.slice(-10);
        }
        
        // Write consolidated file
        await writeFile(failedPath, JSON.stringify(existingContent, null, 2));
        
        // Delete the archived file
        await unlink(fullPath);
        logger.info(`Cleaned up: ${basename(fullPath)}`);
      } catch (error) {
        logger.error(`Failed to process ${fullPath}`, { error });
      }
    }
  }
}

// Main execution
async function main() {
  const deploymentPath = process.argv[2] || process.env.DEPLOYMENT_PATH || '/opt/deployments';
  
  logger.info('SpinForge Failed Marker Cleanup Script');
  logger.info('======================================');
  logger.info(`This script will consolidate multiple .failed-* files into a single .failed file`);
  logger.info(`Deployment path: ${deploymentPath}`);
  logger.info('');
  
  // Check if deployment path exists
  try {
    await stat(deploymentPath);
  } catch {
    logger.error(`Deployment path does not exist: ${deploymentPath}`);
    process.exit(1);
  }
  
  // Start cleanup
  await cleanupFailedMarkers(deploymentPath);
  
  logger.info('Cleanup complete!');
}

// Run the script
main().catch(error => {
  logger.error('Unexpected error', { error });
  process.exit(1);
});