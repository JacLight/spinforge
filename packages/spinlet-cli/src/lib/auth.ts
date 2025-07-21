import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

const CONFIG_FILE = join(homedir(), '.spinforge', 'config.json');

export interface AuthConfig {
  email: string;
  token: string;
  customerId: string;
  apiUrl?: string;
}

export function getAuthConfig(): AuthConfig {
  if (!existsSync(CONFIG_FILE)) {
    console.error(chalk.red('Error:'), 'Not logged in');
    console.log(chalk.gray('Run "spinforge login" to authenticate'));
    process.exit(1);
  }

  try {
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    return {
      ...config,
      apiUrl: config.apiUrl || process.env.SPINFORGE_API_URL || 'https://api.spinforge.com'
    };
  } catch (error) {
    console.error(chalk.red('Error:'), 'Invalid authentication file');
    console.log(chalk.gray('Run "spinforge login" to re-authenticate'));
    process.exit(1);
  }
}

export function getAuthHeaders(config?: AuthConfig) {
  const auth = config || getAuthConfig();
  return {
    'Authorization': `Bearer ${auth.token}`,
    'X-Customer-ID': auth.customerId,
  };
}