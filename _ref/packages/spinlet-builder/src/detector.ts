import path from 'path';
import fs from 'fs-extra';
import { Framework, FrameworkDetector } from './types';
import { createLogger } from '@spinforge/shared';

const logger = createLogger('FrameworkDetector');

class NextJsDetector implements FrameworkDetector {
  priority = 10;
  
  async detect(sourceDir: string): Promise<Framework | null> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageJson = await fs.readJson(packageJsonPath);
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if ('next' in deps) {
          return 'nextjs';
        }
      } catch {}
    }
    
    // Check for next.config.js
    if (await fs.pathExists(path.join(sourceDir, 'next.config.js')) ||
        await fs.pathExists(path.join(sourceDir, 'next.config.mjs'))) {
      return 'nextjs';
    }
    
    return null;
  }
}

class RemixDetector implements FrameworkDetector {
  priority = 9;
  
  async detect(sourceDir: string): Promise<Framework | null> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageJson = await fs.readJson(packageJsonPath);
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if ('@remix-run/node' in deps || 
            '@remix-run/react' in deps ||
            '@remix-run/serve' in deps) {
          return 'remix';
        }
      } catch {}
    }
    
    // Check for remix.config.js
    if (await fs.pathExists(path.join(sourceDir, 'remix.config.js'))) {
      return 'remix';
    }
    
    return null;
  }
}

class ExpressDetector implements FrameworkDetector {
  priority = 5;
  
  async detect(sourceDir: string): Promise<Framework | null> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageJson = await fs.readJson(packageJsonPath);
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if ('express' in deps) {
          // Make sure it's not a Next.js or Remix app using Express
          if (!('next' in deps) && !('@remix-run/node' in deps)) {
            return 'express';
          }
        }
      } catch {}
    }
    
    return null;
  }
}

class StaticDetector implements FrameworkDetector {
  priority = 1;
  
  async detect(sourceDir: string): Promise<Framework | null> {
    const staticIndicators = [
      'index.html',
      'index.htm',
      'public/index.html',
      'dist/index.html',
      'build/index.html'
    ];

    for (const file of staticIndicators) {
      if (await fs.pathExists(path.join(sourceDir, file))) {
        return 'static';
      }
    }
    
    return null;
  }
}

export class FrameworkAutoDetector {
  private detectors: FrameworkDetector[] = [
    new NextJsDetector(),
    new RemixDetector(),
    new ExpressDetector(),
    new StaticDetector()
  ];

  async detect(sourceDir: string): Promise<Framework> {
    // Check for Spinfile first
    const spinfilePath = path.join(sourceDir, 'spinfile.yaml');
    if (await fs.pathExists(spinfilePath)) {
      try {
        const yaml = await import('yaml');
        const content = await fs.readFile(spinfilePath, 'utf-8');
        const spinfile = yaml.parse(content);
        
        if (spinfile.framework) {
          logger.info(`Framework specified in spinfile: ${spinfile.framework}`);
          return spinfile.framework as Framework;
        }
      } catch (error) {
        logger.warn('Failed to parse spinfile.yaml', { error });
      }
    }

    // Sort detectors by priority (higher priority first)
    const sortedDetectors = [...this.detectors].sort((a, b) => b.priority - a.priority);

    // Try each detector
    for (const detector of sortedDetectors) {
      const framework = await detector.detect(sourceDir);
      if (framework) {
        logger.info(`Auto-detected framework: ${framework}`);
        return framework;
      }
    }

    // Default to static if no framework detected
    logger.info('No framework detected, defaulting to static');
    return 'static';
  }
}