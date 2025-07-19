import path from 'path';
import fs from 'fs-extra';
import { BaseFrameworkBuilder } from './base';
import { BuildConfig, BuildResult } from '../types';

export class NextJsBuilder extends BaseFrameworkBuilder {
  constructor() {
    super('nextjs' as const);
  }

  async validate(sourceDir: string): Promise<boolean> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      return false;
    }

    try {
      const packageJson = await fs.readJson(packageJsonPath);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check for Next.js dependency
      if (!('next' in deps)) {
        return false;
      }

      // Check for next.config.js or next.config.mjs
      await fs.pathExists(path.join(sourceDir, 'next.config.js')) ||
      await fs.pathExists(path.join(sourceDir, 'next.config.mjs'));
      
      return true;
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

      // Check if standalone output is configured
      const nextConfigPath = path.join(config.sourceDir, 'next.config.js');
      let useStandalone = false;
      
      if (await fs.pathExists(nextConfigPath)) {
        const configContent = await fs.readFile(nextConfigPath, 'utf-8');
        useStandalone = configContent.includes('standalone');
      }

      // Run Next.js build
      this.logger.info('Building Next.js application');
      await this.runCommand('npm', ['run', 'build'], config.sourceDir, config.env);

      // Copy build output based on build type
      if (useStandalone) {
        // Standalone build
        await this.copyBuildOutput(config.sourceDir, config.outputDir, [
          '.next/standalone',
          '.next/static',
          'public',
          '.env',
          '.env.production'
        ]);

        // Move standalone contents to root
        const standaloneDir = path.join(config.outputDir, '.next/standalone');
        if (await fs.pathExists(standaloneDir)) {
          const files = await fs.readdir(standaloneDir);
          for (const file of files) {
            await fs.move(
              path.join(standaloneDir, file),
              path.join(config.outputDir, file),
              { overwrite: true }
            );
          }
          await fs.remove(standaloneDir);
        }
      } else {
        // Regular build
        await this.copyBuildOutput(config.sourceDir, config.outputDir, [
          '.next',
          'public',
          'package.json',
          'package-lock.json',
          'yarn.lock',
          'pnpm-lock.yaml',
          '.env',
          '.env.production',
          'next.config.js',
          'next.config.mjs'
        ]);
      }

      // Create server entry point
      const serverTemplate = useStandalone ? `
const { createServer } = require('http');
const { parse } = require('url');
const next = require('./node_modules/next/dist/server/next-server');

const PORT = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== 'production';

// Create Next.js app
const app = next({ 
  dev,
  dir: __dirname,
  conf: require('./next.config.js')
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // Health check for SpinForge
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        spinletId: process.env.SPINLET_ID,
        customerId: process.env.CUSTOMER_ID,
        framework: 'nextjs',
        uptime: process.uptime()
      }));
      return;
    }

    handle(req, res, parsedUrl);
  }).listen(PORT, (err) => {
    if (err) throw err;
    console.log(\`Next.js app listening on port \${PORT}\`);
    console.log(\`Spinlet ID: \${process.env.SPINLET_ID}\`);
  });
});

// Handle shutdown signal
process.on('message', (msg) => {
  if (msg.type === 'shutdown') {
    console.log('Received shutdown signal from SpinForge');
    process.exit(0);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  process.exit(0);
});
` : `
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const PORT = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== 'production';

// Create Next.js app
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // Health check for SpinForge
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        spinletId: process.env.SPINLET_ID,
        customerId: process.env.CUSTOMER_ID,
        framework: 'nextjs',
        uptime: process.uptime()
      }));
      return;
    }

    handle(req, res, parsedUrl);
  }).listen(PORT, (err) => {
    if (err) throw err;
    console.log(\`Next.js app listening on port \${PORT}\`);
    console.log(\`Spinlet ID: \${process.env.SPINLET_ID}\`);
  });
});

// Handle shutdown signal
process.on('message', (msg) => {
  if (msg.type === 'shutdown') {
    console.log('Received shutdown signal from SpinForge');
    process.exit(0);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  process.exit(0);
});
`;

      const entryPoint = await this.createEntryPoint(
        config.outputDir, 
        serverTemplate,
        'server.js'
      );

      // Install production dependencies if not standalone
      if (!useStandalone) {
        this.logger.info('Installing production dependencies');
        await this.runCommand('npm', ['install', '--production'], config.outputDir);
      }

      // Calculate build size
      const size = await this.calculateSize(config.outputDir);

      // Get metadata
      const packageJson = await this.readPackageJson(config.sourceDir);

      return {
        success: true,
        framework: 'nextjs',
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
        framework: 'nextjs',
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