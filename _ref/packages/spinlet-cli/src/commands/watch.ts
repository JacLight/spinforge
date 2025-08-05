import { existsSync, watch, statSync } from 'fs';
import { resolve, join, basename, relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getAuthConfig } from '../lib/auth';
import { debounce } from '../lib/utils';
import { getRequiredConfig } from '../lib/config';
import axios from 'axios';
import FormData from 'form-data';
import { readFileSync } from 'fs';

interface WatchOptions {
  domain?: string;
  framework?: string;
  memory?: string;
  cpu?: string;
  name?: string;
  env?: string[];
  interval?: string;
  noBuild?: boolean;
  mode?: 'preview' | 'development';
  override?: boolean;
}

interface FileChange {
  path: string;
  type: 'add' | 'change' | 'unlink';
  content?: Buffer;
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
  const framework = options.framework || await detectFramework(watchPath);
  const apiUrl = getRequiredConfig('apiUrl');
  const mode = options.mode || 'preview';
  
  // Sanitize customer ID for domain use (lowercase, replace underscores)
  const sanitizedCustomerId = auth.customerId.toLowerCase().replace(/_/g, '-');
  
  // Use provided domain or generate default
  const domain = options.domain || `${projectName}-${sanitizedCustomerId}.web.spinforge.app`;

