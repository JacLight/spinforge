export type Framework = 'nextjs' | 'remix' | 'express' | 'static' | 'auto';

export interface BuildConfig {
  sourceDir: string;
  outputDir: string;
  framework: Framework;
  customerId: string;
  spinletId: string;
  env?: Record<string, string>;
  installDeps?: boolean;
  cache?: boolean;
  spinfile?: SpinfileConfig;
}

export interface BuildResult {
  success: boolean;
  framework: Framework;
  entryPoint: string;
  buildPath: string;
  duration: number;
  size: number;
  errors?: string[];
  warnings?: string[];
  metadata?: {
    nodeVersion?: string;
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
}

export interface SpinfileConfig {
  name?: string;
  framework?: Framework;
  build?: {
    command?: string;
    env?: Record<string, string>;
    nodeVersion?: string;
  };
  runtime?: {
    entryPoint?: string;
    port?: number;
    healthCheck?: {
      path?: string;
      interval?: number;
      timeout?: number;
    };
  };
  resources?: {
    memory?: string;
    cpu?: string;
    disk?: string;
  };
  env?: Record<string, string>;
  dependencies?: {
    install?: boolean;
    lockfile?: boolean;
  };
}

export interface FrameworkDetector {
  detect(sourceDir: string): Promise<Framework | null>;
  priority: number;
}

export interface FrameworkBuilder {
  framework: Framework;
  build(config: BuildConfig): Promise<BuildResult>;
  validate(sourceDir: string): Promise<boolean>;
}