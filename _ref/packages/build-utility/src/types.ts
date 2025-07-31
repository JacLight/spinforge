export interface BuildConfig {
  name: string;
  version?: string;
  framework: 'node' | 'static' | 'python' | 'go' | 'rust' | 'auto';
  entry?: string;
  buildCommand?: string;
  installCommand?: string;
  outputDir?: string;
  env?: Record<string, string>;
  dependencies?: Record<string, string>;
  runtime?: {
    node?: string;
    python?: string;
    go?: string;
    rust?: string;
  };
}

export interface BuildOptions {
  source: string;
  output: string;
  config?: string;
  framework?: string;
  cache?: boolean;
  verbose?: boolean;
  docker?: boolean;
}

export interface BuildResult {
  success: boolean;
  outputPath?: string;
  logs: string[];
  errors: string[];
  metadata?: {
    framework: string;
    size: number;
    buildTime: number;
    files: number;
  };
}