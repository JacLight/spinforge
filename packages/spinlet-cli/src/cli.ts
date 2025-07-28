#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { deployCommand } from './commands/deploy';
import { statusCommand } from './commands/status';
import { stopCommand } from './commands/stop';
import { routesCommand } from './commands/routes';
import { logsCommand } from './commands/logs';
import { deployFolderCommand } from './commands/deploy-folder';
import { deploymentListCommand } from './commands/deployment-list';
import { deploymentScanCommand } from './commands/deployment-scan';
import { watchCommand } from './commands/watch';
import { loginCommand } from './commands/auth/login';
import { logoutCommand } from './commands/auth/logout';
import { whoamiCommand } from './commands/auth/whoami';
import { versionCommand } from './commands/version';
import { setupCommand } from './commands/setup';
import { configCommand } from './commands/config';

const packageJson = require('../package.json');
const program = new Command();

program
  .name('spinforge')
  .description('SpinForge CLI - Deploy and manage applications with ease')
  .version(packageJson.version);

// Setup command (should be first)
program
  .command('setup')
  .description('Initial setup wizard for SpinForge CLI')
  .action(setupCommand);

// Config command
program
  .command('config')
  .description('Manage SpinForge CLI configuration')
  .action(configCommand);

// Auth commands
program
  .command('login')
  .description('Login to SpinForge')
  .action(loginCommand);

program
  .command('logout')
  .description('Logout from SpinForge')
  .action(logoutCommand);

program
  .command('whoami')
  .description('Display current user information')
  .action(whoamiCommand);

// Deploy command
program
  .command('deploy')
  .description('Deploy an application to SpinForge')
  .option('-p, --path <path>', 'Path to deploy (defaults to current directory)')
  .option('-d, --domain <domain>', 'Domain for the application')
  .option('-f, --framework <type>', 'Framework type (auto-detected if not specified)')
  .option('-n, --name <name>', 'Application name (defaults to package.json name)')
  .option('-m, --memory <size>', 'Memory limit (e.g., 512MB)', '512MB')
  .option('--cpu <limit>', 'CPU limit (e.g., 0.5)', '0.5')
  .option('--no-build', 'Skip build step')
  .option('-e, --env <vars...>', 'Environment variables (KEY=value)')
  .option('--override', 'Remove existing deployment and replace with new one')
  .action(deployCommand);

// Status command
program
  .command('status [spinletId]')
  .description('Get status of a spinlet or all spinlets')
  .option('-c, --customer <id>', 'Filter by customer ID')
  .action(statusCommand);

// Stop command
program
  .command('stop <spinletId>')
  .description('Stop a running spinlet')
  .action(stopCommand);

// Routes command
program
  .command('routes')
  .description('Manage domain routes')
  .option('-c, --customer <id>', 'Filter by customer ID')
  .option('--add', 'Add a new route')
  .option('--remove <domain>', 'Remove a route')
  .action(routesCommand);

// Logs command
program
  .command('logs <spinletId>')
  .description('Stream logs from a spinlet')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <number>', 'Number of lines to show', '100')
  .action(logsCommand);

// Deploy folder command (new)
program
  .command('deploy-folder <path>')
  .alias('df')
  .description('Prepare a folder for hot deployment')
  .option('-d, --domain <domain>', 'Domain for the application')
  .option('-c, --customer <id>', 'Customer ID')
  .option('-f, --framework <type>', 'Framework type (nextjs, remix, express, static)')
  .option('-n, --name <name>', 'Application name')
  .option('-m, --memory <size>', 'Memory limit (e.g., 512MB)', '512MB')
  .option('--cpu <limit>', 'CPU limit (e.g., 0.5)', '0.5')
  .option('-e, --env <vars...>', 'Environment variables (KEY=value)')
  .action(deployFolderCommand);

// Deployment list command
program
  .command('deployments')
  .alias('list')
  .alias('ls')
  .description('List all deployments')
  .option('--json', 'Output as JSON')
  .action(deploymentListCommand);

// Deployment scan command
program
  .command('scan')
  .alias('deployment-scan')
  .description('Scan deployment folder for new deployments')
  .action(deploymentScanCommand);

// Watch command
program
  .command('watch [path]')
  .description('Watch a directory and auto-deploy changes')
  .option('-d, --domain <domain>', 'Domain for the application')
  .option('-f, --framework <type>', 'Framework type (auto-detected if not specified)')
  .option('-n, --name <name>', 'Application name')
  .option('-m, --memory <size>', 'Memory limit (e.g., 512MB)', '512MB')
  .option('--cpu <limit>', 'CPU limit (e.g., 0.5)', '0.5')
  .option('-e, --env <vars...>', 'Environment variables (KEY=value)')
  .option('-i, --interval <ms>', 'Debounce interval in milliseconds', '10000')
  .option('--no-build', 'Skip build step')
  .option('--mode <mode>', 'Deployment mode (preview or development)', 'preview')
  .option('--override', 'Remove existing deployment and replace with new one')
  .action(watchCommand);

// Version command
program
  .command('version')
  .description('Display version information')
  .action(versionCommand);

// Error handling
program.exitOverride();

try {
  program.parse(process.argv);
} catch (error: any) {
  if (error.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
}

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log('\n' + chalk.yellow('First time?') + ' Run ' + chalk.cyan('spinforge setup') + ' to configure the CLI\n');
}