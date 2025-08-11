/**
 * SpinForge - SSL Certificate Cache Service
 * High-performance certificate management for 100s of certs/min
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SSLCacheService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.certsPath = process.env.CERTS_PATH || '/data/certs';
  }

  /**
   * Load certificate into Redis cache
   */
  async cacheCertificate(domain) {
    try {
      const certPath = path.join(this.certsPath, 'live', domain, 'fullchain.pem');
      const keyPath = path.join(this.certsPath, 'live', domain, 'privkey.pem');
      
      // Read certificate files
      const [certData, keyData] = await Promise.all([
        fs.readFile(certPath, 'utf8'),
        fs.readFile(keyPath, 'utf8')
      ]);
      
      // Cache in Redis with 1 hour TTL
      const certCacheKey = `ssl:cert:${domain}`;
      const keyCacheKey = `ssl:key:${domain}`;
      
      await Promise.all([
        this.redis.setEx(certCacheKey, 3600, certData),
        this.redis.setEx(keyCacheKey, 3600, keyData)
      ]);
      
      // Also store metadata
      const metaKey = `ssl:meta:${domain}`;
      const metadata = {
        domain,
        cached_at: new Date().toISOString(),
        cert_hash: crypto.createHash('sha256').update(certData).digest('hex'),
        expires_in: 3600
      };
      
      await this.redis.setEx(metaKey, 3600, JSON.stringify(metadata));
      
      console.log(`SSL certificate cached for ${domain}`);
      return { success: true, domain };
    } catch (error) {
      console.error(`Failed to cache certificate for ${domain}:`, error.message);
      return { success: false, domain, error: error.message };
    }
  }

  /**
   * Pre-cache all certificates on startup
   */
  async cacheAllCertificates() {
    try {
      // Get all sites with SSL enabled
      const siteKeys = await this.redis.keys('site:*');
      const results = [];
      
      for (const siteKey of siteKeys) {
        const siteData = await this.redis.get(siteKey);
        if (!siteData) continue;
        
        const site = JSON.parse(siteData);
        if (site.ssl_enabled) {
          const result = await this.cacheCertificate(site.domain);
          results.push(result);
        }
      }
      
      console.log(`Pre-cached ${results.filter(r => r.success).length} SSL certificates`);
      return results;
    } catch (error) {
      console.error('Error caching certificates:', error);
      throw error;
    }
  }

  /**
   * Refresh certificate cache
   */
  async refreshCertificate(domain) {
    return this.cacheCertificate(domain);
  }

  /**
   * Remove certificate from cache
   */
  async evictCertificate(domain) {
    try {
      await Promise.all([
        this.redis.del(`ssl:cert:${domain}`),
        this.redis.del(`ssl:key:${domain}`),
        this.redis.del(`ssl:meta:${domain}`)
      ]);
      
      console.log(`SSL certificate evicted from cache for ${domain}`);
      return { success: true, domain };
    } catch (error) {
      console.error(`Failed to evict certificate for ${domain}:`, error.message);
      return { success: false, domain, error: error.message };
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const metaKeys = await this.redis.keys('ssl:meta:*');
      const stats = {
        cached_certificates: metaKeys.length,
        domains: [],
        cache_memory: 0
      };
      
      for (const metaKey of metaKeys) {
        const metaData = await this.redis.get(metaKey);
        if (metaData) {
          const meta = JSON.parse(metaData);
          stats.domains.push({
            domain: meta.domain,
            cached_at: meta.cached_at,
            cert_hash: meta.cert_hash
          });
          
          // Estimate memory usage
          const certSize = await this.redis.strlen(`ssl:cert:${meta.domain}`);
          const keySize = await this.redis.strlen(`ssl:key:${meta.domain}`);
          stats.cache_memory += certSize + keySize;
        }
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      throw error;
    }
  }

  /**
   * Monitor certificate files for changes and update cache
   */
  async watchCertificates() {
    // This could use fs.watch or inotify to monitor certificate changes
    // For now, just refresh cache periodically
    setInterval(async () => {
      try {
        await this.cacheAllCertificates();
      } catch (error) {
        console.error('Error refreshing certificate cache:', error);
      }
    }, 300000); // Every 5 minutes
  }
}

module.exports = SSLCacheService;