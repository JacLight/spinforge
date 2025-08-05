import { BuildConfig, BuildResult } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export abstract class BaseBuilder {
  protected config: BuildConfig;
  protected sourceDir: string;
  protected outputDir: string;
  protected logs: string[] = [];
  protected errors: string[] = [];

  constructor(config: BuildConfig, sourceDir: string, outputDir: string) {
    this.config = config;
    this.sourceDir = sourceDir;
    this.outputDir = outputDir;
  }

  abstract build(): Promise<BuildResult>;
  abstract detectFramework(sourceDir: string): Promise<boolean>;

  protected async runCommand(command: string, cwd: string): Promise<void> {
    this.log(`Running: ${command}`);
    try {
      const { stdout, stderr } = await execAsync(command, { 
        cwd,
        env: { ...process.env, ...this.config.env }
      });
      if (stdout) this.log(stdout);
      if (stderr) this.log(stderr);
    } catch (error: any) {
      this.error(`Command failed: ${command}`);
      this.error(error.message);
      throw error;
    }
  }

  protected async copyFiles(patterns: string[], from: string, to: string): Promise<void> {
    await fs.ensureDir(to);
    
    for (const pattern of patterns) {
      const files = await this.glob(pattern, from);
      for (const file of files) {
        const src = path.join(from, file);
        const dest = path.join(to, file);
        await fs.ensureDir(path.dirname(dest));
        await fs.copy(src, dest);
      }
    }
  }

  protected async glob(pattern: string, cwd: string): Promise<string[]> {
    const glob = await import('glob');
    return glob.glob(pattern, { cwd });
  }

  protected log(message: string): void {
    this.logs.push(message);
    if (process.env.VERBOSE === 'true') {
      console.log(message);
    }
  }

  protected error(message: string): void {
    this.errors.push(message);
    console.error(message);
  }

  protected async getDirectorySize(dir: string): Promise<number> {
    let size = 0;
    const files = await fs.readdir(dir, { withFileTypes: true });
    
    for (const file of files) {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        size += await this.getDirectorySize(filePath);
      } else {
        const stats = await fs.stat(filePath);
        size += stats.size;
      }
    }
    
    return size;
  }

  protected async countFiles(dir: string): Promise<number> {
    let count = 0;
    const files = await fs.readdir(dir, { withFileTypes: true });
    
    for (const file of files) {
      if (file.isDirectory()) {
        count += await this.countFiles(path.join(dir, file.name));
      } else {
        count++;
      }
    }
    
    return count;
  }
}