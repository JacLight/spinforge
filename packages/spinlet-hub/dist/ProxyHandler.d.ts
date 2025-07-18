import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { SpinletManager } from '@spinforge/spinlet-core';
import { TelemetryCollector } from '@spinforge/shared';
import { RouteManager } from './RouteManager';
import { ProxyOptions } from './types';
export declare class ProxyHandler {
    private proxy;
    private spinletManager;
    private routeManager;
    private telemetry;
    private logger;
    private activeRequests;
    private readonly defaultOptions;
    constructor(spinletManager: SpinletManager, routeManager: RouteManager, telemetry: TelemetryCollector, options?: Partial<ProxyOptions>);
    handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;
    handleWebSocket(req: IncomingMessage, socket: Socket, head: Buffer): Promise<void>;
    private setupProxyHandlers;
    private ensureSpinletRunning;
    private extractDomain;
    private getClientIp;
    private addProxyHeaders;
    private recordMetrics;
    destroy(): void;
}
//# sourceMappingURL=ProxyHandler.d.ts.map