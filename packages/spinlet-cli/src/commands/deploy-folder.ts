import { existsSync, statSync, copyFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join, basename } from 'path';
import { writeFileSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { nanoid } from 'nanoid';
import inquirer from 'inquirer';

interface DeployFolderOptions {
  domain?: string;
  customer?: string;
  framework?: string;
  memory?: string;
  cpu?: string;
  name?: string;
  skipBuild?: boolean;
  env?: string[];
}

export async function deployFolderCommand(path: string, options: DeployFolderOptions) {
  const spinner = ora('Preparing deployment...').start();

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

    // Check for existing deploy.yaml
    const deployYamlPath = join(absolutePath, 'deploy.yaml');
    if (existsSync(deployYamlPath)) {
      spinner.warn('deploy.yaml already exists');
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: 'Overwrite existing deploy.yaml?',
        default: false
      }]);

      if (!overwrite) {
        console.log(chalk.yellow('Deployment cancelled'));
        process.exit(0);
      }
    }

    // Auto-detect framework if not provided
    let framework = options.framework;
    if (!framework) {
      framework = await detectFramework(absolutePath);
      spinner.info(`Detected framework: ${chalk.cyan(framework)}`);
    }

    // Generate defaults
    const name = options.name || basename(absolutePath);
    const customerId = options.customer || `customer-${nanoid(8)}`;
    const domain = options.domain || `${name}.localhost`;
    const memory = options.memory || '512MB';
    const cpu = options.cpu || '0.5';

    // Parse environment variables
    const envVars: Record<string, string> = {};
    if (options.env) {
      for (const envVar of options.env) {
        const [key, value] = envVar.split('=');
        if (key && value) {
          envVars[key] = value;
        }
      }
    }

    // Create deploy.yaml
    spinner.text = 'Creating deployment configuration...';
    
    const deployConfig = {
      name,
      version: '1.0.0',
      domain,
      customerId,
      framework,
      runtime: 'node',
      nodeVersion: '20',
      ...(options.skipBuild ? {} : {
        build: {
          command: getBuildCommand(framework),
          outputDir: getOutputDir(framework)
        }
      }),
      resources: {
        memory,
        cpu: parseFloat(cpu)
      },
      env: {
        NODE_ENV: 'production',
        ...envVars
      }
    };

    // Write deploy.yaml
    const yamlContent = generateYaml(deployConfig);
    writeFileSync(deployYamlPath, yamlContent);

    spinner.succeed('Deployment configuration created!');

    // Get deployment folder path
    const deploymentPath = process.env.SPINFORGE_DEPLOYMENTS || '/spinforge/deployments';
    const targetPath = join(deploymentPath, name);

    console.log('\n' + chalk.green('Deployment Configuration:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.bold('Name:')}       ${chalk.cyan(name)}`);
    console.log(`${chalk.bold('Domain:')}     ${chalk.cyan(domain)}`);
    console.log(`${chalk.bold('Customer:')}   ${chalk.yellow(customerId)}`);
    console.log(`${chalk.bold('Framework:')}  ${framework}`);
    console.log(`${chalk.bold('Build:')}      ${options.skipBuild ? chalk.gray('Skipped (pre-built)') : chalk.green('Enabled')}`);
    console.log(`${chalk.bold('Resources:')}  ${memory} memory, ${cpu} CPU`);
    console.log(chalk.gray('─'.repeat(50)));

    console.log(`\n${chalk.bold('Next steps:')}`);
    console.log(`1. Copy your application to: ${chalk.cyan(targetPath)}`);
    console.log(`   ${chalk.gray(`cp -r ${absolutePath} ${targetPath}`)}`);
    console.log(`2. The HotDeploymentWatcher will automatically detect and deploy it`);
    console.log(`3. Access your app at: ${chalk.underline.blue(`http://${domain}`)}\n`);

    // Optionally copy to deployment folder
    const { copyNow } = await inquirer.prompt([{
      type: 'confirm',
      name: 'copyNow',
      message: `Copy to deployment folder now? (${targetPath})`,
      default: true
    }]);

    if (copyNow) {
      spinner.start('Copying to deployment folder...');
      await copyDirectory(absolutePath, targetPath);
      spinner.succeed('Application copied to deployment folder!');
      console.log(chalk.green('\n✓ Deployment will start automatically'));
    }

  } catch (error: any) {
    spinner.fail('Deployment preparation failed');
    console.error(chalk.red('\nError:'), error.message);
    process.exit(1);
  }
}

async function detectFramework(path: string): Promise<string> {
  const packageJsonPath = join(path, 'package.json');
  
  if (existsSync(packageJsonPath)) {
    const packageJson = require(packageJsonPath);
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.next) return 'nextjs';
    if (deps.remix || deps['@remix-run/node']) return 'remix';
    if (deps.express) return 'express';
    if (deps.fastify) return 'custom';
    if (deps.koa) return 'custom';
  }

  // Check for static site
  if (existsSync(join(path, 'index.html'))) {
    return 'static';
  }

  // Default to custom
  return 'custom';
}

function getBuildCommand(framework: string): string {
  switch (framework) {
    case 'nextjs':
      return 'npm install && npm run build';
    case 'remix':
      return 'npm install && npm run build';
    case 'express':
    case 'custom':
      return 'npm install';
    default:
      return 'npm install';
  }
}

function getOutputDir(framework: string): string {
  switch (framework) {
    case 'nextjs':
      return '.next';
    case 'remix':
      return 'build';
    default:
      return '.';
  }
}

function generateYaml(config: any): string {
  let yaml = `name: ${config.name}
version: ${config.version}
domain: ${config.domain}
customerId: ${config.customerId}

framework: ${config.framework}
runtime: ${config.runtime}
nodeVersion: "${config.nodeVersion}"
`;

  if (config.build) {
    yaml += `
build:
  command: ${config.build.command}
  outputDir: ${config.build.outputDir}
`;
  }

  yaml += `
resources:
  memory: ${config.resources.memory}
  cpu: ${config.resources.cpu}
`;

  if (config.env && Object.keys(config.env).length > 0) {
    yaml += '\nenv:\n';
    for (const [key, value] of Object.entries(config.env)) {
      yaml += `  ${key}: ${value}\n`;
    }
  }

  return yaml;
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  // Create destination directory
  mkdirSync(dest, { recursive: true });

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    // Skip node_modules and .git
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}