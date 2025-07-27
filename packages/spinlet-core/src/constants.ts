import { config } from '@spinforge/shared';

// Get configuration
const deploymentConfig = config.get().deployment;
const portsConfig = config.get().ports;

// Time constants
export const IDLE_TIMEOUT_MS = deploymentConfig.idleTimeout;
export const STARTUP_TIMEOUT_MS = deploymentConfig.startupTimeout;
export const HEALTH_CHECK_INTERVAL_MS = 10 * 1000; // 10 seconds
export const METRICS_COLLECTION_INTERVAL_MS = 5 * 1000; // 5 seconds
export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5 * 1000; // 5 seconds

// Resource limits
export const DEFAULT_MEMORY_LIMIT = '512MB';
export const DEFAULT_CPU_LIMIT = '0.5';
export const MAX_MEMORY_LIMIT = '4GB';
export const MAX_CPU_LIMIT = '2.0';

// Port configuration
export const DEFAULT_PORT_RANGE = {
  start: portsConfig.rangeStart,
  end: portsConfig.rangeEnd
};

// Redis keys
export const REDIS_KEYS = {
  ROUTES: 'spinforge:routes',
  ACTIVE_SPINLETS: 'spinforge:active',
  SPINLET_PREFIX: 'spinforge:spinlets',
  PORTS_ALLOCATED: 'spinforge:ports:allocated',
  PORTS_POOL: 'spinforge:ports:pool',
  METRICS_PREFIX: 'spinforge:metrics',
  AUDIT_STREAM: 'spinforge:audit',
  CUSTOMER_PREFIX: 'spinforge:customers'
};

// Telemetry
export const TELEMETRY = {
  METRICS_TTL: 3600, // 1 hour for raw metrics
  DAILY_METRICS_TTL: 30 * 24 * 3600, // 30 days for daily aggregates
  RESOURCE_METRICS_TTL: 7 * 24 * 3600, // 7 days for resource metrics
};

// Process signals
export const SIGNALS = {
  GRACEFUL_SHUTDOWN: 'SIGTERM',
  FORCE_SHUTDOWN: 'SIGKILL',
  HEALTH_CHECK: 'SIGUSR1'
};