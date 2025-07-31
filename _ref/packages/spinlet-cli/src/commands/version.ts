import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';

export function versionCommand() {
  try {
    // Read package.json to get version
    const packagePath = join(dirname(dirname(__dirname)), 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    
    console.log(chalk.bold('\nSpinForge CLI'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`Version:     ${chalk.cyan(packageJson.version)}`);
    console.log(`Node:        ${chalk.cyan(process.version)}`);
    console.log(`Platform:    ${chalk.cyan(process.platform)}`);
    console.log(`Environment: ${chalk.cyan(process.env.NODE_ENV || 'development')}`);
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.gray(`Homepage: ${packageJson.homepage || 'https://spinforge.dev'}`));
    console.log(chalk.gray(`License:  ${packageJson.license || 'MIT'}\n`));
  } catch (error) {
    console.error(chalk.red('Error reading version information'));
    process.exit(1);
  }
}