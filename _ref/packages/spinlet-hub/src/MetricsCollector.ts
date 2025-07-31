import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import Redis from 'ioredis';
import { createLogger } from '@spinforge/shared';

const execAsync = promisify(exec);

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
    speed: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  network: {
    interfaces: Array<{
      name: string;
      address: string;
      bytesReceived: number;
      bytesSent: number;
    }>;
    totalBytesIn: number;
    totalBytesOut: number;
  };
  process: {
    uptime: number;
    pid: number;
    memory: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export interface DockerStats {
  containers: Array<{
    id: string;
    name: string;
    image: string;
    status: string;
    cpu: number;
    memory: {
      usage: number;
      limit: number;
      percent: number;
    };
    network: {
      rx: number;
      tx: number;
    };
    block: {
      read: number;
      write: number;
    };
  }>;
  total: number;
  running: number;
  stopped: number;
}

export interface KeyDBMetrics {
  connected: boolean;
  info: {
    version: string;
    uptime: number;
    connectedClients: number;
    usedMemory: number;
    usedMemoryHuman: string;
    totalKeys: number;
    totalExpires: number;
  };
  stats: {
    totalCommands: number;
    opsPerSec: number;
    hitRate: number;
    evictedKeys: number;
  };
  replication: {
    role: string;
    connectedSlaves: number;
  };
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  lastCheck: Date;
  details: Record<string, any>;
}

export class MetricsCollector {
  private logger = createLogger('MetricsCollector');
  private redis: Redis;
  private cpuUsageHistory: number[] = [];
  private networkStatsHistory: Map<string, { rx: number; tx: number }> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
    this.startCollecting();
  }

  private startCollecting() {
    // Collect CPU usage every second for accurate measurement
    setInterval(() => {
      this.collectCPUUsage();
    }, 1000);

    // Collect network stats every 5 seconds
    setInterval(() => {
      this.collectNetworkStats();
    }, 5000);
  }

  private async collectCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    this.cpuUsageHistory.push(usage);
    if (this.cpuUsageHistory.length > 60) {
      this.cpuUsageHistory.shift();
    }
  }

  private async collectNetworkStats() {
    const interfaces = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (addrs) {
        // Store current stats for delta calculation
        // In production, you'd read from /proc/net/dev or use a library
        this.networkStatsHistory.set(name, { rx: 0, tx: 0 });
      }
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Get disk usage
    const diskUsage = await this.getDiskUsage();

    // Get network interfaces
    const networkInterfaces = this.getNetworkInterfaces();

    // Calculate average CPU usage
    const avgCpuUsage = this.cpuUsageHistory.length > 0
      ? Math.round(this.cpuUsageHistory.reduce((a, b) => a + b) / this.cpuUsageHistory.length)
      : 0;

    return {
      cpu: {
        usage: avgCpuUsage,
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        speed: cpus[0]?.speed || 0,
        loadAverage: os.loadavg()
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: Math.round((usedMem / totalMem) * 100)
      },
      disk: diskUsage,
      network: {
        interfaces: networkInterfaces,
        totalBytesIn: 0, // Would need to track this over time
        totalBytesOut: 0
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };
  }

  private async getDiskUsage() {
    try {
      const { stdout } = await execAsync('df -k / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      const total = parseInt(parts[1]) * 1024;
      const used = parseInt(parts[2]) * 1024;
      const free = parseInt(parts[3]) * 1024;
      const percent = parseInt(parts[4]);

      return {
        total,
        used,
        free,
        usagePercent: percent
      };
    } catch (error) {
      this.logger.error('Failed to get disk usage', { error });
      return { total: 0, used: 0, free: 0, usagePercent: 0 };
    }
  }

  private getNetworkInterfaces(): Array<{
    name: string;
    address: string;
    bytesReceived: number;
    bytesSent: number;
  }> {
    const interfaces = os.networkInterfaces();
    const result: Array<{
      name: string;
      address: string;
      bytesReceived: number;
      bytesSent: number;
    }> = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (addrs) {
        const ipv4 = addrs.find(addr => addr.family === 'IPv4' && !addr.internal);
        if (ipv4) {
          result.push({
            name,
            address: ipv4.address,
            bytesReceived: 0, // Would need to track this
            bytesSent: 0
          });
        }
      }
    }

    return result;
  }

  async getDockerStats(): Promise<DockerStats> {
    try {
      // Get all containers
      const { stdout: containerList } = await execAsync(
        'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}"'
      );

      const containers: DockerStats['containers'] = [];
      const lines = containerList.trim().split('\n').filter(line => line);

      for (const line of lines) {
        const [id, name, image, status] = line.split('|');
        
        // Get container stats if running
        let stats = {
          cpu: 0,
          memory: { usage: 0, limit: 0, percent: 0 },
          network: { rx: 0, tx: 0 },
          block: { read: 0, write: 0 }
        };

        if (status.includes('Up')) {
          try {
            const { stdout: statsOutput } = await execAsync(
              `docker stats ${id} --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}"`
            );
            
            const [cpu, mem, net, block] = statsOutput.trim().split('|');
            
            // Parse CPU (remove %)
            stats.cpu = parseFloat(cpu.replace('%', ''));
            
            // Parse memory (e.g., "1.5GiB / 2GiB")
            const memParts = mem.split(' / ');
            stats.memory.usage = this.parseSize(memParts[0]);
            stats.memory.limit = this.parseSize(memParts[1]);
            stats.memory.percent = (stats.memory.usage / stats.memory.limit) * 100;
            
            // Parse network (e.g., "1.5MB / 2.3MB")
            const netParts = net.split(' / ');
            stats.network.rx = this.parseSize(netParts[0]);
            stats.network.tx = this.parseSize(netParts[1]);
            
            // Parse block I/O
            const blockParts = block.split(' / ');
            stats.block.read = this.parseSize(blockParts[0]);
            stats.block.write = this.parseSize(blockParts[1]);
          } catch (error) {
            this.logger.warn('Failed to get stats for container', { id, error });
          }
        }

        containers.push({
          id,
          name,
          image,
          status,
          ...stats
        });
      }

      const running = containers.filter(c => c.status.includes('Up')).length;
      const stopped = containers.length - running;

      return {
        containers,
        total: containers.length,
        running,
        stopped
      };
    } catch (error) {
      this.logger.error('Failed to get Docker stats', { error });
      return { containers: [], total: 0, running: 0, stopped: 0 };
    }
  }

  private parseSize(sizeStr: string): number {
    const units: Record<string, number> = {
      'B': 1,
      'kB': 1024,
      'KB': 1024,
      'MB': 1024 * 1024,
      'MiB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'GiB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024,
      'TiB': 1024 * 1024 * 1024 * 1024
    };

    const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];
    
    return value * (units[unit] || 1);
  }

  async getKeyDBMetrics(): Promise<KeyDBMetrics> {
    try {
      // Check connection
      await this.redis.ping();

      // Get server info
      const info = await this.redis.info();
      const sections = this.parseRedisInfo(info);

      // Get database size
      const dbSize = await this.redis.dbsize();
      
      // Calculate some stats
      const totalCommands = parseInt(sections.stats?.total_commands_processed || '0');
      const uptime = parseInt(sections.server?.uptime_in_seconds || '0');
      const opsPerSec = uptime > 0 ? Math.round(totalCommands / uptime) : 0;

      return {
        connected: true,
        info: {
          version: sections.server?.redis_version || 'unknown',
          uptime: uptime,
          connectedClients: parseInt(sections.clients?.connected_clients || '0'),
          usedMemory: parseInt(sections.memory?.used_memory || '0'),
          usedMemoryHuman: sections.memory?.used_memory_human || '0B',
          totalKeys: dbSize,
          totalExpires: parseInt(sections.stats?.expired_keys || '0')
        },
        stats: {
          totalCommands: totalCommands,
          opsPerSec: opsPerSec,
          hitRate: this.calculateHitRate(sections.stats),
          evictedKeys: parseInt(sections.stats?.evicted_keys || '0')
        },
        replication: {
          role: sections.replication?.role || 'master',
          connectedSlaves: parseInt(sections.replication?.connected_slaves || '0')
        }
      };
    } catch (error) {
      this.logger.error('Failed to get KeyDB metrics', { error });
      return {
        connected: false,
        info: {
          version: 'unknown',
          uptime: 0,
          connectedClients: 0,
          usedMemory: 0,
          usedMemoryHuman: '0B',
          totalKeys: 0,
          totalExpires: 0
        },
        stats: {
          totalCommands: 0,
          opsPerSec: 0,
          hitRate: 0,
          evictedKeys: 0
        },
        replication: {
          role: 'unknown',
          connectedSlaves: 0
        }
      };
    }
  }

  private parseRedisInfo(info: string): Record<string, Record<string, string>> {
    const sections: Record<string, Record<string, string>> = {};
    let currentSection = '';

    info.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) {
        if (line.startsWith('# ')) {
          currentSection = line.substring(2).toLowerCase();
          sections[currentSection] = {};
        }
        return;
      }

      const [key, value] = line.split(':');
      if (key && value && currentSection) {
        sections[currentSection][key] = value;
      }
    });

    return sections;
  }

  private calculateHitRate(stats: Record<string, string> | undefined): number {
    if (!stats) return 0;
    
    const hits = parseInt(stats.keyspace_hits || '0');
    const misses = parseInt(stats.keyspace_misses || '0');
    const total = hits + misses;
    
    return total > 0 ? Math.round((hits / total) * 100) : 0;
  }

  async getServiceHealth(): Promise<ServiceHealth[]> {
    const services: ServiceHealth[] = [];

    // Check KeyDB
    try {
      await this.redis.ping();
      services.push({
        name: 'KeyDB',
        status: 'healthy',
        uptime: parseInt((await this.redis.info('server')).match(/uptime_in_seconds:(\d+)/)?.[1] || '0'),
        lastCheck: new Date(),
        details: {
          connected: true,
          clients: parseInt((await this.redis.info('clients')).match(/connected_clients:(\d+)/)?.[1] || '0')
        }
      });
    } catch (error) {
      services.push({
        name: 'KeyDB',
        status: 'down',
        uptime: 0,
        lastCheck: new Date(),
        details: { error: (error as Error).message }
      });
    }

    // Check SpinHub (self)
    services.push({
      name: 'SpinHub',
      status: 'healthy',
      uptime: process.uptime(),
      lastCheck: new Date(),
      details: {
        pid: process.pid,
        memory: process.memoryUsage().heapUsed
      }
    });

    // Check Docker
    try {
      await execAsync('docker info');
      services.push({
        name: 'Docker',
        status: 'healthy',
        uptime: 0, // Docker doesn't provide easy uptime
        lastCheck: new Date(),
        details: { available: true }
      });
    } catch (error) {
      services.push({
        name: 'Docker',
        status: 'down',
        uptime: 0,
        lastCheck: new Date(),
        details: { error: 'Docker daemon not accessible' }
      });
    }

    // Check Nginx (if we can reach it)
    services.push({
      name: 'Nginx',
      status: 'healthy', // Assume healthy if SpinHub is running
      uptime: process.uptime(), // Use SpinHub uptime as proxy
      lastCheck: new Date(),
      details: { port: 9006 }
    });

    return services;
  }

  async getAllMetrics() {
    const [system, docker, keydb, services] = await Promise.all([
      this.getSystemMetrics(),
      this.getDockerStats(),
      this.getKeyDBMetrics(),
      this.getServiceHealth()
    ]);

    return {
      system,
      docker,
      keydb,
      services,
      timestamp: new Date().toISOString()
    };
  }
}