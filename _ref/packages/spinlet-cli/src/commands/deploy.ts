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
import { getRequiredConfig } from '../lib/config';
import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

interface DeployOptions {
  domain?: string;
  framework?: string;
  memory?: string;
  cpu?: string;
  name?: string;
  env?: string[];
  noBuild?: boolean;
  path?: string;
  override?: boolean;
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
        spinner.stop(); // Stop spinner before prompting
        
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
        
        spinner.start(); // Restart spinner after prompt
        
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
    
    // Sanitize customer ID for domain use
    const sanitizedCustomerId = auth.customerId.toLowerCase().replace(/_/g, '-');
    
    // Create deploy.yaml
    const deployConfig = {
      name: projectName,
      version: '1.0.0',
      domain: options.domain || `${projectName}-${sanitizedCustomerId}.web.spinforge.app`,
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
    
    // Check if deployment already exists and handle override
    if (options.override) {
      spinner.start('Checking for existing deployment...');
      try {
        const apiUrl = getRequiredConfig('apiUrl');
        const statusResponse = await axios.get(
          `${apiUrl}/_api/customer/deployments`,
          {
            headers: {
              'Authorization': `Bearer ${auth.token}`,
              'X-Customer-ID': auth.customerId,
            }
          }
        );
        
        // Find existing deployment with the same name
        const existingDeployment = statusResponse.data.find((d: any) => d.name === projectName);
        if (existingDeployment) {
          spinner.text = 'Removing existing deployment...';
          
          // Delete the existing deployment
          await axios.delete(
            `${apiUrl}/_api/customer/deployments/${projectName}`,
            {
              headers: {
                'Authorization': `Bearer ${auth.token}`,
                'X-Customer-ID': auth.customerId,
              }
            }
          );
          
          spinner.succeed('Existing deployment removed');
          
          // Wait a bit for cleanup to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          spinner.succeed('No existing deployment found');
        }
      } catch (error: any) {
        // If deployment doesn't exist, that's fine for override
        if (error.response?.status !== 404) {
          spinner.warn('Could not check for existing deployment');
        } else {
          spinner.succeed('No existing deployment found');
        }
      }
    }
    
    // Deploy to SpinHub
    spinner.start('Deploying to SpinForge...');
    
    try {
      // Create a zip file of the deployment
      const zipPath = join(tmpdir(), `${projectName}-${nanoid(8)}.zip`);
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      await new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve());
        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(tempDir, false);
        archive.finalize();
      });
      
      // Make API call to deploy
      const apiUrl = getRequiredConfig('apiUrl');
      const formData = new FormData();
      formData.append('archive', createReadStream(zipPath), {
        filename: `${projectName}.zip`,
        contentType: 'application/zip'
      });
      // Use customerId/projectName as deploymentId for organized structure
      formData.append('deploymentId', `${auth.customerId}/${projectName}`);
      formData.append('config', JSON.stringify(deployConfig));
      
      const response = await axios.post(
        `${apiUrl}/_api/customer/deployments/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${auth.token}`,
            'X-Customer-ID': auth.customerId,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );
      
      if (response.data.success) {
        spinner.succeed('Application deployed successfully!');
        
        // Monitor deployment status
        spinner.start('Waiting for deployment to complete...');
        
        let deploymentStatus = 'pending';
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes
        
        while (deploymentStatus === 'pending' || deploymentStatus === 'building' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          
          const statusResponse = await axios.get(
            `${apiUrl}/_api/customer/deployments`,
            {
              headers: {
                'Authorization': `Bearer ${auth.token}`,
                'X-Customer-ID': auth.customerId,
              }
            }
          );
          
          // Find our deployment in the list
          const ourDeployment = statusResponse.data.find((d: any) => d.name === projectName);
          if (!ourDeployment) {
            throw new Error('Deployment not found in status list');
          }
          
          deploymentStatus = ourDeployment.status;
          spinner.text = `Deployment status: ${deploymentStatus}...`;
          attempts++;
        }
        
        if (deploymentStatus === 'success') {
          spinner.succeed('Application deployed and running!');
        } else if (deploymentStatus === 'failed') {
          throw new Error('Deployment failed on server');
        } else {
          spinner.warn('Deployment is taking longer than expected. Check the dashboard for status.');
        }
        
        // Clean up zip file
        require('fs').unlinkSync(zipPath);
      } else {
        throw new Error(response.data.error || 'Deployment failed');
      }
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please login again.');
      } else if (error.response?.status === 404) {
        throw new Error('Deployment API not found. Is the SpinForge server running?');
      } else {
        throw error;
      }
    }
    
    console.log('\n' + chalk.green('Deployment Summary:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.bold('Name:')}       ${chalk.cyan(projectName)}`);
    console.log(`${chalk.bold('URL:')}        ${chalk.cyan(`https://${deployConfig.domain}`)}`);
    console.log(`${chalk.bold('Framework:')}  ${framework}`);
    console.log(`${chalk.bold('Resources:')}  ${deployConfig.resources.memory} memory, ${deployConfig.resources.cpu} CPU`);
    console.log(chalk.gray('─'.repeat(50)));
    console.log('\n' + chalk.green('✓') + ' Your app is deployed at:');
    console.log('  ' + chalk.underline.blue(`https://${deployConfig.domain}`));
    console.log('\n' + chalk.gray('This is your permanent project URL.'));
    console.log(chalk.gray('To add custom domains, use the SpinForge dashboard.\n'));
    
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