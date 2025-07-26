import { existsSync, readFileSync, cpSync } from 'fs';
import { resolve, join, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import inquirer from 'inquirer';
import { getAuthConfig } from '../lib/auth';
import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
// import axios from 'axios';

interface DeployOptions {
  domain?: string;
  framework?: string;
  memory?: string;
  cpu?: string;
  name?: string;
  env?: string[];
  noBuild?: boolean;
  path?: string;
}

export async function deployCommand(options: DeployOptions) {
  const spinner = ora('Preparing deployment...').start();
  
  try {
    // Get auth config - this will exit if not logged in
    const auth = getAuthConfig();
    
    // Use provided path or current directory
    const projectPath = options.path ? resolve(options.path) : process.cwd();
    const packageJsonPath = join(projectPath, 'package.json');
    
    // Check if this is a Node.js project
    const isNodeProject = existsSync(packageJsonPath);
    
    if (!isNodeProject && !options.path) {
      throw new Error('No package.json found. Please run from a Node.js project or specify a path.');
    }
    
    let projectName: string;
    let framework: string;
    let shouldBuild = false;
    
    if (isNodeProject) {
      // Read package.json
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      projectName = options.name || packageJson.name || basename(projectPath);
      
      spinner.text = 'Analyzing project...';
      
      // Detect framework
      framework = options.framework || await detectFramework(packageJson);
      
      // Check for build script
      const hasBuildScript = packageJson.scripts?.build;
      
      if (!options.noBuild && hasBuildScript) {
        spinner.text = 'Found build script in package.json';
        
        // Show build info
        console.log('\n' + chalk.blue('Build Configuration:'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(`${chalk.bold('Project:')}    ${chalk.cyan(projectName)}`);
        console.log(`${chalk.bold('Framework:')}  ${chalk.cyan(framework)}`);
        console.log(`${chalk.bold('Build cmd:')}  ${chalk.gray(packageJson.scripts.build)}`);
        console.log(chalk.gray('─'.repeat(50)) + '\n');
        
        const { confirmBuild } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmBuild',
          message: 'Run build command before deploying?',
          default: true
        }]);
        
        if (confirmBuild) {
          shouldBuild = true;
        }
      }
    } else {
      // For non-Node projects, just use directory name
      projectName = options.name || basename(projectPath);
      framework = options.framework || 'static';
    }
    
    // Build if needed
    if (shouldBuild) {
      spinner.text = 'Building your application...';
      
      try {
        execSync('npm run build', {
          cwd: projectPath,
          stdio: 'inherit',
          env: {
            ...process.env,
            NODE_ENV: 'production'
          }
        });
        
        spinner.succeed('Build completed successfully!');
      } catch (error) {
        spinner.fail('Build failed');
        throw new Error('Build process failed. Please fix build errors and try again.');
      }
    }
    
    // Prepare deployment directory
    spinner.text = 'Preparing deployment package...';
    
    const tempDir = join(tmpdir(), `spinforge-deploy-${nanoid(8)}`);
    mkdirSync(tempDir, { recursive: true });
    
    // Copy project files
    cpSync(projectPath, tempDir, {
      recursive: true,
      filter: (src) => {
        const relativePath = src.replace(projectPath, '');
        // Skip common non-deployment files
        return !relativePath.includes('node_modules') &&
               !relativePath.includes('.git') &&
               !relativePath.includes('.env.local') &&
               !relativePath.includes('.env.development');
      }
    });
    
    // Create deploy.yaml
    const deployConfig = {
      name: projectName,
      version: '1.0.0',
      domain: options.domain || `${projectName}.${auth.customerId}.spinforge.app`,
      customerId: auth.customerId,
      framework,
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
    const deployYamlPath = join(tempDir, 'deploy.yaml');
    require('fs').writeFileSync(deployYamlPath, yamlContent);
    
    spinner.succeed('Deployment package prepared!');
    
    // Deploy to SpinHub
    spinner.start('Deploying to SpinForge...');
    
    // const hubUrl = process.env.SPINHUB_URL || 'http://localhost:8080';
    const deploymentPath = process.env.SPINFORGE_DEPLOYMENTS || '/spinforge/deployments';
    const targetPath = join(deploymentPath, projectName);
    
    // Copy to deployment directory
    cpSync(tempDir, targetPath, { recursive: true, force: true });
    
    spinner.succeed('Application deployed!');
    
    console.log('\n' + chalk.green('Deployment Summary:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.bold('Name:')}       ${chalk.cyan(projectName)}`);
    console.log(`${chalk.bold('Domain:')}     ${chalk.cyan(deployConfig.domain)}`);
    console.log(`${chalk.bold('Customer:')}   ${chalk.yellow(auth.customerId)}`);
    console.log(`${chalk.bold('Framework:')}  ${framework}`);
    console.log(`${chalk.bold('Resources:')}  ${deployConfig.resources.memory} memory, ${deployConfig.resources.cpu} CPU`);
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`\nAccess your app at: ${chalk.underline.blue(`https://${deployConfig.domain}`)}\n`);
    
    // Clean up temp directory
    require('fs').rmSync(tempDir, { recursive: true, force: true });
    
  } catch (error: any) {
    spinner.fail('Deployment failed');
    console.error(chalk.red('\nError:'), error.message);
    process.exit(1);
  }
}

async function detectFramework(packageJson: any): Promise<string> {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps.next) return 'nextjs';
  if (deps.remix || deps['@remix-run/node']) return 'remix';
  if (deps.express) return 'express';
  if (deps.fastify) return 'fastify';
  if (deps.koa) return 'koa';
  if (deps['@angular/core']) return 'angular';
  if (deps.vue) return 'vue';
  if (deps.react && deps['react-scripts']) return 'react';
  
  return 'custom';
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