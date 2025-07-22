import { NodeBuilder } from './NodeBuilder';
import { BuildResult } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class RemixBuilder extends NodeBuilder {
  async detectFramework(sourceDir: string): Promise<boolean> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    if (!await fs.pathExists(packageJsonPath)) return false;
    
    const packageJson = await fs.readJson(packageJsonPath);
    return !!(packageJson.dependencies?.['@remix-run/react'] || 
              packageJson.devDependencies?.['@remix-run/react'] ||
              packageJson.dependencies?.['@remix-run/node'] ||
              packageJson.devDependencies?.['@remix-run/node']);
  }

  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    
    try {
      const packageJsonPath = path.join(this.sourceDir, 'package.json');
      const packageJson = await fs.readJson(packageJsonPath);
      
      this.log(`Building Remix application: ${packageJson.name}`);

      // Install dependencies
      const installCmd = this.config.installCommand || 
        (await fs.pathExists(path.join(this.sourceDir, 'yarn.lock')) ? 'yarn install' :
         await fs.pathExists(path.join(this.sourceDir, 'pnpm-lock.yaml')) ? 'pnpm install' :
         'npm install');
      
      await this.runCommand(installCmd, this.sourceDir);

      // Build the Remix app
      const buildCmd = this.config.buildCommand || 'npm run build';
      await this.runCommand(buildCmd, this.sourceDir);

      // Copy necessary files
      const filesToCopy = [
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'remix.config.js',
        'build/**/*',
        'public/**/*',
        'app/**/*',
        '.env.production',
        '.env'
      ];

      await this.copyFiles(filesToCopy, this.sourceDir, this.outputDir);

      // Create start script
      const startCommand = packageJson.scripts?.start || 'remix-serve build';
      
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
          framework: 'remix',
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