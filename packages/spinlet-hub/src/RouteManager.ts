import Redis from 'ioredis';
import { createLogger, RedisHelper } from '@spinforge/shared';
import { RouteConfig } from './types';

export class RouteManager {
  private redis: Redis;
  private redisHelper: RedisHelper;
  private logger = createLogger('RouteManager');
  private routeCache: Map<string, RouteConfig> = new Map();
  private cacheTimeout = 60000; // 1 minute cache

  constructor(redis: Redis) {
    this.redis = redis;
    this.redisHelper = new RedisHelper(redis);
    this.startCacheInvalidation();
  }

  async getRoute(domain: string): Promise<RouteConfig | null> {
    // Check cache first
    const cached = this.routeCache.get(domain);
    if (cached) {
      return cached;
    }

    // Check Redis
    const routeData = await this.redisHelper.getJSON<RouteConfig>(`routes:${domain}`);
    if (routeData) {
      this.routeCache.set(domain, routeData);
      return routeData;
    }

    // Check for wildcard domains
    const wildcardDomain = await this.findWildcardMatch(domain);
    if (wildcardDomain) {
      const wildcardRoute = await this.redisHelper.getJSON<RouteConfig>(`routes:${wildcardDomain}`);
      if (wildcardRoute) {
        // Create a specific route for this subdomain
        const specificRoute = { ...wildcardRoute, domain };
        this.routeCache.set(domain, specificRoute);
        return specificRoute;
      }
    }

    return null;
  }

  async addRoute(route: RouteConfig): Promise<void> {
    // Store in Redis
    await this.redisHelper.setJSON(`routes:${route.domain}`, route);
    
    // Also store in hash for easy listing
    await this.redis.hset('spinforge:routes', route.domain, JSON.stringify(route));
    
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

  async removeRoute(domain: string): Promise<void> {
    const route = await this.getRoute(domain);
    if (!route) return;

    // Remove from Redis
    await this.redis.del(`routes:${domain}`);
    
    // Remove from hash
    await this.redis.hdel('spinforge:routes', domain);
    
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

  async updateRoute(domain: string, updates: Partial<RouteConfig>): Promise<void> {
    const existing = await this.getRoute(domain);
    if (!existing) {
      throw new Error(`Route not found for domain: ${domain}`);
    }

    const updated = { ...existing, ...updates };
    
    // Store in Redis
    await this.redisHelper.setJSON(`routes:${domain}`, updated);
    
    // Update in hash
    await this.redis.hset('spinforge:routes', domain, JSON.stringify(updated));
    
    // Update cache
    this.routeCache.set(domain, updated);
    
    this.logger.info('Route updated', { domain, updates });
  }

  async getCustomerDomains(customerId: string): Promise<string[]> {
    return await this.redis.smembers(`customer:${customerId}:domains`);
  }

  async getAllRoutes(): Promise<RouteConfig[]> {
    const keys = await this.redis.keys('routes:*');
    const routes: RouteConfig[] = [];

    for (const key of keys) {
      const route = await this.redisHelper.getJSON<RouteConfig>(key);
      if (route) {
        routes.push(route);
      }
    }

    return routes;
  }

  private async findWildcardMatch(domain: string): Promise<string | null> {
    // Check for wildcard domains (e.g., *.example.com)
    const parts = domain.split('.');
    if (parts.length < 2) return null;

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

  private startCacheInvalidation(): void {
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

  async validateRoute(domain: string): Promise<{ valid: boolean; reason?: string }> {
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

  private isValidDomain(domain: string): boolean {
    // Basic domain validation
    const domainRegex = /^(\*\.)?([a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.)*[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  destroy(): void {
    this.routeCache.clear();
  }
}