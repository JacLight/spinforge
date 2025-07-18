"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisHelper = void 0;
exports.createRedisClient = createRedisClient;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
function createRedisClient(config = {}) {
    const client = new ioredis_1.default({
        host: config.host || process.env.REDIS_HOST || 'localhost',
        port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
        password: config.password || process.env.REDIS_PASSWORD,
        db: config.db || parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: config.keyPrefix || 'spinforge:',
        retryStrategy: config.retryStrategy || ((times) => {
            const delay = Math.min(times * 50, 2000);
            logger_1.logger.warn(`Redis connection failed, retrying in ${delay}ms...`);
            return delay;
        }),
        enableOfflineQueue: true,
        maxRetriesPerRequest: 3,
        showFriendlyErrorStack: true
    });
    client.on('connect', () => {
        logger_1.logger.info('Connected to Redis');
    });
    client.on('error', (error) => {
        logger_1.logger.error('Redis error:', error);
    });
    client.on('close', () => {
        logger_1.logger.warn('Redis connection closed');
    });
    return client;
}
// Helper functions for common operations
class RedisHelper {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async setJSON(key, value, ttl) {
        const json = JSON.stringify(value);
        if (ttl) {
            await this.redis.setex(key, ttl, json);
        }
        else {
            await this.redis.set(key, json);
        }
    }
    async getJSON(key) {
        const value = await this.redis.get(key);
        if (!value)
            return null;
        try {
            return JSON.parse(value);
        }
        catch (error) {
            logger_1.logger.error(`Failed to parse JSON for key ${key}:`, error);
            return null;
        }
    }
    async addToStream(streamKey, data) {
        const fields = [];
        for (const [key, value] of Object.entries(data)) {
            fields.push(key, value.toString());
        }
        return await this.redis.xadd(streamKey, '*', ...fields);
    }
    async readStream(streamKey, count = 100, start = '-') {
        const result = await this.redis.xrange(streamKey, start, '+', 'COUNT', count);
        return result.map(([id, fields]) => {
            const data = {};
            for (let i = 0; i < fields.length; i += 2) {
                data[fields[i]] = fields[i + 1];
            }
            return { id, data };
        });
    }
    async incrementMetric(key, field, increment = 1) {
        return await this.redis.hincrby(key, field, increment);
    }
    async setMetric(key, metrics, ttl) {
        const pipeline = this.redis.pipeline();
        const fields = [];
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
exports.RedisHelper = RedisHelper;
//# sourceMappingURL=redis.js.map