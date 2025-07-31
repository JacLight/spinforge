import { BaseBuilder } from './BaseBuilder';
import { BuildResult } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class DenoBuilder extends BaseBuilder {
  async detectFramework(sourceDir: string): Promise<boolean> {
    // Check for deno.json, deno.jsonc, or .ts files with Deno imports
    const denoConfigFiles = ['deno.json', 'deno.jsonc'];
    for (const file of denoConfigFiles) {
      if (await fs.pathExists(path.join(sourceDir, file))) {
        return true;
      }
    }
    
    // Check for mod.ts or main.ts (common Deno entry points)
    const entryFiles = ['mod.ts', 'main.ts', 'server.ts', 'app.ts'];
    for (const file of entryFiles) {
      const filePath = path.join(sourceDir, file);
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf-8');
        if (content.includes('Deno.') || content.includes('https://deno.land')) {
          return true;
        }
      }
    }
    
    return false;
  }

  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    
    try {
      this.log('Building Deno application');

      // Find entry point
      const entryFiles = ['main.ts', 'mod.ts', 'server.ts', 'app.ts', 'index.ts'];
      let entryPoint = this.config.entry;
      
      if (!entryPoint) {
        for (const file of entryFiles) {
          if (await fs.pathExists(path.join(this.sourceDir, file))) {
            entryPoint = file;
            break;
          }
        }
      }
      
      if (!entryPoint) {
        throw new Error('No entry point found for Deno application');
      }

      // Copy all source files
      await fs.copy(this.sourceDir, this.outputDir);

      // Create deps.ts if it exists (for caching dependencies)
      const depsPath = path.join(this.sourceDir, 'deps.ts');
      if (await fs.pathExists(depsPath)) {
        this.log('Caching dependencies...');
        await this.runCommand(`deno cache ${depsPath}`, this.sourceDir);
      }

      // Cache the main entry point
      await this.runCommand(`deno cache ${entryPoint}`, this.outputDir);

      // Create start script
      const permissions = [
        '--allow-net',
        '--allow-read',
        '--allow-write',
        '--allow-env'
      ].join(' ');
      
      await fs.writeFile(
        path.join(this.outputDir, 'start.sh'),
        `#!/bin/sh\ndeno run ${permissions} ${entryPoint}`,
        { mode: 0o755 }
      );

      // Create Dockerfile for Deno
      await fs.writeFile(
        path.join(this.outputDir, 'Dockerfile'),
        `FROM denoland/deno:alpine
WORKDIR /app
COPY . .
RUN deno cache ${entryPoint}
EXPOSE 8000
CMD ["run", "${permissions}", "${entryPoint}"]`
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
          framework: 'deno',
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