import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { table } from 'table';
import { getRequiredConfig } from '../lib/config';
import { getAuthConfig } from '../lib/auth';

interface ListOptions {
  json?: boolean;
}

export async function deploymentListCommand(options: ListOptions) {
  const spinner = ora('Fetching deployments...').start();

  try {
    const hubUrl = getRequiredConfig('apiUrl');
    const auth = getAuthConfig();
    
    // Fetch deployment statuses using customer API
    const response = await axios.get(`${hubUrl}/_api/customer/deployments`, {
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'X-Customer-ID': auth.customerId,
      }
    });
    const deployments = response.data;

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(deployments, null, 2));
      return;
    }

    if (!deployments || deployments.length === 0) {
      console.log(chalk.yellow('No deployments found'));
      return;
    }

    // Create table
    const tableData = [
      [
        chalk.bold('Name'),
        chalk.bold('Status'),
        chalk.bold('Domain'),
        chalk.bold('Customer'),
        chalk.bold('Framework'),
        chalk.bold('Time')
      ]
    ];

    for (const deployment of deployments) {
      const status = getStatusDisplay(deployment.status);
      const domains = Array.isArray(deployment.domains) 
        ? deployment.domains.join(', ') 
        : deployment.domain || '-';
      
      tableData.push([
        deployment.name,
        status,
        domains,
        deployment.customerId || '-',
        deployment.framework || '-',
        getRelativeTime(deployment.timestamp)
      ]);
    }

    console.log(table(tableData, {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      }
    }));

    // Show summary
    const summary = {
      total: deployments.length,
      success: deployments.filter((d: any) => d.status === 'success').length,
      failed: deployments.filter((d: any) => d.status === 'failed').length,
      building: deployments.filter((d: any) => d.status === 'building' || d.status === 'processing').length,
      pending: deployments.filter((d: any) => d.status === 'pending').length
    };

    console.log(chalk.gray('\nSummary:'));
    console.log(`Total: ${chalk.bold(summary.total)} | ` +
      `Success: ${chalk.green(summary.success)} | ` +
      `Failed: ${chalk.red(summary.failed)} | ` +
      `Building: ${chalk.blue(summary.building)} | ` +
      `Pending: ${chalk.yellow(summary.pending)}`);

  } catch (error: any) {
    spinner.fail('Failed to fetch deployments');
    
    if (axios.isAxiosError(error)) {
      console.error(chalk.red('\nError:'), error.response?.data?.error || error.message);
      if (error.code === 'ECONNREFUSED') {
        console.error(chalk.yellow('Make sure SpinHub is running'));
      }
    } else {
      console.error(chalk.red('\nError:'), error.message);
    }
    
    process.exit(1);
  }
}

function getStatusDisplay(status: string): string {
  switch (status) {
    case 'success':
      return chalk.green('● Success');
    case 'failed':
      return chalk.red('● Failed');
    case 'building':
    case 'processing':
      return chalk.blue('● Building');
    case 'pending':
      return chalk.yellow('● Pending');
    default:
      return chalk.gray('● Unknown');
  }
}

function getRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}