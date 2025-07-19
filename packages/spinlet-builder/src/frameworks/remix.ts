import path from 'path';
import fs from 'fs-extra';
import { BaseFrameworkBuilder } from './base';
import { BuildConfig, BuildResult } from '../types';

export class RemixBuilder extends BaseFrameworkBuilder {
  constructor() {
    super('remix' as const);
  }

  async validate(sourceDir: string): Promise<boolean> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      return false;
    }

    try {
      const packageJson = await fs.readJson(packageJsonPath);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      return '@remix-run/node' in deps || 
             '@remix-run/react' in deps ||
             '@remix-run/serve' in deps;
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

      // Run Remix build
      this.logger.info('Building Remix application');
      await this.runCommand('npm', ['run', 'build'], config.sourceDir, config.env);

      // Copy build output
      await this.copyBuildOutput(config.sourceDir, config.outputDir, [
        'build',
        'public',
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        '.env',
        '.env.production'
      ]);

      // Create server entry point
      const serverTemplate = `
const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const { createRequestHandler } = require('@remix-run/express');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression());
app.use(morgan('tiny'));

// Health check for SpinForge
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    spinletId: process.env.SPINLET_ID,
    customerId: process.env.CUSTOMER_ID,
    framework: 'remix',
    uptime: process.uptime()
  });
});

// Serve static files
app.use(express.static('public'));

// Remix handler
const BUILD_DIR = './build';
app.all('*', createRequestHandler({
  build: require(BUILD_DIR),
  mode: process.env.NODE_ENV
}));

// Handle shutdown signal
process.on('message', (msg) => {
  if (msg.type === 'shutdown') {
    console.log('Received shutdown signal from SpinForge');
    process.exit(0);
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(\`Remix app listening on port \${PORT}\`);
  console.log(\`Spinlet ID: \${process.env.SPINLET_ID}\`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
`;

      const entryPoint = await this.createEntryPoint(
        config.outputDir, 
        serverTemplate,
        'server.js'
      );

      // Install production dependencies in output directory
      this.logger.info('Installing production dependencies');
      await this.runCommand('npm', ['install', '--production'], config.outputDir);

      // Calculate build size
      const size = await this.calculateSize(config.outputDir);

      // Get metadata
      const packageJson = await this.readPackageJson(config.outputDir);

      return {
        success: true,
        framework: 'remix',
        entryPoint,
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
        framework: 'remix',
        entryPoint: '',
        buildPath: config.outputDir,
        duration: Date.now() - startTime,
        size: 0,
        errors,
        warnings
      };
    }
  }
}