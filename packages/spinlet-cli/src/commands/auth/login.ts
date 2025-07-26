import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
// import axios from 'axios';
import { writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
// import { toast } from 'sonner';
import { startAuthServer } from '../../lib/auth-server';

const CONFIG_DIR = join(homedir(), '.spinforge');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export async function loginCommand() {
  console.log(chalk.bold('\n🚀 Login to SpinForge\n'));

  // Check if --token flag was provided
  const args = process.argv.slice(3);
  const tokenIndex = args.indexOf('--token');
  
  if (tokenIndex !== -1 && args[tokenIndex + 1]) {
    // Token provided via command line
    const token = args[tokenIndex + 1];
    await saveTokenConfig(token);
    return;
  }

  // Ask user how they want to authenticate
  const { authMethod } = await inquirer.prompt([
    {
      type: 'list',
      name: 'authMethod',
      message: 'How would you like to authenticate?',
      choices: [
        { name: 'Open browser to login (recommended)', value: 'browser' },
        { name: 'Paste an existing token', value: 'token' },
        { name: 'Use email/password (deprecated)', value: 'email' }
      ]
    }
  ]);

  if (authMethod === 'browser') {
    const spinner = ora('Starting authentication server...').start();
    
    try {
      // Start local server to receive callback
      const authServerPromise = startAuthServer();
      
      // Open browser for authentication
      const authUrl = process.env.SPINFORGE_WEB_URL || 'https://spinforge.dev';
      const callbackUrl = encodeURIComponent('http://localhost:9876/callback');
      const cliAuthUrl = `${authUrl}/cli?callback=true&return_url=${callbackUrl}`;
      
      spinner.text = 'Opening browser for authentication...';
      console.log(chalk.gray(`\nIf browser doesn't open, visit: ${cliAuthUrl}\n`));
      
      // Try to open browser
      const open = require('open');
      try {
        await open(cliAuthUrl);
      } catch (e) {
        console.log(chalk.yellow('Could not open browser automatically.'));
      }
      
      spinner.text = 'Waiting for authentication...';
      
      // Wait for auth callback
      const authResult = await authServerPromise;
      
      spinner.stop();
      
      // Save the token
      await saveConfig({
        token: authResult.token,
        customerId: authResult.customerId,
        email: authResult.email,
        apiUrl: process.env.SPINHUB_URL || 'http://localhost:8080',
        authMethod: 'token'
      });
      
      console.log('\n' + chalk.green('✓') + ' Successfully authenticated!');
      if (authResult.email) {
        console.log(chalk.gray(`Email: ${authResult.email}`));
      }
      console.log(chalk.gray(`Customer ID: ${authResult.customerId}`));
      console.log(chalk.gray(`Config saved to: ${CONFIG_FILE}`));
      console.log('\n' + chalk.cyan('You can now use SpinForge CLI commands!'));
      
    } catch (error: any) {
      spinner.fail('Authentication failed');
      console.error(chalk.red('\nError:'), error.message);
      
      // Fallback to manual token entry
      console.log(chalk.yellow('\nFalling back to manual token entry...'));
      const { token } = await inquirer.prompt([
        {
          type: 'password',
          name: 'token',
          message: 'Paste your token here:',
          mask: '*',
          validate: (input) => {
            if (!input || input.length < 20) {
              return 'Please enter a valid token';
            }
            return true;
          }
        }
      ]);
      
      await saveTokenConfig(token);
    }
    return;
  }
  
  if (authMethod === 'token') {
    // Direct token input
    const { token } = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'Enter your SpinForge API token:',
        mask: '*',
        validate: (input) => {
          if (!input || input.length < 20) {
            return 'Please enter a valid token';
          }
          return true;
        }
      }
    ]);
    
    await saveTokenConfig(token);
    return;
  }

  // Legacy email/password method
  console.log(chalk.yellow('\n⚠️  Email/password authentication is deprecated. Consider using token authentication.\n'));
  
  const { email } = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      validate: (input) => {
        if (!input.includes('@')) {
          return 'Please enter a valid email address';
        }
        return true;
      },
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '*',
    },
  ]);

  const spinner = ora('Logging in...').start();

  try {
    // For legacy email login, still use simulated auth
    const user = {
      email,
      customerId: email.split('@')[0],
    };
    const token = 'legacy-token-' + Date.now();
    
    await saveConfig({
      email: user.email,
      token,
      customerId: user.customerId,
      apiUrl: process.env.SPINHUB_URL || 'http://localhost:8080',
      authMethod: 'email'
    });
    
    spinner.succeed('Successfully logged in!');
    console.log('\n' + chalk.green('✓') + ' Logged in as ' + chalk.cyan(user.email));
    console.log(chalk.gray(`Customer ID: ${user.customerId}`));
    console.log(chalk.yellow('\n⚠️  Please generate a proper API token for production use.'));
  } catch (error: any) {
    spinner.fail('Login failed');
    
    if (error.response?.status === 401) {
      console.error(chalk.red('\nError: Invalid email or password'));
    } else {
      console.error(chalk.red('\nError:'), error.message);
    }
    
    process.exit(1);
  }
}

async function saveTokenConfig(token: string) {
  const spinner = ora('Validating token...').start();
  
  try {
    // Extract user info from token (in production, validate with API)
    // For now, parse the token to get basic info
    const tokenParts = token.split('.');
    let customerId = 'default';
    
    // Try to decode token payload if it's a JWT
    if (tokenParts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        customerId = payload.customerId || payload.sub || 'default';
      } catch (e) {
        // Not a JWT, use default
      }
    }
    
    await saveConfig({
      token,
      customerId,
      apiUrl: process.env.SPINHUB_URL || 'http://localhost:8080',
      authMethod: 'token'
    });
    
    spinner.succeed('Successfully authenticated!');
    console.log('\n' + chalk.green('✓') + ' Authentication saved');
    console.log(chalk.gray(`Customer ID: ${customerId}`));
    console.log(chalk.gray(`Config saved to: ${CONFIG_FILE}`));
    console.log('\n' + chalk.cyan('You can now use SpinForge CLI commands!'));
  } catch (error: any) {
    spinner.fail('Failed to save authentication');
    console.error(chalk.red('\nError:'), error.message);
    process.exit(1);
  }
}

async function saveConfig(config: any) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}