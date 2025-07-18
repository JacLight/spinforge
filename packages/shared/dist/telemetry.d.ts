import { RedisHelper } from './redis';
export interface TelemetryEvent {
    spinletId: string;
    customerId: string;
    event: string;
    timestamp: number;
    data?: Record<string, any>;
}
export interface RequestMetrics {
    count: number;
    errors: number;
    latencyP50: number;
    latencyP95: number;
    latencyP99: number;
    bytesIn: number;
    bytesOut: number;
}
export declare class TelemetryCollector {
    private redisHelper;
    private flushInterval;
    private buffer;
    constructor(redisHelper: RedisHelper, flushIntervalMs?: number);
    recordRequest(spinletId: string, latency: number, bytesIn: number, bytesOut: number, error?: boolean): Promise<void>;
    recordEvent(event: TelemetryEvent): Promise<void>;
    recordResourceUsage(spinletId: string, cpu: number, memory: number, connections?: number): Promise<void>;
    flush(): Promise<void>;
    getRequestMetrics(spinletId: string, startTime: number, endTime: number): Promise<RequestMetrics[]>;
    destroy(): void;
}
//# sourceMappingURL=telemetry.d.ts.map