  console.log(chalk.blue('\n📡 SpinForge Watch Mode'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`${chalk.bold('Watching:')}   ${chalk.cyan(watchPath)}`);
  console.log(`${chalk.bold('Project:')}    ${chalk.cyan(projectName)}`);
  console.log(`${chalk.bold('URL:')}        ${chalk.cyan(`https://${domain}`)}`);
  console.log(`${chalk.bold('Framework:')}  ${chalk.cyan(framework)}`);
  console.log(`${chalk.bold('Mode:')}       ${chalk.cyan(mode)}`);
  console.log(`${chalk.bold('API:')}        ${chalk.cyan(apiUrl)}`);
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.gray('\nThis is your permanent project URL.'));
  console.log(chalk.gray('To add custom domains, use the SpinForge dashboard.\n'));
  console.log(chalk.gray('Press Ctrl+C to stop watching\n'));

  let isDeploying = false;
  let pendingChanges: Map<string, FileChange> = new Map();
  const spinner = ora();
  // let deploymentExists = false;

  // Initial deployment check/create
  const initializeDeployment = async () => {
    spinner.start('Checking deployment status...');
    
    try {
      // Check if deployment exists
      const response = await axios.get(
        `${apiUrl}/_api/customer/deployments`,
        {
          headers: {
            'Authorization': `Bearer ${auth.token}`,
            'X-Customer-ID': auth.customerId,
          }
        }
      );
      
      const existingDeployment = response.data.find((d: any) => d.name === projectName);
      
      if (!existingDeployment) {
        spinner.text = 'Creating initial deployment...';
        
        // Create deployment first
        await axios.post(
          `${apiUrl}/_api/customer/deploy`,
          {
            name: projectName,
            domain: domain,
            customerId: auth.customerId,
            framework: framework,
            config: {
              mode: mode,
              resources: {
                memory: options.memory || '512MB',
                cpu: parseFloat(options.cpu || '0.5')
              },
              env: {
                NODE_ENV: mode === 'preview' ? 'production' : 'development',
                ...(options.env ? parseEnvVars(options.env) : {})
              }
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${auth.token}`,
              'X-Customer-ID': auth.customerId,
            }
          }
        );
        
        spinner.succeed('Deployment folder created!');
        console.log(chalk.gray('Now uploading application files...'));
        
        // Do initial full sync
        await fullSync();
      } else {
        // deploymentExists = true;
        const status = existingDeployment.status;
        const statusColor = status === 'success' ? 'green' : 
                          status === 'failed' ? 'red' : 
                          status === 'building' ? 'yellow' : 'gray';
        
        spinner.succeed(`Deployment found! Status: ${chalk[statusColor](status)}`);
        
        if (status === 'failed') {
          console.log(chalk.red('\n⚠️  Your deployment has failed!'));
          if (existingDeployment.error) {
            console.log(chalk.red(`   Error: ${existingDeployment.error}`));
          }
          console.log(chalk.yellow('\n   The watch command will sync your changes, but the app may not be running.'));
          console.log(chalk.yellow('   Fix the errors and save your files to trigger a rebuild.\n'));
        } else if (status === 'building' || status === 'pending') {
          console.log(chalk.yellow('\n⏳ Your deployment is still building...'));
          console.log(chalk.gray('   Watch mode will sync changes once the build completes.\n'));
        } else if (status === 'success') {
          console.log(chalk.green('\n✓ Your app is running!'));
          console.log(chalk.blue(`   View it at: ${chalk.underline(`https://${domain}`)}`));
          console.log(chalk.gray('\n   Watching for file changes...'));
          console.log(chalk.gray('   Edit your files and they will be automatically synced\n'));
        }
      }
    } catch (error: any) {
      spinner.fail('Failed to initialize deployment');
      
      if (error.response?.data?.error) {
        console.error(chalk.red('\nError:'), error.response.data.error);
      } else if (error.code === 'ECONNREFUSED') {
        console.error(chalk.red('\nCannot connect to SpinHub. Is it running?'));
      } else {
        console.error(chalk.red('\nError:'), error.message);
      }
      
      process.exit(1);
    }
  };

  // Full sync for initial deployment
  const fullSync = async () => {
    spinner.start('Performing initial deployment...');
    
    try {
      // Create a temporary zip file
      const archiver = require('archiver');
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      
      const zipPath = path.join(os.tmpdir(), `${projectName}-${Date.now()}.zip`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', async () => {
        spinner.text = 'Uploading deployment archive...';
        
        try {
          const FormData = require('form-data');
          const formData = new FormData();
          
          // Prepare deployment config
          const deployConfig = {
            name: projectName,
            domain: domain,
            customerId: auth.customerId,
            framework: framework,
            version: '1.0.0',
            runtime: framework === 'static' ? 'static' : 'node',
            nodeVersion: '20',
            mode: mode, // Add mode to track watch/development mode
            resources: {
              memory: options.memory || '512MB',
              cpu: parseFloat(options.cpu || '0.5')
            },
            env: {
              NODE_ENV: mode === 'preview' ? 'production' : 'development',
              ...(options.env ? parseEnvVars(options.env) : {})
            }
          };
          
          formData.append('archive', fs.createReadStream(zipPath));
          formData.append('config', JSON.stringify(deployConfig));
          formData.append('deploymentId', projectName);
          
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
            spinner.succeed('Initial deployment uploaded!');
            
            // Wait for deployment to complete
            spinner.start('Waiting for deployment to complete...');
            
            let deploymentStatus = 'pending';
            let attempts = 0;
            const maxAttempts = 60; // 5 minutes
            
            while ((deploymentStatus === 'pending' || deploymentStatus === 'building') && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              const statusResponse = await axios.get(
                `${apiUrl}/_api/customer/deployments`,
                {
                  headers: {
                    'Authorization': `Bearer ${auth.token}`,
                    'X-Customer-ID': auth.customerId,
                  }
                }
              );
              
              // Debug: log all deployments on first attempt
              if (attempts === 0) {
                console.log(chalk.gray(`\nFound ${statusResponse.data.length} deployments`));
                statusResponse.data.forEach((d: any) => {
                  console.log(chalk.gray(`  - ${d.name} (${d.status})`));
                });
              }
              
              const ourDeployment = statusResponse.data.find((d: any) => d.name === projectName);
              if (ourDeployment) {
                deploymentStatus = ourDeployment.status;
                spinner.text = `Deployment status: ${deploymentStatus}...`;
                
                // Check for error in deployment
                if (ourDeployment.error) {
                  spinner.fail(`Deployment failed: ${ourDeployment.error}`);
                  throw new Error(ourDeployment.error);
                }
              } else if (attempts > 2) {
                // After a few attempts, if we can't find the deployment, it probably failed
                spinner.fail(`Deployment '${projectName}' not found in status list`);
                console.log(chalk.red('\nAvailable deployments:'));
                statusResponse.data.forEach((d: any) => {
                  console.log(chalk.gray(`  - ${d.name}`));
                });
                throw new Error('Deployment failed - not found in status list');
              }
              attempts++;
            }
            
            if (deploymentStatus === 'success') {
              spinner.succeed('Initial deployment completed!');
            } else if (deploymentStatus === 'failed') {
              throw new Error('Initial deployment failed');
            } else {
              spinner.warn('Deployment is taking longer than expected');
            }
          } else {
            throw new Error(response.data.error || 'Upload failed');
          }
          
          // Clean up zip file
          fs.unlinkSync(zipPath);
          
        } catch (error: any) {
          spinner.fail('Failed to upload initial deployment');
          
          if (error.response?.status === 500) {
            console.error(chalk.red('\nServer error during upload. This might be due to:'));
            // Get file size from the zip file
            const fileSize = fs.statSync(zipPath).size;
            console.error(chalk.yellow('- File size too large (your archive is ' + (fileSize / 1024 / 1024).toFixed(1) + 'MB)'));
            console.error(chalk.yellow('- Server upload limits'));
            console.error(chalk.yellow('- Insufficient server resources\n'));
            
            if (fileSize > 50 * 1024 * 1024) {
              console.error(chalk.red('Your deployment is quite large. Consider:'));
              console.error(chalk.gray('- Adding more patterns to .gitignore'));
              console.error(chalk.gray('- Excluding build artifacts'));
              console.error(chalk.gray('- Removing unnecessary files\n'));
            }
          } else if (error.response?.data?.error) {
            console.error(chalk.red('\nError:'), error.response.data.error);
          } else if (error.code === 'ECONNREFUSED') {
            console.error(chalk.red('\nCannot connect to SpinHub. Is it running?'));
          } else {
            console.error(chalk.red('\nError:'), error.message);
          }
          
          // Clean up zip file before exiting
          try {
            fs.unlinkSync(zipPath);
          } catch {}
          
          process.exit(1);
        }
      });
      
      archive.on('error', (err: Error) => {
        spinner.fail('Failed to create deployment archive');
        throw err;
      });
      
      archive.pipe(output);
      
      // Add all files from the watch directory
      archive.directory(watchPath, false, (entry: any) => {
        // Exclude common build artifacts and dependencies
        const excludePatterns = [
          /node_modules/,
          /\.git/,
          /\.next/,
          /\.cache/,
          /dist/,
          /build/,
          /\.env\.local/,
          /\.DS_Store/,
          /\.vscode/,
          /\.idea/,
          /coverage/,
          /\.nyc_output/,
          /\.turbo/,
          /out/,
          /\.vercel/,
          /\.netlify/,
          /public\/uploads/,
          /uploads/,
          /tmp/,
          /temp/,
          /logs?/,
          /.*\.log$/,
          /.*\.map$/,
          /.*\.lock$/
        ];
        
        if (excludePatterns.some(pattern => pattern.test(entry.name))) {
          return false;
        }
        return entry;
      });
      
      await archive.finalize();
      
    } catch (error: any) {
      spinner.fail('Failed to perform initial deployment');
      
      if (error.code === 'ENOSPC') {
        console.error(chalk.red('\nError: No space left on device'));
      } else {
        console.error(chalk.red('\nError:'), error.message);
      }
      
      process.exit(1);
    }
  };

  // Sync changed files
  const syncFiles = async () => {
    if (isDeploying || pendingChanges.size === 0) {
      return;
    }

    isDeploying = true;
    const changes = Array.from(pendingChanges.values());
    pendingChanges.clear();

    spinner.start(`Syncing ${changes.length} file${changes.length > 1 ? 's' : ''}...`);

    try {
      const formData = new FormData();
      
      // Add changed files
      const updatedFiles: string[] = [];
      const deletedFiles: string[] = [];
      
      for (const change of changes) {
        if (change.type === 'unlink') {
          deletedFiles.push(change.path);
        } else if (change.content) {
          formData.append('files', change.content, change.path);
          updatedFiles.push(change.path);
        }
      }
      
      // Add metadata
      formData.append('metadata', JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: mode
      }));
      
      if (deletedFiles.length > 0) {
        formData.append('deleted', JSON.stringify(deletedFiles));
      }
      
      formData.append('mode', mode);
      
      // Send to server
      const response = await axios.post(
        `${apiUrl}/_api/customer/deployments/${projectName}/sync`,
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
        const action = response.data.action;
        spinner.succeed(chalk.green(`✓ Synced ${updatedFiles.length} files (${action})`));
        
        if (action === 'rebuild' || action === 'restart') {
          spinner.start(`Waiting for ${action}...`);
          // Give it a few seconds for the action to complete
          await new Promise(resolve => setTimeout(resolve, 3000));
          spinner.succeed(`${action} completed`);
        }
        
        console.log(chalk.gray(`  Updated at ${new Date().toLocaleTimeString()}`));
        console.log(chalk.blue(`  Preview at: ${chalk.underline(`https://${domain}`)}\n`));
      } else {
        throw new Error(response.data.error || 'Sync failed');
      }
    } catch (error: any) {
      spinner.fail('Sync failed');
      
      if (error.response?.status === 404) {
        console.error(chalk.red('\nDeployment not found. Run "spinforge deploy" first.'));
      } else if (error.response?.data?.error) {
        console.error(chalk.red('\nError:'), error.response.data.error);
      } else {
        console.error(chalk.red('\nError:'), error.message);
      }
    } finally {
      isDeploying = false;
    }
  };

  // Debounced sync function
  const intervalMs = parseInt(options.interval || '10000');
  const debouncedSync = debounce(syncFiles, intervalMs);
  
  console.log(chalk.gray(`Debounce: ${intervalMs}ms (changes reset timer)\n`));

  // Check for override option
  if (options.override) {
    spinner.start('Checking for existing deployment...');
    
    try {
      // Check if deployment exists
      const response = await axios.get(
        `${apiUrl}/_api/customer/deployments`,
        {
          headers: {
            'Authorization': `Bearer ${auth.token}`,
            'X-Customer-ID': auth.customerId,
          }
        }
      );
      
      const existingDeployment = response.data.find((d: any) => d.name === projectName);
      
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
      spinner.fail('Failed to check/remove existing deployment');
      
      if (error.response?.status === 404) {
        // No deployment exists, which is fine for override
        spinner.succeed('No existing deployment found');
      } else {
        console.error(chalk.red('\nError:'), error.response?.data?.error || error.message);
        process.exit(1);
      }
    }
  }

  // Initialize deployment
  await initializeDeployment();

  // Watch for changes
  const watcher = watch(watchPath, { recursive: true }, async (eventType, filename) => {
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
      /\.cache\//,
      /\.turbo\//,
      /coverage\//,
      /\.nyc_output\//,
      /\.vscode\//,
      /\.idea\//,
      /tmp\//,
      /temp\//,
      /logs?\//,
      /.*\.log$/,
      /.*\.lock$/,
      /.*\.swp$/,
      /.*~$/,
      /\#.*\#$/  // Emacs temp files
    ];

    if (ignoredPatterns.some(pattern => pattern.test(filename))) {
      return;
    }

    const fullPath = join(watchPath, filename);
    const relativePath = relative(watchPath, fullPath);
    
    console.log(chalk.yellow(`  → ${eventType === 'rename' ? (existsSync(fullPath) ? 'added' : 'deleted') : 'changed'}: ${relativePath} ${chalk.gray(`(syncing in ${intervalMs / 1000}s...)`)}`)  );
    
    // Track the change
    if (eventType === 'rename' && !existsSync(fullPath)) {
      // File was deleted
      pendingChanges.set(relativePath, {
        path: relativePath,
        type: 'unlink'
      });
    } else if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      // File was added or changed
      try {
        const content = readFileSync(fullPath);
        pendingChanges.set(relativePath, {
          path: relativePath,
          type: eventType === 'rename' ? 'add' : 'change',
          content: content
        });
      } catch (error) {
        console.error(chalk.red(`Failed to read file: ${relativePath}`));
      }
    }
    
    debouncedSync();
  });

  // Show that we're actively watching
  console.log(chalk.green('👀 Watching for changes...'));
  console.log(chalk.gray('   Make changes to your files and they will be synced automatically'));

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

async function detectFramework(projectPath: string): Promise<string> {
  const packageJsonPath = join(projectPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return 'static';
  }
  
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
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