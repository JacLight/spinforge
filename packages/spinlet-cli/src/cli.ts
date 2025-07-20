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

const program = new Command();

program
  .name('spinforge')
  .description('CLI tool for managing SpinForge applications')
  .version('0.1.0');

// Deploy command
program
  .command('deploy <path>')
  .description('Deploy an application to SpinForge')
  .option('-d, --domain <domain>', 'Domain for the application')
  .option('-c, --customer <id>', 'Customer ID')
  .option('-f, --framework <type>', 'Framework type (remix, nextjs, express)', 'remix')
  .option('-m, --memory <size>', 'Memory limit (e.g., 512MB)', '512MB')
  .option('--cpu <limit>', 'CPU limit (e.g., 0.5)', '0.5')
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
  .description('Prepare a folder for hot deployment')
  .option('-d, --domain <domain>', 'Domain for the application')
  .option('-c, --customer <id>', 'Customer ID')
  .option('-f, --framework <type>', 'Framework type (nextjs, remix, express, static)')
  .option('-n, --name <name>', 'Application name')
  .option('-m, --memory <size>', 'Memory limit (e.g., 512MB)', '512MB')
  .option('--cpu <limit>', 'CPU limit (e.g., 0.5)', '0.5')
  .option('--skip-build', 'Skip build step (for pre-built apps)')
  .option('-e, --env <vars...>', 'Environment variables (KEY=value)')
  .action(deployFolderCommand);

// Deployment list command
program
  .command('deployments')
  .alias('deployment-list')
  .description('List all deployments')
  .option('--json', 'Output as JSON')
  .action(deploymentListCommand);

// Deployment scan command
program
  .command('deployment-scan')
  .description('Scan deployment folder for new deployments')
  .action(deploymentScanCommand);

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
}