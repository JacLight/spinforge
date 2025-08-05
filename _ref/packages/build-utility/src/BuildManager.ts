import { BuildConfig, BuildOptions, BuildResult } from './types';
import {
  NodeBuilder,
  ReactBuilder,
  NextJSBuilder,
  RemixBuilder,
  NestJSBuilder,
  DenoBuilder,
  FlutterBuilder,
  BaseBuilder
} from './builders';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as tmp from 'tmp';
import * as tar from 'tar';
import chalk from 'chalk';

export class BuildManager {
  private builders: BaseBuilder[] = [];

  async build(options: BuildOptions): Promise<BuildResult> {
    console.log(chalk.blue('🚀 SpinForge Build Utility'));
    console.log(chalk.gray('================================\n'));

    // Create temporary output directory
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const outputDir = options.output || tmpDir.name;

    try {
      // Load build config
      const config = await this.loadConfig(options);
      
      // Detect or use specified framework
      const framework = options.framework || config.framework || 'auto';
      const builder = await this.getBuilder(framework, config, options.source, outputDir);
      
      if (!builder) {
        throw new Error('Could not detect framework or no suitable builder found');
      }

      console.log(chalk.green(`✓ Detected framework: ${framework}`));
      console.log(chalk.gray(`  Source: ${options.source}`));
      console.log(chalk.gray(`  Output: ${outputDir}\n`));

      // Run the build
      const result = await builder.build();

      if (result.success && options.output && options.output.endsWith('.tar.gz')) {
        // Create tarball if output ends with .tar.gz
        console.log(chalk.blue('\n📦 Creating deployment package...'));
        await this.createTarball(outputDir, options.output);
        result.outputPath = options.output;
      }

      // Print summary
      if (result.success) {
        console.log(chalk.green('\n✅ Build completed successfully!'));
        if (result.metadata) {
          console.log(chalk.gray(`  Framework: ${result.metadata.framework}`));
          console.log(chalk.gray(`  Build time: ${result.metadata.buildTime}ms`));
          console.log(chalk.gray(`  Size: ${this.formatSize(result.metadata.size)}`));
          console.log(chalk.gray(`  Files: ${result.metadata.files}`));
          console.log(chalk.gray(`  Output: ${result.outputPath}`));
        }
      } else {
        console.log(chalk.red('\n❌ Build failed!'));
        result.errors.forEach(error => {
          console.log(chalk.red(`  - ${error}`));
        });
      }

      return result;
    } finally {
      // Cleanup temp directory if used
      if (!options.output) {
        tmpDir.removeCallback();
      }
    }
  }

  private async loadConfig(options: BuildOptions): Promise<BuildConfig> {
    if (options.config) {
      const configPath = path.resolve(options.config);
      if (await fs.pathExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf-8');
        if (configPath.endsWith('.json')) {
          return JSON.parse(content);
        } else if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
          const yaml = await import('js-yaml');
          return yaml.load(content) as BuildConfig;
        }
      }
    }

    // Try to find spinforge.json or spinforge.yaml in source directory
    const configFiles = ['spinforge.json', 'spinforge.yaml', 'spinforge.yml'];
    for (const file of configFiles) {
      const configPath = path.join(options.source, file);
      if (await fs.pathExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf-8');
        if (file.endsWith('.json')) {
          return JSON.parse(content);
        } else {
          const yaml = await import('js-yaml');
          return yaml.load(content) as BuildConfig;
        }
      }
    }

    // Return default config
    return {
      name: path.basename(options.source),
      framework: 'auto'
    };
  }

  private async getBuilder(
    framework: string,
    config: BuildConfig,
    sourceDir: string,
    outputDir: string
  ): Promise<BaseBuilder | null> {
    const builders = [
      new NextJSBuilder(config, sourceDir, outputDir),
      new RemixBuilder(config, sourceDir, outputDir),
      new NestJSBuilder(config, sourceDir, outputDir),
      new ReactBuilder(config, sourceDir, outputDir),
      new FlutterBuilder(config, sourceDir, outputDir),
      new DenoBuilder(config, sourceDir, outputDir),
      new NodeBuilder(config, sourceDir, outputDir)
    ];

    if (framework === 'auto') {
      // Auto-detect framework
      for (const builder of builders) {
        if (await builder.detectFramework(sourceDir)) {
          return builder;
        }
      }
    } else {
      // Use specified framework
      const builderMap: Record<string, BaseBuilder> = {
        node: builders.find(b => b instanceof NodeBuilder)!,
        react: builders.find(b => b instanceof ReactBuilder)!,
        nextjs: builders.find(b => b instanceof NextJSBuilder)!,
        next: builders.find(b => b instanceof NextJSBuilder)!,
        remix: builders.find(b => b instanceof RemixBuilder)!,
        nestjs: builders.find(b => b instanceof NestJSBuilder)!,
        nest: builders.find(b => b instanceof NestJSBuilder)!,
        deno: builders.find(b => b instanceof DenoBuilder)!,
        flutter: builders.find(b => b instanceof FlutterBuilder)!
      };

      return builderMap[framework.toLowerCase()] || null;
    }

    return null;
  }

  private async createTarball(sourceDir: string, outputPath: string): Promise<void> {
    await fs.ensureDir(path.dirname(outputPath));
    
    await tar.create(
      {
        gzip: true,
        file: outputPath,
        cwd: sourceDir
      },
      ['.']
    );
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}