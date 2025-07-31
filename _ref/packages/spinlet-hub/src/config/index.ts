export interface AdminCredentials {
  username: string;
  password: string;
  token?: string;
}

export interface AdminUser {
  id: string;
  username: string;
  password: string; // Hashed
  email?: string;
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
  isSuperAdmin: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
  limits?: {
    maxSpinlets?: number;
    maxMemory?: string;
    maxDomains?: number;
  };
}

export interface HubConfig {
  port: number;
  host: string;
  trustProxy: boolean;
  cors?: any;
  maxRequestSize: string;
  requestTimeout: number;
  keepAliveTimeout: number;
  ssl?: {
    enabled: boolean;
    cert?: string;
    key?: string;
  };
  rateLimits: {
    global: any;
    perCustomer: any;
  };
  // Admin configuration
  admin: {
    defaultUsername: string;
    defaultPassword: string;
    tokenSecret: string;
    sessionTimeout: number; // in seconds
  };
  // Database configuration
  database?: {
    type: 'redis' | 'sqlite' | 'postgres';
    connectionString?: string;
    path?: string; // For SQLite
  };
}

export const defaultConfig: HubConfig = {
  port: parseInt(process.env.PORT || '9006'),
  host: process.env.HOST || '0.0.0.0',
  trustProxy: process.env.TRUST_PROXY === 'true',
  maxRequestSize: process.env.MAX_REQUEST_SIZE || '50mb',
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '120000'),
  keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '65000'),
  rateLimits: {
    global: {
      windowMs: 60 * 1000, // 1 minute
      max: 100,
    },
    perCustomer: {
      windowMs: 60 * 1000, // 1 minute
      max: 50,
    },
  },
  admin: {
    defaultUsername: process.env.ADMIN_USERNAME || 'admin',
    defaultPassword: process.env.ADMIN_PASSWORD || 'changeme',
    tokenSecret: process.env.ADMIN_TOKEN_SECRET || 'spinforge-admin-secret-' + Math.random().toString(36),
    sessionTimeout: parseInt(process.env.ADMIN_SESSION_TIMEOUT || '86400'), // 24 hours
  },
  database: {
    type: 'redis',
    connectionString: process.env.REDIS_URL || 'redis://localhost:16378',
  },
};