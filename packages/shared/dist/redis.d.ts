import Redis from 'ioredis';
export interface RedisConfig {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    retryStrategy?: (times: number) => number | null;
}
export declare function createRedisClient(config?: RedisConfig): Redis;
export declare class RedisHelper {
    private redis;
    constructor(redis: Redis);
    setJSON(key: string, value: any, ttl?: number): Promise<void>;
    getJSON<T>(key: string): Promise<T | null>;
    addToStream(streamKey: string, data: Record<string, string | number>): Promise<string>;
    readStream(streamKey: string, count?: number, start?: string): Promise<Array<{
        id: string;
        data: Record<string, string>;
    }>>;
    incrementMetric(key: string, field: string, increment?: number): Promise<number>;
    setMetric(key: string, metrics: Record<string, string | number>, ttl?: number): Promise<void>;
}
//# sourceMappingURL=redis.d.ts.map