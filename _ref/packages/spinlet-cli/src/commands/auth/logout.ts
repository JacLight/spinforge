import chalk from 'chalk';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_FILE = join(homedir(), '.spinforge', 'config.json');

export async function logoutCommand() {
  try {
    if (existsSync(CONFIG_FILE)) {
      unlinkSync(CONFIG_FILE);
      console.log(chalk.green('✓') + ' Successfully logged out');
    } else {
      console.log(chalk.yellow('Already logged out'));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), 'Failed to logout');
    process.exit(1);
  }
}