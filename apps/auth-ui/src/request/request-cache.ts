interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
}

export class RequestCache {
  private static instance: RequestCache;
  private cache: Map<string, CacheItem>;
  private readonly DEFAULT_TTL = 60000; // 1 minute
  private readonly MAX_CACHE_SIZE = 100;

  private constructor() {
    this.cache = new Map();
    // Start cleanup interval
    this.startCleanupInterval();
  }

  static getInstance(): RequestCache {
    if (!RequestCache.instance) {
      RequestCache.instance = new RequestCache();
    }
    return RequestCache.instance;
  }

  set(key: string, data: any, ttl?: number | string): void {
    // Handle different TTL formats
    let ttlMs: number = this.DEFAULT_TTL;
    
    if (typeof ttl === 'number') {
      ttlMs = ttl;
    } else if (typeof ttl === 'string') {
      switch (ttl) {
        case 'short':
          ttlMs = 10000; // 10 seconds
          break;
        case 'long':
          ttlMs = 300000; // 5 minutes
          break;
        case 'forever':
          ttlMs = Infinity;
          break;
        default:
          ttlMs = this.DEFAULT_TTL;
      }
    }

    // Implement LRU-like behavior
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  get(key: string): any {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if item has expired
    if (item.ttl !== Infinity && Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    // Check expiration
    if (item.ttl !== Infinity && Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  size(): number {
    return this.cache.size;
  }

  // Cleanup expired items periodically
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.cache.forEach((item, key) => {
        if (item.ttl !== Infinity && now - item.timestamp > item.ttl) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => this.cache.delete(key));
    }, 60000); // Run cleanup every minute
  }

  // Get cache statistics
  getStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0, // Would need to track this
      misses: 0, // Would need to track this
    };
  }

  // Clear items by pattern
  clearByPattern(pattern: string | RegExp): number {
    let cleared = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        this.cache.delete(key);
        cleared++;
      }
    });

    return cleared;
  }
}