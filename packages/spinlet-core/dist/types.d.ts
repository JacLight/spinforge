export interface SpinletConfig {
    spinletId: string;
    customerId: string;
    buildPath: string;
    framework: 'nextjs' | 'remix' | 'express' | 'static';
    port?: number;
    env?: Record<string, string>;
    resources?: {
        memory?: string;
        cpu?: string;
    };
}
export interface SpinletState {
    spinletId: string;
    customerId: string;
    pid: number;
    port: number;
    state: 'starting' | 'running' | 'idle' | 'stopping' | 'stopped' | 'crashed';
    startTime: number;
    lastAccess: number;
    requests: number;
    errors: number;
    memory: number;
    cpu: number;
    host: string;
}
export interface SpinletMetrics {
    timestamp: number;
    requests: number;
    errors: number;
    latencyP50: number;
    latencyP95: number;
    latencyP99: number;
    bytesIn: number;
    bytesOut: number;
}
export interface ResourceUsage {
    cpu: number;
    memory: number;
    memoryPercent: number;
    elapsed: number;
    timestamp: number;
}
export interface SpinletEvents {
    'spinlet:started': {
        spinletId: string;
        port: number;
    };
    'spinlet:stopped': {
        spinletId: string;
        reason: string;
    };
    'spinlet:crashed': {
        spinletId: string;
        error: Error;
    };
    'spinlet:idle': {
        spinletId: string;
    };
    'spinlet:active': {
        spinletId: string;
    };
    'spinlet:error': {
        spinletId: string;
        error: Error;
    };
}
export interface PortRange {
    start: number;
    end: number;
}
//# sourceMappingURL=types.d.ts.map