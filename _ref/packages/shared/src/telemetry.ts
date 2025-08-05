import { RedisHelper } from './redis';
import { logger } from './logger';

export interface TelemetryEvent {
  spinletId: string;
  customerId: string;
  event: string;
  timestamp: number;
  data?: Record<string, any>;
}

export interface RequestMetrics {
  count: number;
  errors: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  bytesIn: number;
  bytesOut: number;
}

export class TelemetryCollector {
  private redisHelper: RedisHelper;
  private flushInterval: NodeJS.Timeout;
  private buffer: Map<string, RequestMetrics> = new Map();

  constructor(redisHelper: RedisHelper, flushIntervalMs: number = 60000) {
    this.redisHelper = redisHelper;
    
    // Flush metrics every minute
    this.flushInterval = setInterval(() => {
      this.flush().catch(err => 
        logger.error('Failed to flush telemetry:', err)
      );
    }, flushIntervalMs);
  }

  async recordRequest(
    spinletId: string,
    latency: number,
    bytesIn: number,
    bytesOut: number,
    error: boolean = false
  ): Promise<void> {
    const key = `${spinletId}:${Math.floor(Date.now() / 60000)}`;
    
    if (!this.buffer.has(key)) {
      this.buffer.set(key, {
        count: 0,
        errors: 0,
        latencyP50: 0,
        latencyP95: 0,
        latencyP99: 0,
        bytesIn: 0,
        bytesOut: 0
      });
    }

    const metrics = this.buffer.get(key)!;
    metrics.count++;
    if (error) metrics.errors++;
    metrics.bytesIn += bytesIn;
    metrics.bytesOut += bytesOut;
    
    // Simple latency tracking (in production, use a proper histogram)
    metrics.latencyP50 = Math.max(metrics.latencyP50, latency);
    metrics.latencyP95 = Math.max(metrics.latencyP95, latency);
    metrics.latencyP99 = Math.max(metrics.latencyP99, latency);
  }

  async recordEvent(event: TelemetryEvent): Promise<void> {
    await this.redisHelper.addToStream('audit', {
      timestamp: event.timestamp,
      event: event.event,
      spinletId: event.spinletId,
      customerId: event.customerId,
      data: JSON.stringify(event.data || {})
    });
  }

  async recordResourceUsage(
    spinletId: string,
    cpu: number,
    memory: number,
    connections: number = 0
  ): Promise<void> {
    const timestamp = Date.now();
    const key = `metrics:resources:${spinletId}:${timestamp}`;
    
    await this.redisHelper.setMetric(key, {
      cpu_percent: cpu,
      memory_bytes: memory,
      memory_percent: (memory / (1024 * 1024 * 1024)) * 100,
      open_connections: connections,
      timestamp
    }, 7 * 24 * 60 * 60); // 7 days TTL
  }

  async flush(): Promise<void> {
    if (this.buffer.size === 0) return;

    const entries = Array.from(this.buffer.entries());
    this.buffer.clear();

    for (const [key, metrics] of entries) {
      const [spinletId, minuteTimestamp] = key.split(':');
      const redisKey = `metrics:requests:${spinletId}:${minuteTimestamp}`;
      
      await this.redisHelper.setMetric(redisKey, metrics as unknown as Record<string, string | number>, 3600); // 1 hour TTL
      
      // Update daily aggregates
      const date = new Date(parseInt(minuteTimestamp) * 60000)
        .toISOString()
        .split('T')[0]
        .replace(/-/g, '');
      
      const dailyKey = `metrics:daily:${spinletId}:${date}`;
      await this.redisHelper.incrementMetric(dailyKey, 'requests', metrics.count);
      await this.redisHelper.incrementMetric(dailyKey, 'errors', metrics.errors);
      await this.redisHelper.incrementMetric(dailyKey, 'bytes_in', metrics.bytesIn);
      await this.redisHelper.incrementMetric(dailyKey, 'bytes_out', metrics.bytesOut);
    }
  }

  async getRequestMetrics(
    spinletId: string,
    startTime: number,
    endTime: number
  ): Promise<RequestMetrics[]> {
    const results: RequestMetrics[] = [];
    const startMinute = Math.floor(startTime / 60000);
    const endMinute = Math.floor(endTime / 60000);
    
    for (let minute = startMinute; minute <= endMinute; minute++) {
      const key = `metrics:requests:${spinletId}:${minute}`;
      const data = await this.redisHelper.getJSON<Record<string, string>>(key) || {};
      
      if (Object.keys(data).length > 0) {
        results.push({
          count: parseInt(data.count || '0'),
          errors: parseInt(data.errors || '0'),
          latencyP50: parseInt(data.latencyP50 || '0'),
          latencyP95: parseInt(data.latencyP95 || '0'),
          latencyP99: parseInt(data.latencyP99 || '0'),
          bytesIn: parseInt(data.bytesIn || '0'),
          bytesOut: parseInt(data.bytesOut || '0')
        });
      }
    }
    
    return results;
  }

  destroy(): void {
    clearInterval(this.flushInterval);
    this.flush().catch(err => 
      logger.error('Failed to flush telemetry on destroy:', err)
    );
  }
}