import Redis from 'ioredis';
import { PortRange } from './types';

export class PortAllocator {
  private redis: Redis;
  private portRange: PortRange;
  private localAllocated: Set<number> = new Set();

  constructor(redis: Redis, portRange?: PortRange) {
    this.redis = redis;
    this.portRange = portRange || { start: 3000, end: 4000 };
  }

  async initialize(): Promise<void> {
    // Initialize the port pool if empty
    const poolSize = await this.redis.llen('spinforge:ports:pool');
    
    if (poolSize === 0) {
      const ports = [];
      for (let port = this.portRange.start; port <= this.portRange.end; port++) {
        ports.push(port.toString());
      }
      
      // Add all ports to the pool in batches
      const batchSize = 100;
      for (let i = 0; i < ports.length; i += batchSize) {
        const batch = ports.slice(i, i + batchSize);
        await this.redis.rpush('spinforge:ports:pool', ...batch);
      }
    }
  }

  async allocate(spinletId: string): Promise<number> {
    // Try to get a port from the pool
    const portStr = await this.redis.lpop('spinforge:ports:pool');
    
    if (!portStr) {
      // No ports available, try to find a released one
      const allocated = await this.redis.hkeys('spinforge:ports:allocated');
      const allocatedSet = new Set(allocated.map(p => parseInt(p)));
      
      for (let port = this.portRange.start; port <= this.portRange.end; port++) {
        if (!allocatedSet.has(port) && !this.localAllocated.has(port)) {
          await this.redis.hset('spinforge:ports:allocated', port.toString(), spinletId);
          this.localAllocated.add(port);
          return port;
        }
      }
      
      throw new Error('No available ports in the configured range');
    }

    const port = parseInt(portStr);
    
    // Mark as allocated
    await this.redis.hset('spinforge:ports:allocated', port.toString(), spinletId);
    this.localAllocated.add(port);
    
    return port;
  }

  async release(port: number): Promise<void> {
    // Remove from allocated
    await this.redis.hdel('spinforge:ports:allocated', port.toString());
    this.localAllocated.delete(port);
    
    // Return to pool
    await this.redis.rpush('spinforge:ports:pool', port.toString());
  }

  async isAllocated(port: number): Promise<boolean> {
    const spinletId = await this.redis.hget('spinforge:ports:allocated', port.toString());
    return spinletId !== null;
  }

  async getAllocatedPorts(): Promise<Map<number, string>> {
    const allocated = await this.redis.hgetall('spinforge:ports:allocated');
    const result = new Map<number, string>();
    
    for (const [port, spinletId] of Object.entries(allocated)) {
      result.set(parseInt(port), spinletId);
    }
    
    return result;
  }

  async cleanup(): Promise<void> {
    // Release all locally allocated ports
    for (const port of this.localAllocated) {
      await this.release(port);
    }
  }
}