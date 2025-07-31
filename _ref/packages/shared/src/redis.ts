import Redis from 'ioredis';
import { logger } from './logger';
import { getRedisConfig } from './config';

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | null;
}

export function createRedisClient(config: RedisConfig = {}): Redis {
  const redisConfig = getRedisConfig();
  
  const client = new Redis({
    host: config.host || redisConfig.host,
    port: config.port || redisConfig.port,
    password: config.password || redisConfig.password,
    db: config.db || redisConfig.db,
    keyPrefix: config.keyPrefix || redisConfig.keyPrefix,
    retryStrategy: config.retryStrategy || ((times: number) => {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis connection failed, retrying in ${delay}ms...`);
      return delay;
    }),
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
    showFriendlyErrorStack: true
  });

  client.on('connect', () => {
    logger.info('Connected to Redis');
  });

  client.on('error', (error) => {
    logger.error('Redis error:', error);
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return client;
}

// Helper functions for common operations
export class RedisHelper {
  constructor(private redis: Redis) {}

  async setJSON(key: string, value: any, ttl?: number): Promise<void> {
    const json = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, json);
    } else {
      await this.redis.set(key, json);
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Failed to parse JSON for key ${key}:`, error);
      return null;
    }
  }

  async addToStream(
    streamKey: string, 
    data: Record<string, string | number>
  ): Promise<string> {
    const fields: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(key, value.toString());
    }
    
    return await this.redis.xadd(streamKey, '*', ...fields) as string;
  }

  async readStream(
    streamKey: string, 
    count: number = 100,
    start: string = '-'
  ): Promise<Array<{ id: string; data: Record<string, string> }>> {
    const result = await this.redis.xrange(streamKey, start, '+', 'COUNT', count);
    
    return result.map(([id, fields]) => {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }
      return { id, data };
    });
  }

  async incrementMetric(
    key: string, 
    field: string, 
    increment: number = 1
  ): Promise<number> {
    return await this.redis.hincrby(key, field, increment);
  }

  async setMetric(
    key: string,
    metrics: Record<string, string | number>,
    ttl?: number
  ): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    const fields: string[] = [];
    for (const [field, value] of Object.entries(metrics)) {
      fields.push(field, value.toString());
    }
    
    pipeline.hset(key, ...fields);
    if (ttl) {
      pipeline.expire(key, ttl);
    }
    
    await pipeline.exec();
  }
}