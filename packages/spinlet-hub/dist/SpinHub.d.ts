import { HubConfig } from './types';
export declare class SpinHub {
    private app;
    private server;
    private config;
    private redis;
    private redisHelper;
    private spinletManager;
    private routeManager;
    private proxyHandler;
    private telemetry;
    private logger;
    constructor(config?: Partial<HubConfig>);
    private buildConfig;
    private setupMiddleware;
    private setupRoutes;
    private setupAdminRoutes;
    private createServer;
    private setupWebSocketHandling;
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=SpinHub.d.ts.map