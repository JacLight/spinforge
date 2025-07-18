import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { SpinletConfig, SpinletState } from './types';
export declare class SpinletManager extends EventEmitter {
    private spinlets;
    private states;
    private monitors;
    private redis;
    private portAllocator;
    private idleCheckInterval?;
    private metricsInterval?;
    constructor(redis: Redis, portRange?: {
        start: number;
        end: number;
    });
    spawn(config: SpinletConfig): Promise<SpinletState>;
    stop(spinletId: string, reason?: string): Promise<void>;
    stopAll(): Promise<void>;
    private cleanup;
    private setupProcessHandlers;
    private waitForReady;
    private getExecArgv;
    private parseMemory;
    private startIdleChecker;
    private startMetricsCollector;
    getState(spinletId: string): Promise<SpinletState | null>;
    private persistState;
    updateLastAccess(spinletId: string): Promise<void>;
    incrementRequests(spinletId: string, errors?: number): Promise<void>;
    destroy(): void;
}
//# sourceMappingURL=SpinletManager.d.ts.map