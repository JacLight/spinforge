export declare const IDLE_TIMEOUT_MS: number;
export declare const HEALTH_CHECK_INTERVAL_MS: number;
export declare const METRICS_COLLECTION_INTERVAL_MS: number;
export declare const STARTUP_TIMEOUT_MS: number;
export declare const GRACEFUL_SHUTDOWN_TIMEOUT_MS: number;
export declare const DEFAULT_MEMORY_LIMIT = "512MB";
export declare const DEFAULT_CPU_LIMIT = "0.5";
export declare const MAX_MEMORY_LIMIT = "4GB";
export declare const MAX_CPU_LIMIT = "2.0";
export declare const DEFAULT_PORT_RANGE: {
    start: number;
    end: number;
};
export declare const REDIS_KEYS: {
    ROUTES: string;
    ACTIVE_SPINLETS: string;
    SPINLET_PREFIX: string;
    PORTS_ALLOCATED: string;
    PORTS_POOL: string;
    METRICS_PREFIX: string;
    AUDIT_STREAM: string;
    CUSTOMER_PREFIX: string;
};
export declare const TELEMETRY: {
    METRICS_TTL: number;
    DAILY_METRICS_TTL: number;
    RESOURCE_METRICS_TTL: number;
};
export declare const SIGNALS: {
    GRACEFUL_SHUTDOWN: string;
    FORCE_SHUTDOWN: string;
    HEALTH_CHECK: string;
};
//# sourceMappingURL=constants.d.ts.map