import { BaseBuilder } from './BaseBuilder';
import { BuildResult } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class NodeBuilder extends BaseBuilder {
  async detectFramework(sourceDir: string): Promise<boolean> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    return fs.existsSync(packageJsonPath);
  }

  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    
    try {
      // Check if package.json exists
      const packageJsonPath = path.join(this.sourceDir, 'package.json');
      if (!await fs.pathExists(packageJsonPath)) {
        throw new Error('No package.json found');
      }

      // Read package.json
      const packageJson = await fs.readJson(packageJsonPath);
      this.log(`Building Node.js application: ${packageJson.name}`);

      // Install dependencies
      const installCmd = this.config.installCommand || 
        (await fs.pathExists(path.join(this.sourceDir, 'yarn.lock')) ? 'yarn install' :
         await fs.pathExists(path.join(this.sourceDir, 'pnpm-lock.yaml')) ? 'pnpm install' :
         'npm install');
      
      await this.runCommand(installCmd, this.sourceDir);

      // Run build command if specified
      if (this.config.buildCommand || packageJson.scripts?.build) {
        const buildCmd = this.config.buildCommand || 'npm run build';
        await this.runCommand(buildCmd, this.sourceDir);
      }

      // Determine output directory
      const outputDirs = ['dist', 'build', '.next', 'out'];
      let buildOutputDir = this.config.outputDir;
      
      if (!buildOutputDir) {
        for (const dir of outputDirs) {
          if (await fs.pathExists(path.join(this.sourceDir, dir))) {
            buildOutputDir = dir;
            break;
          }
        }
      }

      // Copy files to output
      const filesToCopy = [
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        '.env.production',
        'public/**/*',
        'static/**/*'
      ];

      if (buildOutputDir) {
        filesToCopy.push(`${buildOutputDir}/**/*`);
      } else {
        // If no build output, copy source files
        filesToCopy.push('src/**/*', 'lib/**/*', 'server/**/*');
      }

      await this.copyFiles(filesToCopy, this.sourceDir, this.outputDir);

      // Create start script
      const startScript = this.config.entry || packageJson.main || 'index.js';
      const startCommand = packageJson.scripts?.start || `node ${startScript}`;
      
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
          framework: 'node',
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