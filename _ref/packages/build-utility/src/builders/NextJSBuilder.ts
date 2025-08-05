import { NodeBuilder } from './NodeBuilder';
import { BuildResult } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class NextJSBuilder extends NodeBuilder {
  async detectFramework(sourceDir: string): Promise<boolean> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    if (!await fs.pathExists(packageJsonPath)) return false;
    
    const packageJson = await fs.readJson(packageJsonPath);
    return !!(packageJson.dependencies?.next || packageJson.devDependencies?.next);
  }

  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    
    try {
      const packageJsonPath = path.join(this.sourceDir, 'package.json');
      const packageJson = await fs.readJson(packageJsonPath);
      
      this.log(`Building Next.js application: ${packageJson.name}`);

      // Install dependencies
      const installCmd = this.config.installCommand || 
        (await fs.pathExists(path.join(this.sourceDir, 'yarn.lock')) ? 'yarn install' :
         await fs.pathExists(path.join(this.sourceDir, 'pnpm-lock.yaml')) ? 'pnpm install' :
         'npm install');
      
      await this.runCommand(installCmd, this.sourceDir);

      // Build the Next.js app
      const buildCmd = this.config.buildCommand || 'npm run build';
      await this.runCommand(buildCmd, this.sourceDir);

      // Copy necessary files
      const filesToCopy = [
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'next.config.js',
        'next.config.mjs',
        '.next/**/*',
        'public/**/*',
        '.env.production',
        '.env.local'
      ];

      // Check if it's a standalone build
      const standaloneDir = path.join(this.sourceDir, '.next', 'standalone');
      if (await fs.pathExists(standaloneDir)) {
        this.log('Found standalone build');
        await fs.copy(standaloneDir, this.outputDir);
        
        // Copy static files
        const staticDir = path.join(this.sourceDir, '.next', 'static');
        if (await fs.pathExists(staticDir)) {
          await fs.copy(staticDir, path.join(this.outputDir, '.next', 'static'));
        }
        
        // Copy public files
        const publicDir = path.join(this.sourceDir, 'public');
        if (await fs.pathExists(publicDir)) {
          await fs.copy(publicDir, path.join(this.outputDir, 'public'));
        }
      } else {
        await this.copyFiles(filesToCopy, this.sourceDir, this.outputDir);
      }

      // Create start script
      const isStandalone = await fs.pathExists(path.join(this.outputDir, 'server.js'));
      const startCommand = isStandalone 
        ? 'node server.js'
        : packageJson.scripts?.start || 'npm start';
      
      await fs.writeFile(
        path.join(this.outputDir, 'start.sh'),
        `#!/bin/sh\n${startCommand}`,
        { mode: 0o755 }
      );

      const buildTime = Date.now() - startTime;
      const size = await this.getDirectorySize(this.outputDir);
      const files = await this.countFiles(this.outputDir);

      return {
        success: true,
        outputPath: this.outputDir,
        logs: this.logs,
        errors: this.errors,
        metadata: {
          framework: 'nextjs',
          size,
          buildTime,
          files
        }
      };
    } catch (error) {
      return {
        success: false,
        logs: this.logs,
        errors: [...this.errors, error.message]
      };
    }
  }
}