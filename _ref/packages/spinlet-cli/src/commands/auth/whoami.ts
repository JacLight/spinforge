import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_FILE = join(homedir(), '.spinforge', 'config.json');

export async function whoamiCommand() {
  try {
    if (!existsSync(CONFIG_FILE)) {
      console.log(chalk.yellow('Not logged in'));
      console.log(chalk.gray('Run "spinforge login" to authenticate'));
      return;
    }

    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    
    console.log('\n' + chalk.bold('Current User:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`Email:       ${chalk.cyan(config.email)}`);
    console.log(`Customer ID: ${chalk.yellow(config.customerId)}`);
    if (config.apiUrl) {
      console.log(`API URL:     ${chalk.gray(config.apiUrl)}`);
    }
    console.log(chalk.gray('─'.repeat(40)));
  } catch (error) {
    console.error(chalk.red('Error:'), 'Failed to read authentication info');
    process.exit(1);
  }
}