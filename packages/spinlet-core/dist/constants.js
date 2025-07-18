"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIGNALS = exports.TELEMETRY = exports.REDIS_KEYS = exports.DEFAULT_PORT_RANGE = exports.MAX_CPU_LIMIT = exports.MAX_MEMORY_LIMIT = exports.DEFAULT_CPU_LIMIT = exports.DEFAULT_MEMORY_LIMIT = exports.GRACEFUL_SHUTDOWN_TIMEOUT_MS = exports.STARTUP_TIMEOUT_MS = exports.METRICS_COLLECTION_INTERVAL_MS = exports.HEALTH_CHECK_INTERVAL_MS = exports.IDLE_TIMEOUT_MS = void 0;
// Time constants
exports.IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
exports.HEALTH_CHECK_INTERVAL_MS = 10 * 1000; // 10 seconds
exports.METRICS_COLLECTION_INTERVAL_MS = 5 * 1000; // 5 seconds
exports.STARTUP_TIMEOUT_MS = 30 * 1000; // 30 seconds
exports.GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5 * 1000; // 5 seconds
// Resource limits
exports.DEFAULT_MEMORY_LIMIT = '512MB';
exports.DEFAULT_CPU_LIMIT = '0.5';
exports.MAX_MEMORY_LIMIT = '4GB';
exports.MAX_CPU_LIMIT = '2.0';
// Port configuration
exports.DEFAULT_PORT_RANGE = {
    start: 3000,
    end: 4000
};
// Redis keys
exports.REDIS_KEYS = {
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
exports.TELEMETRY = {
    METRICS_TTL: 3600, // 1 hour for raw metrics
    DAILY_METRICS_TTL: 30 * 24 * 3600, // 30 days for daily aggregates
    RESOURCE_METRICS_TTL: 7 * 24 * 3600, // 7 days for resource metrics
};
// Process signals
exports.SIGNALS = {
    GRACEFUL_SHUTDOWN: 'SIGTERM',
    FORCE_SHUTDOWN: 'SIGKILL',
    HEALTH_CHECK: 'SIGUSR1'
};
//# sourceMappingURL=constants.js.map