import { BaseBuilder } from './BaseBuilder';
import { BuildResult } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class FlutterBuilder extends BaseBuilder {
  async detectFramework(sourceDir: string): Promise<boolean> {
    const pubspecPath = path.join(sourceDir, 'pubspec.yaml');
    if (!await fs.pathExists(pubspecPath)) return false;
    
    const content = await fs.readFile(pubspecPath, 'utf-8');
    return content.includes('flutter:');
  }

  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    
    try {
      this.log('Building Flutter web application');

      const pubspecPath = path.join(this.sourceDir, 'pubspec.yaml');
      if (!await fs.pathExists(pubspecPath)) {
        throw new Error('No pubspec.yaml found');
      }

      // Get dependencies
      await this.runCommand('flutter pub get', this.sourceDir);

      // Build for web
      const buildCmd = this.config.buildCommand || 'flutter build web --release';
      await this.runCommand(buildCmd, this.sourceDir);

      // Copy build output
      const webBuildPath = path.join(this.sourceDir, 'build', 'web');
      if (!await fs.pathExists(webBuildPath)) {
        throw new Error('Flutter web build output not found');
      }

      await fs.copy(webBuildPath, this.outputDir);

      // Create a simple server for serving the Flutter web app
      await fs.writeFile(
        path.join(this.outputDir, 'server.js'),
        `const express = require('express');
const path = require('path');
const compression = require('compression');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(compression());
app.use(express.static(__dirname));

// Service worker support
app.get('/flutter_service_worker.js', (req, res) => {
  res.set('Service-Worker-Allowed', '/');
  res.sendFile(path.resolve(__dirname, 'flutter_service_worker.js'));
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(\`Flutter web app running on port \${PORT}\`);
});`
      );

      // Create package.json for the server
      await fs.writeJson(path.join(this.outputDir, 'package.json'), {
        name: 'flutter-web-app',
        version: '1.0.0',
        scripts: {
          start: 'node server.js'
        },
        dependencies: {
          express: '^4.18.2',
          compression: '^1.7.4'
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
          framework: 'flutter',
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