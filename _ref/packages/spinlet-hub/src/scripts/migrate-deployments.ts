#!/usr/bin/env node

import { readdir, stat, mkdir, rename, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { parse as parseYaml } from 'yaml';
import { createLogger } from '@spinforge/shared';

const logger = createLogger('MigrationScript');

interface DeploymentConfig {
  name: string;
  customerId: string;
  domain: string | string[];
  framework: string;
}

async function loadDeploymentConfig(deploymentPath: string): Promise<DeploymentConfig | null> {
  // Try deploy.yaml first
  try {
    const yamlPath = join(deploymentPath, 'deploy.yaml');
    const content = await readFile(yamlPath, 'utf-8');
    return parseYaml(content);
  } catch {
    // Try deploy.json
    try {
      const jsonPath = join(deploymentPath, 'deploy.json');
      const content = await readFile(jsonPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

async function migrateDeployments(deploymentPath: string) {
  logger.info(`Starting migration of deployments in ${deploymentPath}`);
  
  try {
    const entries = await readdir(deploymentPath);
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const entry of entries) {
      const fullPath = join(deploymentPath, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        // Check if this is a deployment directory (has deploy.yaml/json)
        const config = await loadDeploymentConfig(fullPath);
        
        if (config && config.customerId) {
          // Check if it's already in the right structure
          const pathParts = entry.split('/');
          if (pathParts.length === 1) {
            // It's in the root, needs to be moved
            const customerPath = join(deploymentPath, config.customerId);
            const newPath = join(customerPath, entry);
            
            logger.info(`Migrating deployment: ${entry} -> ${config.customerId}/${entry}`);
            
            // Create customer directory if it doesn't exist
            await mkdir(customerPath, { recursive: true });
            
            // Move deployment to customer folder
            await rename(fullPath, newPath);
            
            logger.info(`Successfully migrated: ${entry}`);
            migratedCount++;
          } else {
            logger.info(`Skipping ${entry} - already in correct structure`);
            skippedCount++;
          }
        } else if (config && !config.customerId) {
          logger.warn(`Deployment ${entry} has no customerId - cannot migrate`);
          skippedCount++;
        } else if (!config) {
          // Might be a customer folder, skip it
          logger.debug(`Skipping ${entry} - no deployment config found`);
          skippedCount++;
        }
      }
    }
    
    logger.info(`Migration complete: ${migratedCount} migrated, ${skippedCount} skipped`);
  } catch (error) {
    logger.error('Migration failed', { error });
    process.exit(1);
  }
}

// Main execution
async function main() {
  const deploymentPath = process.argv[2] || process.env.DEPLOYMENT_PATH || '/opt/deployments';
  
  logger.info('SpinForge Deployment Migration Script');
  logger.info('=====================================');
  logger.info(`This script will migrate deployments from the old structure to the new customerId-based structure`);
  logger.info(`Deployment path: ${deploymentPath}`);
  logger.info('');
  
  // Check if deployment path exists
  try {
    await stat(deploymentPath);
  } catch {
    logger.error(`Deployment path does not exist: ${deploymentPath}`);
    process.exit(1);
  }
  
  // Start migration
  await migrateDeployments(deploymentPath);
}

// Run the script
main().catch(error => {
  logger.error('Unexpected error', { error });
  process.exit(1);
});