import path from 'path';
import fs from 'fs-extra';
import { BaseFrameworkBuilder } from './base';
import { BuildConfig, BuildResult } from '../types';

export class ExpressBuilder extends BaseFrameworkBuilder {
  constructor() {
    super('express' as const);
  }

  async validate(sourceDir: string): Promise<boolean> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      return false;
    }

    try {
      const packageJson = await fs.readJson(packageJsonPath);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check for Express dependency
      return 'express' in deps;
    } catch {
      return false;
    }
  }

  async build(config: BuildConfig): Promise<BuildResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Install dependencies if needed
      if (config.installDeps !== false) {
        await this.installDependencies(config.sourceDir, config.env);
      }

      // Check for TypeScript
      const isTypeScript = await fs.pathExists(path.join(config.sourceDir, 'tsconfig.json'));
      
      if (isTypeScript) {
        // Build TypeScript
        this.logger.info('Building TypeScript Express application');
        
        // Check if build script exists
        const packageJson = await this.readPackageJson(config.sourceDir);
        if (packageJson.scripts?.build) {
          await this.runCommand('npm', ['run', 'build'], config.sourceDir, config.env);
        } else {
          // Run tsc directly
          await this.runCommand('npx', ['tsc'], config.sourceDir, config.env);
        }
      }

      // Copy all files
      await this.copyBuildOutput(config.sourceDir, config.outputDir, [
        'dist',
        'build',
        'src',
        'public',
        'views',
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        '.env',
        '.env.production'
      ]);

      // Find main entry point
      const packageJson = await this.readPackageJson(config.outputDir);
      let mainFile = packageJson.main || 'index.js';
      
      // Check common entry points
      const possibleEntries = [
        mainFile,
        'server.js',
        'app.js',
        'index.js',
        'dist/index.js',
        'dist/server.js',
        'dist/app.js',
        'build/index.js',
        'build/server.js',
        'build/app.js'
      ];

      let entryPoint = '';
      for (const entry of possibleEntries) {
        const fullPath = path.join(config.outputDir, entry);
        if (await fs.pathExists(fullPath)) {
          entryPoint = entry;
          break;
        }
      }

      if (!entryPoint) {
        throw new Error('Could not find entry point for Express application');
      }

      // Create wrapper if needed to add health check
      const originalEntry = path.join(config.outputDir, entryPoint);
      const wrapperNeeded = await this.needsHealthCheckWrapper(originalEntry);

      if (wrapperNeeded) {
        // Rename original entry
        const backupEntry = entryPoint.replace(/\.js$/, '.original.js');
        await fs.move(originalEntry, path.join(config.outputDir, backupEntry));

        // Create wrapper
        const wrapperTemplate = `
const app = require('./${backupEntry}');
const http = require('http');

// Ensure app is an Express instance
const express = require('express');
const isExpress = app && app.listen && app.use;

if (!isExpress) {
  console.error('Error: The main export must be an Express app instance');
  process.exit(1);
}

// Add health check for SpinForge
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    spinletId: process.env.SPINLET_ID,
    customerId: process.env.CUSTOMER_ID,
    framework: 'express',
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3000;

// Handle shutdown signal
process.on('message', (msg) => {
  if (msg.type === 'shutdown') {
    console.log('Received shutdown signal from SpinForge');
    process.exit(0);
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(\`Express app listening on port \${PORT}\`);
  console.log(\`Spinlet ID: \${process.env.SPINLET_ID}\`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
`;

        await this.createEntryPoint(config.outputDir, wrapperTemplate, entryPoint);
      }

      // Install production dependencies
      this.logger.info('Installing production dependencies');
      await this.runCommand('npm', ['install', '--production'], config.outputDir);

      // Calculate build size
      const size = await this.calculateSize(config.outputDir);

      return {
        success: true,
        framework: 'express',
        entryPoint: path.join(config.outputDir, entryPoint),
        buildPath: config.outputDir,
        duration: Date.now() - startTime,
        size,
        errors,
        warnings,
        metadata: {
          nodeVersion: process.version,
          dependencies: packageJson.dependencies,
          scripts: packageJson.scripts
        }
      };
    } catch (error: any) {
      errors.push(error.message);
      
      return {
        success: false,
        framework: 'express',
        entryPoint: '',
        buildPath: config.outputDir,
        duration: Date.now() - startTime,
        size: 0,
        errors,
        warnings
      };
    }
  }

  private async needsHealthCheckWrapper(entryPath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(entryPath, 'utf-8');
      // Check if health endpoint already exists
      return !content.includes('/health');
    } catch {
      return true;
    }
  }
}