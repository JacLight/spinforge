"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteManager = void 0;
const shared_1 = require("@spinforge/shared");
class RouteManager {
    redis;
    redisHelper;
    logger = (0, shared_1.createLogger)('RouteManager');
    routeCache = new Map();
    cacheTimeout = 60000; // 1 minute cache
    constructor(redis) {
        this.redis = redis;
        this.redisHelper = new shared_1.RedisHelper(redis);
        this.startCacheInvalidation();
    }
    async getRoute(domain) {
        // Check cache first
        const cached = this.routeCache.get(domain);
        if (cached) {
            return cached;
        }
        // Check Redis
        const routeData = await this.redisHelper.getJSON(`routes:${domain}`);
        if (routeData) {
            this.routeCache.set(domain, routeData);
            return routeData;
        }
        // Check for wildcard domains
        const wildcardDomain = await this.findWildcardMatch(domain);
        if (wildcardDomain) {
            const wildcardRoute = await this.redisHelper.getJSON(`routes:${wildcardDomain}`);
            if (wildcardRoute) {
                // Create a specific route for this subdomain
                const specificRoute = { ...wildcardRoute, domain };
                this.routeCache.set(domain, specificRoute);
                return specificRoute;
            }
        }
        return null;
    }
    async addRoute(route) {
        // Store in Redis
        await this.redisHelper.setJSON(`routes:${route.domain}`, route);
        // Add to customer's domain set
        await this.redis.sadd(`customer:${route.customerId}:domains`, route.domain);
        // Update cache
        this.routeCache.set(route.domain, route);
        // Log audit event
        await this.redisHelper.addToStream('audit', {
            timestamp: Date.now(),
            event: 'domain_add',
            customerId: route.customerId,
            spinletId: route.spinletId,
            domain: route.domain
        });
        this.logger.info('Route added', { domain: route.domain, customerId: route.customerId });
    }
    async removeRoute(domain) {
        const route = await this.getRoute(domain);
        if (!route)
            return;
        // Remove from Redis
        await this.redis.del(`routes:${domain}`);
        // Remove from customer's domain set
        await this.redis.srem(`customer:${route.customerId}:domains`, domain);
        // Clear cache
        this.routeCache.delete(domain);
        // Log audit event
        await this.redisHelper.addToStream('audit', {
            timestamp: Date.now(),
            event: 'domain_remove',
            customerId: route.customerId,
            spinletId: route.spinletId,
            domain
        });
        this.logger.info('Route removed', { domain, customerId: route.customerId });
    }
    async updateRoute(domain, updates) {
        const existing = await this.getRoute(domain);
        if (!existing) {
            throw new Error(`Route not found for domain: ${domain}`);
        }
        const updated = { ...existing, ...updates };
        await this.addRoute(updated);
    }
    async getCustomerDomains(customerId) {
        return await this.redis.smembers(`customer:${customerId}:domains`);
    }
    async getAllRoutes() {
        const keys = await this.redis.keys('routes:*');
        const routes = [];
        for (const key of keys) {
            const route = await this.redisHelper.getJSON(key);
            if (route) {
                routes.push(route);
            }
        }
        return routes;
    }
    async findWildcardMatch(domain) {
        // Check for wildcard domains (e.g., *.example.com)
        const parts = domain.split('.');
        if (parts.length < 2)
            return null;
        // Try progressively broader wildcards
        for (let i = 0; i < parts.length - 1; i++) {
            const wildcardDomain = '*.' + parts.slice(i + 1).join('.');
            const exists = await this.redis.exists(`routes:${wildcardDomain}`);
            if (exists) {
                return wildcardDomain;
            }
        }
        return null;
    }
    startCacheInvalidation() {
        // Subscribe to route changes
        const subscriber = this.redis.duplicate();
        subscriber.subscribe('route:changed', 'route:removed');
        subscriber.on('message', (channel, message) => {
            if (channel === 'route:changed' || channel === 'route:removed') {
                // Clear specific cache entry
                this.routeCache.delete(message);
            }
        });
        // Also periodically clear old cache entries
        setInterval(() => {
            // In production, implement LRU cache or TTL-based eviction
            this.routeCache.clear();
        }, this.cacheTimeout);
    }
    async validateRoute(domain) {
        // Check if domain is valid
        if (!this.isValidDomain(domain)) {
            return { valid: false, reason: 'Invalid domain format' };
        }
        // Check if domain is already taken
        const existing = await this.getRoute(domain);
        if (existing) {
            return { valid: false, reason: 'Domain already in use' };
        }
        // Additional validation (DNS, SSL, etc.) would go here
        return { valid: true };
    }
    isValidDomain(domain) {
        // Basic domain validation
        const domainRegex = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}$/;
        return domainRegex.test(domain);
    }
    destroy() {
        this.routeCache.clear();
    }
}
exports.RouteManager = RouteManager;
//# sourceMappingURL=RouteManager.js.map