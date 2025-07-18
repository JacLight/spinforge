import Redis from 'ioredis';
import { RouteConfig } from './types';
export declare class RouteManager {
    private redis;
    private redisHelper;
    private logger;
    private routeCache;
    private cacheTimeout;
    constructor(redis: Redis);
    getRoute(domain: string): Promise<RouteConfig | null>;
    addRoute(route: RouteConfig): Promise<void>;
    removeRoute(domain: string): Promise<void>;
    updateRoute(domain: string, updates: Partial<RouteConfig>): Promise<void>;
    getCustomerDomains(customerId: string): Promise<string[]>;
    getAllRoutes(): Promise<RouteConfig[]>;
    private findWildcardMatch;
    private startCacheInvalidation;
    validateRoute(domain: string): Promise<{
        valid: boolean;
        reason?: string;
    }>;
    private isValidDomain;
    destroy(): void;
}
//# sourceMappingURL=RouteManager.d.ts.map