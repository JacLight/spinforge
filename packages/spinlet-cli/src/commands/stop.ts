import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { getRequiredConfig } from '../lib/config';

export async function stopCommand(spinletId: string) {
  const spinner = ora(`Stopping spinlet ${spinletId}...`).start();

  try {
    const hubUrl = getRequiredConfig('apiUrl');
    
    const response = await axios.post(`${hubUrl}/_admin/spinlets/${spinletId}/stop`);
    
    if (response.data.success) {
      spinner.succeed(`Spinlet ${chalk.yellow(spinletId)} stopped successfully`);
    } else {
      throw new Error('Failed to stop spinlet');
    }
  } catch (error: any) {
    spinner.fail('Failed to stop spinlet');
    
    if (axios.isAxiosError(error)) {
      console.error(chalk.red('\nError:'), error.response?.data?.error || error.message);
    } else {
      console.error(chalk.red('\nError:'), error.message);
    }
    
    process.exit(1);
  }
}