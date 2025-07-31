import path from 'path';
import fs from 'fs-extra';
import { nanoid } from 'nanoid';
import PQueue from 'p-queue';
import { createLogger } from '@spinforge/shared';
import { BuildConfig, BuildResult, Framework, FrameworkBuilder, SpinfileConfig } from './types';
import { FrameworkAutoDetector } from './detector';
import { RemixBuilder } from './frameworks/remix';
import { NextJsBuilder } from './frameworks/nextjs';
import { ExpressBuilder } from './frameworks/express';
import { StaticBuilder } from './frameworks/static';

export class Builder {
  private logger = createLogger('Builder');
  private detector = new FrameworkAutoDetector();
  private builders: Map<Framework, FrameworkBuilder> = new Map();
  private buildQueue: PQueue;

  constructor(concurrency: number = 2) {
    // Initialize framework builders
    this.builders.set('remix', new RemixBuilder());
    this.builders.set('nextjs', new NextJsBuilder());
    this.builders.set('express', new ExpressBuilder());
    this.builders.set('static', new StaticBuilder());

    // Create build queue
    this.buildQueue = new PQueue({ concurrency });
  }

  async build(config: BuildConfig): Promise<BuildResult> {
    return this.buildQueue.add(() => this.executeBuild(config)) as Promise<BuildResult>;
  }

  private async executeBuild(config: BuildConfig): Promise<BuildResult> {
    const buildId = nanoid(8);
    this.logger.info(`Starting build ${buildId}`, {
      sourceDir: config.sourceDir,
      framework: config.framework,
      customerId: config.customerId,
      spinletId: config.spinletId
    });

    try {
      // Validate source directory
      if (!await fs.pathExists(config.sourceDir)) {
        throw new Error(`Source directory does not exist: ${config.sourceDir}`);
      }

      // Load spinfile if exists
      const spinfile = await this.loadSpinfile(config.sourceDir);
      if (spinfile) {
        config.spinfile = spinfile;
        
        // Override config with spinfile values
        if (spinfile.framework) {
          config.framework = spinfile.framework;
        }
        if (spinfile.env) {
          config.env = { ...config.env, ...spinfile.env };
        }
      }

      // Auto-detect framework if needed
      if (config.framework === 'auto' || !config.framework) {
        config.framework = await this.detector.detect(config.sourceDir);
      }

      // Get the appropriate builder
      const builder = this.builders.get(config.framework);
      if (!builder) {
        throw new Error(`No builder available for framework: ${config.framework}`);
      }

      // Validate the project for the detected framework
      const isValid = await builder.validate(config.sourceDir);
      if (!isValid) {
        throw new Error(`Project does not appear to be a valid ${config.framework} application`);
      }

      // Create output directory
      await fs.ensureDir(config.outputDir);

      // Execute build
      const result = await builder.build(config);

      // Save build metadata
      if (result.success) {
        await this.saveBuildMetadata(config, result, buildId);
      }

      this.logger.info(`Build ${buildId} completed`, {
        success: result.success,
        duration: result.duration,
        size: result.size
      });

      return result;
    } catch (error: any) {
      this.logger.error(`Build ${buildId} failed`, { error });
      
      return {
        success: false,
        framework: config.framework,
        entryPoint: '',
        buildPath: config.outputDir,
        duration: 0,
        size: 0,
        errors: [error.message]
      };
    }
  }

  private async loadSpinfile(sourceDir: string): Promise<SpinfileConfig | null> {
    const spinfilePath = path.join(sourceDir, 'spinfile.yaml');
    
    if (!await fs.pathExists(spinfilePath)) {
      return null;
    }

    try {
      const yaml = await import('yaml');
      const content = await fs.readFile(spinfilePath, 'utf-8');
      return yaml.parse(content);
    } catch (error) {
      this.logger.warn('Failed to load spinfile.yaml', { error });
      return null;
    }
  }

  private async saveBuildMetadata(
    config: BuildConfig,
    result: BuildResult,
    buildId: string
  ): Promise<void> {
    const metadata = {
      buildId,
      customerId: config.customerId,
      spinletId: config.spinletId,
      framework: result.framework,
      entryPoint: result.entryPoint,
      buildTime: new Date().toISOString(),
      duration: result.duration,
      size: result.size,
      nodeVersion: process.version,
      spinforge: {
        version: '0.1.0',
        builder: `@spinforge/spinlet-builder`
      }
    };

    const metadataPath = path.join(config.outputDir, '.spinforge.json');
    await fs.writeJson(metadataPath, metadata, { spaces: 2 });
  }

  async validateFramework(sourceDir: string, framework: Framework): Promise<boolean> {
    const builder = this.builders.get(framework);
    if (!builder) {
      return false;
    }
    
    return builder.validate(sourceDir);
  }

  getQueueSize(): number {
    return this.buildQueue.size;
  }

  getPendingCount(): number {
    return this.buildQueue.pending;
  }

  async waitForIdle(): Promise<void> {
    await this.buildQueue.onIdle();
  }

  clear(): void {
    this.buildQueue.clear();
  }
}