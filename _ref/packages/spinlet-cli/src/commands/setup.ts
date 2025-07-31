import chalk from 'chalk';
import inquirer from 'inquirer';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import ora from 'ora';

export async function setupCommand() {
  console.log(chalk.bold('\n🚀 SpinForge CLI Quick Setup\n'));
  console.log('Let\'s get you started with SpinForge!\n');
  
  // Check if already configured
  const envPath = join(process.env.HOME || '~', '.spinforge', '.env');
  if (existsSync(envPath)) {
    console.log(chalk.yellow('You already have a configuration.'));
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Do you want to reconfigure?',
        default: false
      }
    ]);
    
    if (!proceed) {
      console.log(chalk.gray('\nRun ' + chalk.cyan('spinforge config') + ' to manage your settings.'));
      return;
    }
  }

  const { environment } = await inquirer.prompt([
    {
      type: 'list',
      name: 'environment',
      message: 'Which environment are you configuring?',
      choices: [
        { name: 'SpinForge Cloud (recommended)', value: 'cloud' },
        { name: 'Self-hosted SpinForge', value: 'self-hosted' },
        { name: 'Local Development', value: 'local' }
      ]
    }
  ]);

  let config: any = {};

  if (environment === 'cloud') {
    // Use SpinForge cloud defaults
    config = {
      apiUrl: 'https://api.spinforge.dev',
      webUrl: 'https://spinforge.dev',
      deploymentPath: '/spinforge/deployments'
    };
    
    console.log(chalk.green('\n✓ Using SpinForge Cloud configuration'));
  } else if (environment === 'local') {
    // Local development defaults
    config = {
      apiUrl: 'http://localhost:9006',
      webUrl: 'http://localhost:9010',
      deploymentPath: join(process.env.HOME || '~', '.spinforge', 'deployments')
    };
    
    console.log(chalk.green('\n✓ Using local development configuration'));
  } else {
    // Self-hosted - ask for details
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiUrl',
        message: 'API URL:',
        default: 'https://api.your-domain.com'
      },
      {
        type: 'input',
        name: 'webUrl',
        message: 'Web UI URL:',
        default: 'https://your-domain.com'
      },
      {
        type: 'input',
        name: 'deploymentPath',
        message: 'Deployment directory path:',
        default: join(process.env.HOME || '~', '.spinforge', 'deployments')
      }
    ]);

    config = {
      apiUrl: answers.apiUrl,
      webUrl: answers.webUrl,
      deploymentPath: answers.deploymentPath
    };

  }

  // Ask where to save config
  const { saveLocation } = await inquirer.prompt([
    {
      type: 'list',
      name: 'saveLocation',
      message: 'Where would you like to save the configuration?',
      choices: [
        { name: 'Current directory (spinforge.config.json)', value: 'local' },
        { name: 'Show environment variables to export', value: 'env' },
        { name: 'Both', value: 'both' }
      ]
    }
  ]);

  if (saveLocation === 'local' || saveLocation === 'both') {
    const configPath = join(process.cwd(), 'spinforge.config.json');
    const spinner = ora('Saving configuration...').start();
    
    try {
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      spinner.succeed(`Configuration saved to ${chalk.cyan(configPath)}`);
    } catch (error: any) {
      spinner.fail('Failed to save configuration');
      console.error(chalk.red('Error:'), error.message);
    }
  }

  if (saveLocation === 'env' || saveLocation === 'both') {
    console.log(chalk.bold('\n📋 Environment Variables:\n'));
    console.log(chalk.gray('# Add these to your shell profile or .env file:'));
    console.log(`export SPINFORGE_API_URL="${config.apiUrl}"`);
    console.log(`export SPINFORGE_WEB_URL="${config.webUrl}"`);
    console.log(`export SPINFORGE_DEPLOYMENTS="${config.deploymentPath}"`);
  }

  console.log(chalk.green('\n✅ Setup complete!\n'));
  console.log('Next steps:');
  console.log('1. Run ' + chalk.cyan('spinforge login') + ' to authenticate');
  console.log('2. Run ' + chalk.cyan('spinforge deploy') + ' to deploy your first app\n');
}