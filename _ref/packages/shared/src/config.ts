/**
 * Centralized configuration management for SpinForge
 * Loads configuration from environment variables with fallbacks
 */

export interface SpinForgeConfig {
  env: 'development' | 'staging' | 'production';
  
  // Service URLs
  api: {
    url: string;
    port: number;
  };
  
  web: {
    url: string;
    port: number;
  };
  
  auth: {
    url: string;
    secret: string;
    jwtSecret: string;
    callbackPort: number;
    timeout: number;
  };
  
  // Redis Configuration
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };
  
  // Database
  database: {
    url?: string;
  };
  
  // Deployment Configuration
  deployment: {
    baseDir: string;
    startupTimeout: number;
    idleTimeout: number;
  };
  
  // Port Allocation
  ports: {
    rangeStart: number;
    rangeEnd: number;
  };
  
  // Logging
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'pretty' | 'json';
  };
  
  // Docker
  docker: {
    registry?: string;
  };
  
  // Feature Flags
  features: {
    hotReload: boolean;
    metrics: boolean;
    telemetry: boolean;
  };
  
  // Security
  security: {
    corsOrigin: string[];
    rateLimitWindow: number;
    rateLimitMax: number;
  };
}

class ConfigManager {
  private config: SpinForgeConfig | null = null;
  
  /**
   * Get the current environment
   */
  private getEnvironment(): 'development' | 'staging' | 'production' {
    const env = process.env.NODE_ENV || 'development';
    if (env === 'production' || env === 'staging') {
      return env;
    }
    return 'development';
  }
  
  /**
   * Parse boolean environment variable
   */
  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }
  
  /**
   * Parse integer environment variable
   */
  private parseInt(value: string | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  /**
   * Parse comma-separated list
   */
  private parseList(value: string | undefined, defaultValue: string[]): string[] {
    if (!value) return defaultValue;
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  
  /**
   * Load configuration from environment variables
   */
  load(): SpinForgeConfig {
    if (this.config) return this.config;
    
    const env = this.getEnvironment();
    
    this.config = {
      env,
      
      api: {
        url: process.env.SPINFORGE_API_URL || (env === 'development' ? 'http://localhost:9006' : 'https://api.spinforge.dev'),
        port: this.parseInt(process.env.API_PORT, 9006),
      },
      
      web: {
        url: process.env.SPINFORGE_WEB_URL || (env === 'development' ? 'http://localhost:9010' : 'https://spinforge.dev'),
        port: this.parseInt(process.env.WEB_PORT, 9010),
      },
      
      auth: {
        url: process.env.SPINFORGE_AUTH_URL || (env === 'development' ? 'http://localhost:3000' : 'https://auth.spinforge.dev'),
        secret: process.env.AUTH_SECRET || 'dev-secret-key-change-in-production',
        jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
        callbackPort: this.parseInt(process.env.CLI_AUTH_CALLBACK_PORT, 9876),
        timeout: this.parseInt(process.env.CLI_AUTH_TIMEOUT, 300000),
      },
      
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: this.parseInt(process.env.REDIS_PORT, 16378),
        password: process.env.REDIS_PASSWORD,
        db: this.parseInt(process.env.REDIS_DB, 0),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'spinforge:',
      },
      
      database: {
        url: process.env.DATABASE_URL,
      },
      
      deployment: {
        baseDir: process.env.SPINFORGE_DEPLOYMENTS || (env === 'development' ? '/Users/imzee/.spinforge/deployments' : '/spinforge/deployments'),
        startupTimeout: this.parseInt(process.env.SPINLET_STARTUP_TIMEOUT_MS, 300000),
        idleTimeout: this.parseInt(process.env.IDLE_TIMEOUT_MS, 300000),
      },
      
      ports: {
        rangeStart: this.parseInt(process.env.PORT_RANGE_START, 10000),
        rangeEnd: this.parseInt(process.env.PORT_RANGE_END, 20000),
      },
      
      logging: {
        level: (process.env.LOG_LEVEL || 'debug') as any,
        format: (process.env.LOG_FORMAT || 'pretty') as any,
      },
      
      docker: {
        registry: process.env.DOCKER_REGISTRY,
      },
      
      features: {
        hotReload: this.parseBoolean(process.env.ENABLE_HOT_RELOAD, env === 'development'),
        metrics: this.parseBoolean(process.env.ENABLE_METRICS, true),
        telemetry: this.parseBoolean(process.env.ENABLE_TELEMETRY, env !== 'development'),
      },
      
      security: {
        corsOrigin: this.parseList(
          process.env.CORS_ORIGIN,
          env === 'development' ? ['http://localhost:3000', 'http://localhost:9010'] : ['https://spinforge.dev']
        ),
        rateLimitWindow: this.parseInt(process.env.RATE_LIMIT_WINDOW, 900000),
        rateLimitMax: this.parseInt(process.env.RATE_LIMIT_MAX, 100),
      },
    };
    
    return this.config;
  }
  
  /**
   * Get configuration
   */
  get(): SpinForgeConfig {
    if (!this.config) {
      this.load();
    }
    return this.config!;
  }
  
  /**
   * Reload configuration (useful for testing)
   */
  reload(): SpinForgeConfig {
    this.config = null;
    return this.load();
  }
}

// Export singleton instance
export const config = new ConfigManager();

// Export helper functions for common use cases
export function getApiUrl(): string {
  return config.get().api.url;
}

export function getWebUrl(): string {
  return config.get().web.url;
}

export function getAuthUrl(): string {
  return config.get().auth.url;
}

export function getRedisConfig() {
  return config.get().redis;
}

export function getDeploymentConfig() {
  return config.get().deployment;
}

export function isProduction(): boolean {
  return config.get().env === 'production';
}

export function isDevelopment(): boolean {
  return config.get().env === 'development';
}

export function isStaging(): boolean {
  return config.get().env === 'staging';
}