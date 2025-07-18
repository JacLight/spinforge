import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { nanoid } from 'nanoid';

interface DeployOptions {
  domain?: string;
  customer?: string;
  framework: string;
  memory: string;
  cpu: string;
}

export async function deployCommand(path: string, options: DeployOptions) {
  const spinner = ora('Deploying application...').start();

  try {
    // Validate path
    const absolutePath = resolve(path);
    if (!existsSync(absolutePath)) {
      throw new Error(`Path does not exist: ${path}`);
    }

    const stats = statSync(absolutePath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${path}`);
    }

    // Generate IDs if not provided
    const customerId = options.customer || `cust-${nanoid(8)}`;
    const spinletId = `spin-${nanoid(8)}`;
    const domain = options.domain || `${spinletId}.spinforge.local`;

    spinner.text = 'Registering application...';

    // Get SpinHub URL from environment or use default
    const hubUrl = process.env.SPINHUB_URL || 'http://localhost:8080';

    // Register route
    const response = await axios.post(`${hubUrl}/_admin/routes`, {
      domain,
      customerId,
      spinletId,
      buildPath: absolutePath,
      framework: options.framework,
      config: {
        memory: options.memory,
        cpu: options.cpu
      }
    });

    if (response.data.success) {
      spinner.succeed('Application deployed successfully!');
      
      console.log('\n' + chalk.green('Deployment Details:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`${chalk.bold('Domain:')}     ${chalk.cyan(domain)}`);
      console.log(`${chalk.bold('Spinlet ID:')} ${chalk.yellow(spinletId)}`);
      console.log(`${chalk.bold('Customer:')}   ${chalk.yellow(customerId)}`);
      console.log(`${chalk.bold('Framework:')}  ${options.framework}`);
      console.log(`${chalk.bold('Resources:')}  ${options.memory} memory, ${options.cpu} CPU`);
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`\n${chalk.bold('Access your app at:')} ${chalk.underline.blue(`http://${domain}`)}\n`);
    } else {
      throw new Error('Deployment failed');
    }
  } catch (error: any) {
    spinner.fail('Deployment failed');
    
    if (axios.isAxiosError(error)) {
      console.error(chalk.red('\nError:'), error.response?.data?.error || error.message);
    } else {
      console.error(chalk.red('\nError:'), error.message);
    }
    
    process.exit(1);
  }
}