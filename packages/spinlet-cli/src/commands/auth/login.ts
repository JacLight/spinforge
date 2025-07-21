import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import axios from 'axios';
import { writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { toast } from 'sonner';

const CONFIG_DIR = join(homedir(), '.spinforge');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export async function loginCommand() {
  console.log(chalk.bold('\n🚀 Login to SpinForge\n'));

  const { email, password } = await inquirer.prompt([
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
    // Login to get session
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email,
      password,
    });

    if (!loginResponse.data.success) {
      throw new Error('Invalid credentials');
    }

    const { token, user } = loginResponse.data;

    // Save credentials
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(
      CONFIG_FILE,
      JSON.stringify(
        {
          email: user.email,
          token,
          customerId: user.customerId,
          apiUrl: 'http://localhost:3000/api',
        },
        null,
        2
      )
    );

    spinner.succeed('Successfully logged in!');
    
    console.log('\n' + chalk.green('✓') + ' Logged in as ' + chalk.cyan(user.email));
    console.log(chalk.gray(`Customer ID: ${user.customerId}`));
    console.log(chalk.gray(`Config saved to: ${CONFIG_FILE}`));
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