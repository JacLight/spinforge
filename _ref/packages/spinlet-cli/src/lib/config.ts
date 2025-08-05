import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

interface SpinForgeCliConfig {
  apiUrl?: string;
  webUrl?: string;
  deploymentPath?: string;
}

// Default configuration for SpinForge Cloud
const CLOUD_DEFAULTS = {
  apiUrl: 'https://api.spinforge.dev',
  webUrl: 'https://spinforge.dev',
  deploymentPath: '/spinforge/deployments'
};

/**
 * Load configuration from:
 * 1. Environment variables (highest priority)
 * 2. spinforge.config.json in current directory
 * 3. Cloud defaults (for apiUrl and webUrl only)
 */
export function loadConfig(): SpinForgeCliConfig {
  // Load from ~/.spinforge/.env if it exists
  const userEnvPath = join(homedir(), '.spinforge', '.env');
  if (existsSync(userEnvPath)) {
    dotenv.config({ path: userEnvPath });
  }
  
  // Start with cloud defaults for essential URLs
  const config: SpinForgeCliConfig = {
    apiUrl: CLOUD_DEFAULTS.apiUrl,
    webUrl: CLOUD_DEFAULTS.webUrl
  };
  
  // Try to load from spinforge.config.json
  const configPath = join(process.cwd(), 'spinforge.config.json');
  if (existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      Object.assign(config, fileConfig);
      console.log(chalk.gray(`Loaded configuration from ${configPath}`));
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Failed to parse ${configPath}`));
    }
  }
  
  // Environment variables override file config
  if (process.env.SPINFORGE_API_URL) {
    config.apiUrl = process.env.SPINFORGE_API_URL;
  }
  
  if (process.env.SPINFORGE_WEB_URL) {
    config.webUrl = process.env.SPINFORGE_WEB_URL;
  }
  
  if (process.env.SPINFORGE_DEPLOYMENTS) {
    config.deploymentPath = process.env.SPINFORGE_DEPLOYMENTS;
  }
  
  // Redis config removed - not relevant for CLI
  
  return config;
}

/**
 * Get required configuration value or throw error
 */
export function getRequiredConfig<K extends keyof SpinForgeCliConfig>(
  key: K
): NonNullable<SpinForgeCliConfig[K]> {
  const config = loadConfig();
  const value = config[key];
  
  if (value === undefined || value === null) {
    throw new Error(
      `${key} is not configured. Run 'spinforge setup' or set it in spinforge.config.json or via environment variables.`
    );
  }
  
  return value as NonNullable<SpinForgeCliConfig[K]>;
}

/**
 * Get optional configuration value
 */
export function getOptionalConfig<K extends keyof SpinForgeCliConfig>(
  key: K
): SpinForgeCliConfig[K] | undefined {
  const config = loadConfig();
  return config[key];
}