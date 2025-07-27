import chalk from 'chalk';
import { table } from 'table';
import inquirer from 'inquirer';
import axios from 'axios';
import { getRequiredConfig } from '../lib/config';

interface RouteOptions {
  customer?: string;
  add?: boolean;
  remove?: string;
}

export async function routesCommand(options: RouteOptions) {
  try {
    const hubUrl = getRequiredConfig('apiUrl');

    if (options.add) {
      // Interactive route addition
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'domain',
          message: 'Domain:',
          validate: (input) => {
            const domainRegex = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}$/;
            return domainRegex.test(input) || 'Please enter a valid domain';
          }
        },
        {
          type: 'input',
          name: 'customerId',
          message: 'Customer ID:',
          default: options.customer
        },
        {
          type: 'input',
          name: 'spinletId',
          message: 'Spinlet ID:',
          default: () => `spin-${Date.now()}`
        },
        {
          type: 'input',
          name: 'buildPath',
          message: 'Build path:',
          validate: (input) => input.length > 0 || 'Build path is required'
        },
        {
          type: 'list',
          name: 'framework',
          message: 'Framework:',
          choices: ['remix', 'nextjs', 'express', 'static']
        },
        {
          type: 'input',
          name: 'memory',
          message: 'Memory limit:',
          default: '512MB'
        },
        {
          type: 'input',
          name: 'cpu',
          message: 'CPU limit:',
          default: '0.5'
        }
      ]);

      const response = await axios.post(`${hubUrl}/_admin/routes`, {
        domain: answers.domain,
        customerId: answers.customerId,
        spinletId: answers.spinletId,
        buildPath: answers.buildPath,
        framework: answers.framework,
        config: {
          memory: answers.memory,
          cpu: answers.cpu
        }
      });

      if (response.data.success) {
        console.log(chalk.green('\n✓ Route added successfully'));
        console.log(`Domain ${chalk.cyan(answers.domain)} now points to ${chalk.yellow(answers.spinletId)}`);
      }
    } else if (options.remove) {
      // Remove route
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: `Are you sure you want to remove route for ${chalk.red(options.remove)}?`,
          default: false
        }
      ]);

      if (confirm.proceed) {
        await axios.delete(`${hubUrl}/_admin/routes/${options.remove}`);
        console.log(chalk.green(`\n✓ Route for ${options.remove} removed successfully`));
      } else {
        console.log(chalk.yellow('\nOperation cancelled'));
      }
    } else {
      // List routes
      let routes;
      
      if (options.customer) {
        const response = await axios.get(`${hubUrl}/_admin/customers/${options.customer}/routes`);
        routes = response.data;
        console.log(chalk.bold(`\nRoutes for customer ${options.customer}:`));
      } else {
        console.log(chalk.yellow('\nNote: Listing all routes is not implemented. Please specify a customer ID with -c flag.'));
        return;
      }

      if (routes.length === 0) {
        console.log(chalk.gray('No routes found'));
        return;
      }

      const tableData = [
        ['Domain', 'Spinlet ID', 'Framework', 'Memory', 'CPU', 'Build Path']
      ];

      routes.forEach((route: any) => {
        tableData.push([
          route.domain,
          route.spinletId,
          route.framework,
          route.config?.memory || 'default',
          route.config?.cpu || 'default',
          route.buildPath.length > 40 ? route.buildPath.slice(0, 37) + '...' : route.buildPath
        ]);
      });

      console.log(table(tableData));
    }
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error(chalk.red('Error:'), error.response?.data?.error || error.message);
    } else {
      console.error(chalk.red('Error:'), error.message);
    }
    process.exit(1);
  }
}