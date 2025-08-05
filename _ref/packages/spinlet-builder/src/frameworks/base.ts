import { execa, ExecaError } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { createLogger } from '@spinforge/shared';
import { BuildConfig, BuildResult, FrameworkBuilder, Framework } from '../types';

export abstract class BaseFrameworkBuilder implements FrameworkBuilder {
  protected logger: ReturnType<typeof createLogger>;
  
  constructor(public readonly framework: Framework) {
    this.logger = createLogger(`Builder:${this.framework}`);
  }

  abstract build(config: BuildConfig): Promise<BuildResult>;
  abstract validate(sourceDir: string): Promise<boolean>;

  protected async runCommand(
    command: string,
    args: string[],
    cwd: string,
    env?: Record<string, string>
  ): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execa(command, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: 'pipe'
      });
      
      return {
        stdout: result.stdout,
        stderr: result.stderr
      };
    } catch (error) {
      const execaError = error as ExecaError;
      this.logger.error(`Command failed: ${command} ${args.join(' ')}`, {
        stdout: execaError.stdout,
        stderr: execaError.stderr,
        exitCode: execaError.exitCode
      });
      throw error;
    }
  }

  protected async installDependencies(
    sourceDir: string,
    env?: Record<string, string>
  ): Promise<void> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      throw new Error('No package.json found');
    }

    // Detect package manager
    const hasYarnLock = await fs.pathExists(path.join(sourceDir, 'yarn.lock'));
    const hasPnpmLock = await fs.pathExists(path.join(sourceDir, 'pnpm-lock.yaml'));
    
    let command: string;
    let args: string[];
    
    if (hasPnpmLock) {
      command = 'pnpm';
      args = ['install', '--frozen-lockfile'];
    } else if (hasYarnLock) {
      command = 'yarn';
      args = ['install', '--frozen-lockfile'];
    } else {
      command = 'npm';
      args = ['ci'];
      
      // Fallback to install if no lock file
      const hasPackageLock = await fs.pathExists(path.join(sourceDir, 'package-lock.json'));
      if (!hasPackageLock) {
        args = ['install'];
      }
    }

    this.logger.info(`Installing dependencies with ${command}`);
    await this.runCommand(command, args, sourceDir, env);
  }

  protected async copyBuildOutput(
    sourceDir: string,
    outputDir: string,
    patterns: string[]
  ): Promise<void> {
    await fs.ensureDir(outputDir);

    for (const pattern of patterns) {
      const sourcePath = path.join(sourceDir, pattern);
      const destPath = path.join(outputDir, pattern);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath, {
          overwrite: true,
          errorOnExist: false
        });
      }
    }
  }

  protected async createEntryPoint(
    outputDir: string,
    template: string,
    filename: string = 'server.js'
  ): Promise<string> {
    const entryPath = path.join(outputDir, filename);
    await fs.writeFile(entryPath, template);
    await fs.chmod(entryPath, '755');
    return entryPath;
  }

  protected async calculateSize(dir: string): Promise<number> {
    const stats = await fs.stat(dir);
    
    if (!stats.isDirectory()) {
      return stats.size;
    }

    let totalSize = 0;
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        totalSize += await this.calculateSize(filePath);
      } else {
        totalSize += stat.size;
      }
    }
    
    return totalSize;
  }

  protected async readPackageJson(sourceDir: string): Promise<any> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    return await fs.readJson(packageJsonPath);
  }
}