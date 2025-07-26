import { existsSync, watch, statSync } from 'fs';
import { resolve, join, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { getAuthConfig } from '../lib/auth';
import { debounce } from '../lib/utils';

interface WatchOptions {
  domain?: string;
  framework?: string;
  memory?: string;
  cpu?: string;
  name?: string;
  env?: string[];
  interval?: string;
}

export async function watchCommand(path: string, options: WatchOptions) {
  // Get auth config - this will exit if not logged in
  const auth = getAuthConfig();
  
  const watchPath = resolve(path || process.cwd());
  
  if (!existsSync(watchPath)) {
    console.error(chalk.red(`Path does not exist: ${watchPath}`));
    process.exit(1);
  }

  const stats = statSync(watchPath);
  if (!stats.isDirectory()) {
    console.error(chalk.red(`Path is not a directory: ${watchPath}`));
    process.exit(1);
  }

  const projectName = options.name || basename(watchPath);
  const domain = options.domain || `${projectName}.${auth.customerId}.spinforge.app`;
  const framework = options.framework || 'custom';
  const deploymentPath = process.env.SPINFORGE_DEPLOYMENTS || '/spinforge/deployments';
  const targetPath = join(deploymentPath, projectName);

  console.log(chalk.blue('\n📡 SpinForge Watch Mode'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`${chalk.bold('Watching:')}   ${chalk.cyan(watchPath)}`);
  console.log(`${chalk.bold('Deploy to:')}  ${chalk.cyan(targetPath)}`);
  console.log(`${chalk.bold('Domain:')}     ${chalk.cyan(domain)}`);
  console.log(`${chalk.bold('Customer:')}   ${chalk.yellow(auth.customerId)}`);
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.gray('\nPress Ctrl+C to stop watching\n'));

  let isDeploying = false;
  const spinner = ora();

  // Debounced deploy function to avoid multiple rapid deployments
  const debouncedDeploy = debounce(async () => {
    if (isDeploying) {
      console.log(chalk.yellow('⚠️  Deployment already in progress, skipping...'));
      return;
    }

    isDeploying = true;
    spinner.start('Deploying changes...');

    try {
      // Run build if package.json exists and has build script
      const packageJsonPath = join(watchPath, 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = require(packageJsonPath);
        if (packageJson.scripts?.build) {
          spinner.text = 'Building application...';
          execSync('npm run build', {
            cwd: watchPath,
            stdio: 'pipe',
            env: { ...process.env, NODE_ENV: 'production' }
          });
        }
      }

      // Sync files to deployment directory
      spinner.text = 'Syncing files...';
      execSync(`rsync -av --delete --exclude node_modules --exclude .git "${watchPath}/" "${targetPath}/"`, {
        stdio: 'pipe'
      });

      // Create/update deploy.yaml
      const deployConfig = {
        name: projectName,
        version: '1.0.0',
        domain: domain,
        customerId: auth.customerId,
        framework: framework,
        runtime: framework === 'static' ? 'static' : 'node',
        nodeVersion: '20',
        resources: {
          memory: options.memory || '512MB',
          cpu: parseFloat(options.cpu || '0.5')
        },
        env: {
          NODE_ENV: 'production',
          ...(options.env ? parseEnvVars(options.env) : {})
        }
      };

      const yamlContent = generateYaml(deployConfig);
      const deployYamlPath = join(targetPath, 'deploy.yaml');
      require('fs').writeFileSync(deployYamlPath, yamlContent);

      spinner.succeed(chalk.green('✓ Changes deployed successfully!'));
      console.log(chalk.gray(`  Updated at ${new Date().toLocaleTimeString()}\n`));
    } catch (error: any) {
      spinner.fail('Deployment failed');
      console.error(chalk.red('Error:'), error.message);
    } finally {
      isDeploying = false;
    }
  }, parseInt(options.interval || '1000'));

  // Initial deployment
  await debouncedDeploy();

  // Watch for changes
  const watcher = watch(watchPath, { recursive: true }, (_, filename) => {
    if (!filename) return;
    
    // Ignore certain files/directories
    const ignoredPatterns = [
      /node_modules/,
      /\.git/,
      /\.DS_Store/,
      /\.env\.local/,
      /\.env\.development/,
      /dist\//,
      /build\//,
      /\.next\//,
      /\.cache\//
    ];

    if (ignoredPatterns.some(pattern => pattern.test(filename))) {
      return;
    }

    console.log(chalk.dim(`  → Changed: ${filename}`));
    debouncedDeploy();
  });

  // Handle exit
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Stopping watch mode...'));
    watcher.close();
    process.exit(0);
  });
}

function parseEnvVars(envArray: string[]): Record<string, string> {
  const envVars: Record<string, string> = {};
  for (const envVar of envArray) {
    const [key, value] = envVar.split('=');
    if (key && value) {
      envVars[key] = value;
    }
  }
  return envVars;
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