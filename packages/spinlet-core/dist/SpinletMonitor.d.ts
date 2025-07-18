import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
export declare class SpinletMonitor extends EventEmitter {
    private spinletId;
    private process;
    private healthCheckInterval?;
    private isHealthy;
    private consecutiveFailures;
    constructor(spinletId: string, process: ChildProcess);
    private startHealthCheck;
    stop(): void;
    isProcessHealthy(): boolean;
    getMetrics(): {
        healthy: boolean;
        failures: number;
    };
}
//# sourceMappingURL=SpinletMonitor.d.ts.map