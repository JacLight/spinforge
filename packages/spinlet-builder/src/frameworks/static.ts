import path from 'path';
import fs from 'fs-extra';
import { BaseFrameworkBuilder } from './base';
import { BuildConfig, BuildResult } from '../types';

export class StaticBuilder extends BaseFrameworkBuilder {
  constructor() {
    super('static' as const);
  }

  async validate(sourceDir: string): Promise<boolean> {
    // Check for common static site files
    const staticIndicators = [
      'index.html',
      'index.htm',
      'public/index.html',
      'dist/index.html',
      'build/index.html'
    ];

    for (const file of staticIndicators) {
      if (await fs.pathExists(path.join(sourceDir, file))) {
        return true;
      }
    }

    return false;
  }

  async build(config: BuildConfig): Promise<BuildResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if there's a build script
      const packageJsonPath = path.join(config.sourceDir, 'package.json');
      const hasPackageJson = await fs.pathExists(packageJsonPath);
      
      if (hasPackageJson) {
        const packageJson = await fs.readJson(packageJsonPath);
        
        // Install dependencies if needed
        if (config.installDeps !== false && (packageJson.dependencies || packageJson.devDependencies)) {
          await this.installDependencies(config.sourceDir, config.env);
        }

        // Run build script if exists
        if (packageJson.scripts?.build) {
          this.logger.info('Running build script');
          await this.runCommand('npm', ['run', 'build'], config.sourceDir, config.env);
        }
      }

      // Find the static files directory
      const possibleDirs = ['dist', 'build', 'public', 'out', '.'];
      let staticDir = '.';
      
      for (const dir of possibleDirs) {
        const fullPath = path.join(config.sourceDir, dir);
        const indexPath = path.join(fullPath, 'index.html');
        if (await fs.pathExists(indexPath)) {
          staticDir = dir;
          break;
        }
      }

      // Copy static files
      if (staticDir === '.') {
        // Copy everything except node_modules and common build files
        const files = await fs.readdir(config.sourceDir);
        for (const file of files) {
          if (!['node_modules', '.git', '.next', '.cache', 'src'].includes(file)) {
            await fs.copy(
              path.join(config.sourceDir, file),
              path.join(config.outputDir, file)
            );
          }
        }
      } else {
        // Copy from specific directory
        await fs.copy(
          path.join(config.sourceDir, staticDir),
          config.outputDir
        );
      }

      // Create a simple static file server
      const serverTemplate = `
const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable compression
app.use(compression());

// Health check for SpinForge
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    spinletId: process.env.SPINLET_ID,
    customerId: process.env.CUSTOMER_ID,
    framework: 'static',
    uptime: process.uptime()
  });
});

// Serve static files
app.use(express.static(__dirname, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  index: ['index.html', 'index.htm']
}));

// SPA fallback - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle shutdown signal
process.on('message', (msg) => {
  if (msg.type === 'shutdown') {
    console.log('Received shutdown signal from SpinForge');
    process.exit(0);
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(\`Static site listening on port \${PORT}\`);
  console.log(\`Spinlet ID: \${process.env.SPINLET_ID}\`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
`;

      // Create package.json for the static server
      const serverPackageJson = {
        name: 'static-spinlet',
        version: '1.0.0',
        private: true,
        scripts: {
          start: 'node server.js'
        },
        dependencies: {
          express: '^4.18.2',
          compression: '^1.7.4'
        }
      };

      await fs.writeJson(
        path.join(config.outputDir, 'package.json'),
        serverPackageJson,
        { spaces: 2 }
      );

      const entryPoint = await this.createEntryPoint(
        config.outputDir,
        serverTemplate,
        'server.js'
      );

      // Install server dependencies
      this.logger.info('Installing static server dependencies');
      await this.runCommand('npm', ['install', '--production'], config.outputDir);

      // Calculate build size
      const size = await this.calculateSize(config.outputDir);

      return {
        success: true,
        framework: 'static',
        entryPoint,
        buildPath: config.outputDir,
        duration: Date.now() - startTime,
        size,
        errors,
        warnings,
        metadata: {
          nodeVersion: process.version
        }
      };
    } catch (error: any) {
      errors.push(error.message);
      
      return {
        success: false,
        framework: 'static',
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