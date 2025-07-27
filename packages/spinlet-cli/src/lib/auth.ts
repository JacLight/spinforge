import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { getRequiredConfig } from './config';

const CONFIG_FILE = join(homedir(), '.spinforge', 'config.json');

export interface AuthConfig {
  email?: string;
  token: string;
  customerId: string;
  apiUrl?: string;
  authMethod?: 'token' | 'email';
}

export function getAuthConfig(): AuthConfig {
  // Check environment variable first
  const envToken = process.env.SPINFORGE_TOKEN;
  if (envToken) {
    return {
      token: envToken,
      customerId: process.env.SPINFORGE_CUSTOMER_ID || extractCustomerIdFromToken(envToken),
      apiUrl: getApiUrl(),
      authMethod: 'token'
    };
  }
  
  if (!existsSync(CONFIG_FILE)) {
    console.error(chalk.red('Error:'), 'Not logged in');
    console.log(chalk.gray('Run "spinforge login" to authenticate'));
    process.exit(1);
  }

  try {
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    return {
      ...config,
      apiUrl: config.apiUrl || getApiUrl()
    };
  } catch (error) {
    console.error(chalk.red('Error:'), 'Invalid authentication file');
    console.log(chalk.gray('Run "spinforge login" to re-authenticate'));
    process.exit(1);
  }
}

function getApiUrl(): string {
  return getRequiredConfig('apiUrl');
}

function extractCustomerIdFromToken(token: string): string {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload.customerId || payload.sub || '';
    }
  } catch (e) {
    // Invalid JWT format
  }
  throw new Error('Could not extract customer ID from token and SPINFORGE_CUSTOMER_ID is not set');
}

export function getAuthHeaders(config?: AuthConfig) {
  const auth = config || getAuthConfig();
  return {
    'Authorization': `Bearer ${auth.token}`,
    'X-Customer-ID': auth.customerId,
    'X-Admin-Token': auth.token, // For SpinHub admin endpoints
  };
}