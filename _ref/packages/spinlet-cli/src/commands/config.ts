import chalk from 'chalk';
import inquirer from 'inquirer';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import ora from 'ora';

const CONFIG_DIR = join(homedir(), '.spinforge');
const ENV_FILE = join(CONFIG_DIR, '.env');

export async function configCommand() {
  console.log(chalk.bold('\n⚙️  SpinForge Configuration\n'));

  // Check if config exists
  let currentConfig: any = {};
  if (existsSync(ENV_FILE)) {
    console.log(chalk.gray(`Current configuration: ${ENV_FILE}\n`));
    
    // Parse existing config
    const envContent = readFileSync(ENV_FILE, 'utf-8');
    envContent.split('\n').forEach(line => {
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, value] = line.split('=');
        currentConfig[key.trim()] = value.trim();
      }
    });
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'View current configuration', value: 'view' },
        { name: 'Edit configuration', value: 'edit' },
        { name: 'Reset to defaults', value: 'reset' },
        { name: 'Switch environment (cloud/local/custom)', value: 'switch' }
      ]
    }
  ]);

  if (action === 'view') {
    console.log(chalk.bold('\nCurrent Configuration:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`API URL: ${chalk.cyan(currentConfig.SPINFORGE_API_URL || 'Not set')}`);
    console.log(`Web URL: ${chalk.cyan(currentConfig.SPINFORGE_WEB_URL || 'Not set')}`);
    console.log(`Deployments: ${chalk.cyan(currentConfig.SPINFORGE_DEPLOYMENTS || 'Not set')}`);
    console.log(`Customer ID: ${chalk.cyan(currentConfig.SPINFORGE_CUSTOMER_ID || 'Not set')}`);
    console.log(chalk.gray('─'.repeat(50)));
    return;
  }

  if (action === 'reset') {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Reset to default SpinForge Cloud configuration?',
        default: false
      }
    ]);

    if (confirm) {
      await saveConfig({
        SPINFORGE_API_URL: 'https://api.spinforge.dev',
        SPINFORGE_WEB_URL: 'https://spinforge.dev',
        SPINFORGE_DEPLOYMENTS: join(homedir(), '.spinforge', 'deployments'),
        ...getAuthTokens(currentConfig)
      });
      console.log(chalk.green('\n✓ Configuration reset to defaults'));
    }
    return;
  }

  if (action === 'switch') {
    const { environment } = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message: 'Select environment:',
        choices: [
          { name: 'SpinForge Cloud', value: 'cloud' },
          { name: 'Local Development', value: 'local' },
          { name: 'Custom/Self-hosted', value: 'custom' }
        ]
      }
    ]);

    let config: any = {};

    if (environment === 'cloud') {
      config = {
        SPINFORGE_API_URL: 'https://api.spinforge.dev',
        SPINFORGE_WEB_URL: 'https://spinforge.dev',
        SPINFORGE_DEPLOYMENTS: join(homedir(), '.spinforge', 'deployments')
      };
    } else if (environment === 'local') {
      config = {
        SPINFORGE_API_URL: 'http://localhost:9006',
        SPINFORGE_WEB_URL: 'http://localhost:9010',
        SPINFORGE_DEPLOYMENTS: join(homedir(), '.spinforge', 'deployments')
      };
    } else {
      // Custom configuration
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiUrl',
          message: 'API URL:',
          default: currentConfig.SPINFORGE_API_URL || 'https://api.your-domain.com',
          validate: (input) => {
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        },
        {
          type: 'input',
          name: 'webUrl',
          message: 'Web UI URL:',
          default: currentConfig.SPINFORGE_WEB_URL || 'https://your-domain.com',
          validate: (input) => {
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        },
        {
          type: 'input',
          name: 'deploymentPath',
          message: 'Deployment directory:',
          default: currentConfig.SPINFORGE_DEPLOYMENTS || join(homedir(), '.spinforge', 'deployments')
        }
      ]);

      config = {
        SPINFORGE_API_URL: answers.apiUrl,
        SPINFORGE_WEB_URL: answers.webUrl,
        SPINFORGE_DEPLOYMENTS: answers.deploymentPath
      };
    }

    // Preserve auth tokens
    config = { ...config, ...getAuthTokens(currentConfig) };
    await saveConfig(config);
    console.log(chalk.green('\n✓ Configuration updated'));
    return;
  }

  if (action === 'edit') {
    // Edit individual values
    const { field } = await inquirer.prompt([
      {
        type: 'list',
        name: 'field',
        message: 'Which setting to edit?',
        choices: [
          { name: 'API URL', value: 'SPINFORGE_API_URL' },
          { name: 'Web URL', value: 'SPINFORGE_WEB_URL' },
          { name: 'Deployment Path', value: 'SPINFORGE_DEPLOYMENTS' }
        ]
      }
    ]);

    const { value } = await inquirer.prompt([
      {
        type: 'input',
        name: 'value',
        message: `New value for ${field}:`,
        default: currentConfig[field],
        validate: (input) => {
          if (field.includes('URL')) {
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
          return true;
        }
      }
    ]);

    currentConfig[field] = value;
    await saveConfig(currentConfig);
    console.log(chalk.green(`\n✓ Updated ${field}`));
  }
}

function getAuthTokens(config: any) {
  const tokens: any = {};
  if (config.SPINFORGE_TOKEN) tokens.SPINFORGE_TOKEN = config.SPINFORGE_TOKEN;
  if (config.SPINFORGE_CUSTOMER_ID) tokens.SPINFORGE_CUSTOMER_ID = config.SPINFORGE_CUSTOMER_ID;
  return tokens;
}

async function saveConfig(config: any) {
  const spinner = ora('Saving configuration...').start();
  
  try {
    const envContent = `# SpinForge CLI Configuration
# Generated on ${new Date().toISOString()}

# API Configuration
SPINFORGE_API_URL=${config.SPINFORGE_API_URL}
SPINFORGE_WEB_URL=${config.SPINFORGE_WEB_URL}

# Deployment Configuration  
SPINFORGE_DEPLOYMENTS=${config.SPINFORGE_DEPLOYMENTS}

${config.SPINFORGE_TOKEN ? `# Authentication (auto-populated)
SPINFORGE_TOKEN=${config.SPINFORGE_TOKEN}
SPINFORGE_CUSTOMER_ID=${config.SPINFORGE_CUSTOMER_ID}` : ''}
`;

    writeFileSync(ENV_FILE, envContent);
    spinner.succeed('Configuration saved');
    
    console.log(chalk.gray(`\nConfiguration file: ${ENV_FILE}`));
    console.log(chalk.yellow(`To apply: source ~/.spinforge/.env`));
  } catch (error: any) {
    spinner.fail('Failed to save configuration');
    throw error;
  }
}