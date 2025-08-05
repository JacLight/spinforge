import { NodeBuilder } from './NodeBuilder';
import { BuildResult } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class ReactBuilder extends NodeBuilder {
  async detectFramework(sourceDir: string): Promise<boolean> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    if (!await fs.pathExists(packageJsonPath)) return false;
    
    const packageJson = await fs.readJson(packageJsonPath);
    const hasReact = !!(packageJson.dependencies?.react || packageJson.devDependencies?.react);
    const hasNext = !!(packageJson.dependencies?.next || packageJson.devDependencies?.next);
    const hasRemix = !!(packageJson.dependencies?.['@remix-run/react'] || packageJson.devDependencies?.['@remix-run/react']);
    
    // Only detect as React if it's not Next.js or Remix
    return hasReact && !hasNext && !hasRemix;
  }

  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    
    try {
      const packageJsonPath = path.join(this.sourceDir, 'package.json');
      const packageJson = await fs.readJson(packageJsonPath);
      
      this.log(`Building React application: ${packageJson.name}`);

      // Install dependencies
      const installCmd = this.config.installCommand || 
        (await fs.pathExists(path.join(this.sourceDir, 'yarn.lock')) ? 'yarn install' :
         await fs.pathExists(path.join(this.sourceDir, 'pnpm-lock.yaml')) ? 'pnpm install' :
         'npm install');
      
      await this.runCommand(installCmd, this.sourceDir);

      // Build the React app
      const buildCmd = this.config.buildCommand || 'npm run build';
      await this.runCommand(buildCmd, this.sourceDir);

      // Determine build output directory
      const buildOutputDir = this.config.outputDir || 'build' || 'dist';
      
      // For static React apps, we need to copy the build output
      if (await fs.pathExists(path.join(this.sourceDir, buildOutputDir))) {
        await fs.copy(
          path.join(this.sourceDir, buildOutputDir),
          this.outputDir
        );
      } else {
        throw new Error(`Build output directory ${buildOutputDir} not found`);
      }

      // Create a simple server for serving the static files
      await fs.writeFile(
        path.join(this.outputDir, 'server.js'),
        `const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`
      );

      // Create package.json for the server
      await fs.writeJson(path.join(this.outputDir, 'package.json'), {
        name: packageJson.name || 'react-app',
        version: packageJson.version || '1.0.0',
        scripts: {
          start: 'node server.js'
        },
        dependencies: {
          express: '^4.18.2'
        }
      }, { spaces: 2 });

      // Create start script
      await fs.writeFile(
        path.join(this.outputDir, 'start.sh'),
        `#!/bin/sh\nnpm install --production\nnode server.js`,
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
          framework: 'react',
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