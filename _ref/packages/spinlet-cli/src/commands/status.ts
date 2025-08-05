import chalk from 'chalk';
import { table } from 'table';
import axios from 'axios';
import { getRequiredConfig } from '../lib/config';

export async function statusCommand(spinletId?: string, options?: { customer?: string }) {
  try {
    const hubUrl = getRequiredConfig('apiUrl');

    if (spinletId) {
      // Get status of specific spinlet
      const response = await axios.get(`${hubUrl}/_admin/spinlets/${spinletId}`);
      const state = response.data;

      console.log('\n' + chalk.green('Spinlet Status:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`${chalk.bold('ID:')}         ${chalk.yellow(state.spinletId)}`);
      console.log(`${chalk.bold('Customer:')}   ${chalk.yellow(state.customerId)}`);
      console.log(`${chalk.bold('State:')}      ${getStateColor(state.state)}`);
      console.log(`${chalk.bold('PID:')}        ${state.pid}`);
      console.log(`${chalk.bold('Port:')}       ${state.port}`);
      console.log(`${chalk.bold('Started:')}    ${new Date(state.startTime).toLocaleString()}`);
      console.log(`${chalk.bold('Last Access:')} ${new Date(state.lastAccess).toLocaleString()}`);
      console.log(`${chalk.bold('Requests:')}   ${state.requests}`);
      console.log(`${chalk.bold('Errors:')}     ${state.errors}`);
      console.log(`${chalk.bold('Memory:')}     ${formatBytes(state.memory)}`);
      console.log(`${chalk.bold('CPU:')}        ${state.cpu.toFixed(2)}%`);
      console.log(chalk.gray('─'.repeat(40)) + '\n');
    } else {
      // Get all spinlets
      const metricsResponse = await axios.get(`${hubUrl}/_metrics`);
      const metrics = metricsResponse.data;

      console.log('\n' + chalk.green('SpinForge Status:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`${chalk.bold('Active Spinlets:')} ${chalk.cyan(metrics.activeSpinlets)}`);
      console.log(`${chalk.bold('Allocated Ports:')} ${chalk.cyan(metrics.allocatedPorts)}`);
      console.log(`${chalk.bold('Uptime:')}          ${formatUptime(metrics.uptime)}`);
      console.log(`${chalk.bold('Memory Usage:')}    ${formatBytes(metrics.memory.heapUsed)} / ${formatBytes(metrics.memory.heapTotal)}`);
      console.log(chalk.gray('─'.repeat(40)) + '\n');

      // If customer filter is provided, show customer routes
      if (options?.customer) {
        const routesResponse = await axios.get(`${hubUrl}/_admin/customers/${options.customer}/routes`);
        const routes = routesResponse.data;

        if (routes.length > 0) {
          const tableData = [
            ['Domain', 'Spinlet ID', 'Framework', 'Memory', 'CPU']
          ];

          routes.forEach((route: any) => {
            tableData.push([
              route.domain,
              route.spinletId,
              route.framework,
              route.config?.memory || 'default',
              route.config?.cpu || 'default'
            ]);
          });

          console.log(chalk.bold(`Routes for customer ${options?.customer}:`));
          console.log(table(tableData));
        } else {
          console.log(chalk.yellow(`No routes found for customer ${options?.customer}`));
        }
      }
    }
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.error(chalk.red('Spinlet not found'));
    } else {
      console.error(chalk.red('Error:'), error.message);
    }
    process.exit(1);
  }
}

function getStateColor(state: string): string {
  switch (state) {
    case 'running':
      return chalk.green(state);
    case 'starting':
      return chalk.yellow(state);
    case 'stopping':
      return chalk.yellow(state);
    case 'stopped':
      return chalk.gray(state);
    case 'crashed':
      return chalk.red(state);
    default:
      return state;
  }
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '0m';
}