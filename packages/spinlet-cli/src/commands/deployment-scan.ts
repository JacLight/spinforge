import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';

export async function deploymentScanCommand() {
  const spinner = ora('Scanning deployment folder...').start();

  try {
    const hubUrl = process.env.SPINHUB_URL || 'http://localhost:8080';
    
    // Trigger deployment scan
    const response = await axios.post(`${hubUrl}/_admin/deployments/scan`);
    
    spinner.succeed('Deployment scan completed!');
    
    if (response.data.found && response.data.found > 0) {
      console.log(chalk.green(`\n✓ Found ${response.data.found} deployments`));
      
      if (response.data.processed) {
        console.log(chalk.blue(`  Processed: ${response.data.processed}`));
      }
      if (response.data.failed) {
        console.log(chalk.red(`  Failed: ${response.data.failed}`));
      }
    } else {
      console.log(chalk.yellow('\nNo new deployments found'));
    }
    
    const deploymentPath = process.env.SPINFORGE_DEPLOYMENTS || '/spinforge/deployments';
    console.log(chalk.gray(`\nDeployment folder: ${deploymentPath}`));

  } catch (error: any) {
    spinner.fail('Deployment scan failed');
    
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