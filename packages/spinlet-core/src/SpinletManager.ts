import { ChildProcess, fork } from 'child_process';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import pidusage from 'pidusage';
import { SpinletConfig, SpinletState } from './types';
import { PortAllocator } from './PortAllocator';
import { SpinletMonitor } from './SpinletMonitor';
import { IDLE_TIMEOUT_MS } from './constants';
import { createLogger } from '@spinforge/shared';

export class SpinletManager extends EventEmitter {
  private spinlets: Map<string, ChildProcess> = new Map();
  private states: Map<string, SpinletState> = new Map();
  private monitors: Map<string, SpinletMonitor> = new Map();
  private redis: Redis;
  private portAllocator: PortAllocator;
  private idleCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private logger = createLogger('SpinletManager');

  constructor(redis: Redis, portRange?: { start: number; end: number }) {
    super();
    this.redis = redis;
    this.portAllocator = new PortAllocator(redis, portRange);
    this.startIdleChecker();
    this.startMetricsCollector();
  }

  async spawn(config: SpinletConfig): Promise<SpinletState> {
    const existingState = await this.getState(config.spinletId);
    if (existingState && existingState.state === 'running') {
      await this.updateLastAccess(config.spinletId);
      return existingState;
    }

    const port = config.port || await this.portAllocator.allocate(config.spinletId);
    
    const env = {
      PORT: port.toString(),
      SPINLET_ID: config.spinletId,
      CUSTOMER_ID: config.customerId,
      NODE_ENV: 'production',
      ...config.env
    };

    const child = fork(config.buildPath, [], {
      cwd: config.buildPath.substring(0, config.buildPath.lastIndexOf('/')),
      env,
      silent: true, // Capture stdout/stderr
      execArgv: this.getExecArgv(config)
    });

    const state: SpinletState = {
      spinletId: config.spinletId,
      customerId: config.customerId,
      pid: child.pid!,
      port,
      state: 'starting',
      startTime: Date.now(),
      lastAccess: Date.now(),
      requests: 0,
      errors: 0,
      memory: 0,
      cpu: 0,
      host: process.env.HOSTNAME || 'localhost',
      servicePath: `localhost:${port}`,
      domains: []
    };

    this.spinlets.set(config.spinletId, child);
    this.states.set(config.spinletId, state);
    
    // Setup monitoring
    const monitor = new SpinletMonitor(config.spinletId, child);
    this.monitors.set(config.spinletId, monitor);
    
    // Handle process events
    this.setupProcessHandlers(config.spinletId, child);
    
    // Wait for process to be ready
    await this.waitForReady(config.spinletId, port);
    
    // Update state in Redis
    await this.persistState(state);
    
    this.emit('spinlet:started', { spinletId: config.spinletId, port });
    
    return state;
  }

  async stop(spinletId: string, reason: string = 'manual'): Promise<void> {
    const child = this.spinlets.get(spinletId);
    const state = this.states.get(spinletId);
    
    if (!child || !state) {
      return;
    }

    state.state = 'stopping';
    await this.persistState(state);

    // Graceful shutdown
    child.send({ type: 'shutdown' });
    
    // Give it 5 seconds to shut down gracefully
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 5000);

      child.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    await this.cleanup(spinletId, reason);
  }

  async stopAll(): Promise<void> {
    const promises = Array.from(this.spinlets.keys()).map(id => 
      this.stop(id, 'shutdown')
    );
    await Promise.all(promises);
  }

  async updateDomains(spinletId: string, domains: string[]): Promise<void> {
    const state = this.states.get(spinletId);
    if (!state) {
      throw new Error(`Spinlet ${spinletId} not found`);
    }

    // Remove old domain mappings
    for (const oldDomain of state.domains) {
      await this.redis.del(`spinforge:domain:${oldDomain}`);
    }

    // Update state with new domains
    state.domains = domains;
    
    // Create new domain mappings
    for (const domain of domains) {
      await this.redis.set(`spinforge:domain:${domain}`, spinletId);
    }

    await this.persistState(state);
  }

  async findByServicePath(servicePath: string): Promise<string | null> {
    return await this.redis.get(`spinforge:servicepath:${servicePath}`);
  }

  async findByDomain(domain: string): Promise<string | null> {
    return await this.redis.get(`spinforge:domain:${domain}`);
  }

  async getStateByServicePathOrDomain(pathOrDomain: string): Promise<SpinletState | null> {
    let spinletId: string | null = null;

    // Check if it's a servicePath (contains port)
    if (pathOrDomain.includes(':')) {
      spinletId = await this.findByServicePath(pathOrDomain);
    } else {
      // Assume it's a domain
      spinletId = await this.findByDomain(pathOrDomain);
    }

    if (!spinletId) {
      return null;
    }

    return await this.getState(spinletId);
  }

  private async cleanup(spinletId: string, reason: string): Promise<void> {
    const state = this.states.get(spinletId);
    if (state) {
      await this.portAllocator.release(state.port);
      
      // Clean up reverse mappings
      await this.redis.del(`spinforge:servicepath:${state.servicePath}`);
      for (const domain of state.domains) {
        await this.redis.del(`spinforge:domain:${domain}`);
      }
      
      state.state = 'stopped';
      await this.persistState(state);
    }

    this.spinlets.delete(spinletId);
    this.states.delete(spinletId);
    
    const monitor = this.monitors.get(spinletId);
    if (monitor) {
      monitor.stop();
      this.monitors.delete(spinletId);
    }

    // Remove from Redis active set
    await this.redis.zrem('spinforge:active', spinletId);
    
    this.emit('spinlet:stopped', { spinletId, reason });
  }

  private setupProcessHandlers(spinletId: string, child: ChildProcess): void {
    child.on('error', (error) => {
      console.error(`Spinlet ${spinletId} error:`, error);
      this.emit('spinlet:error', { spinletId, error });
    });

    child.on('exit', (code, signal) => {
      const reason = code === 0 ? 'normal' : `crashed (${signal || code})`;
      this.cleanup(spinletId, reason);
      
      if (code !== 0) {
        this.emit('spinlet:crashed', { spinletId, error: new Error(reason) });
      }
    });

    // Handle stdout/stderr
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        // Forward to telemetry system
        this.emit('spinlet:log', { spinletId, level: 'info', message: data.toString() });
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        // Forward to telemetry system
        this.emit('spinlet:log', { spinletId, level: 'error', message: data.toString() });
      });
    }
  }

  private async waitForReady(spinletId: string, port: number, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // Check if process is still alive
        const child = this.spinlets.get(spinletId);
        if (!child || child.killed) {
          throw new Error('Process died during startup');
        }

        // Try to connect to the port
        const http = await import('http');
        await new Promise<void>((resolve, reject) => {
          const req = http.get(`http://localhost:${port}/health`, (res) => {
            if (res.statusCode === 200) {
              resolve();
            } else {
              reject(new Error(`Health check returned ${res.statusCode}`));
            }
          });
          req.on('error', reject);
          req.setTimeout(1000);
        });

        // Process is ready
        const state = this.states.get(spinletId);
        if (state) {
          state.state = 'running';
          await this.persistState(state);
        }
        return;
      } catch (error) {
        // Not ready yet, wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    throw new Error(`Spinlet ${spinletId} failed to start within ${timeout}ms`);
  }

  private getExecArgv(config: SpinletConfig): string[] {
    const args: string[] = [];
    
    if (config.resources?.memory) {
      const memoryMB = this.parseMemory(config.resources.memory);
      args.push(`--max-old-space-size=${memoryMB}`);
    }

    return args;
  }

  private parseMemory(memory: string): number {
    const match = memory.match(/^(\d+)(MB|GB)$/i);
    if (!match) {
      throw new Error(`Invalid memory format: ${memory}`);
    }
    
    const value = parseInt(match[1]);
    const unit = match[2].toUpperCase();
    
    return unit === 'GB' ? value * 1024 : value;
  }

  private startIdleChecker(): void {
    this.idleCheckInterval = setInterval(async () => {
      const now = Date.now();
      
      // Get all spinlet IDs from Redis
      const spinletIds = await this.redis.zrange('spinforge:active', 0, -1);
      
      for (const spinletId of spinletIds) {
        const state = await this.getState(spinletId);
        if (state && state.state === 'running' && now - state.lastAccess > IDLE_TIMEOUT_MS) {
          this.logger.info(`Stopping idle spinlet ${spinletId}`, {
            lastAccess: new Date(state.lastAccess),
            idleTime: Math.floor((now - state.lastAccess) / 1000 / 60) + ' minutes'
          });
          await this.stop(spinletId, 'idle');
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private startMetricsCollector(): void {
    this.metricsInterval = setInterval(async () => {
      for (const [spinletId, state] of this.states) {
        if (state.state === 'running') {
          try {
            const usage = await pidusage(state.pid);
            state.cpu = usage.cpu;
            state.memory = usage.memory;
            
            // Update resource metrics in Redis
            const key = `spinforge:metrics:resources:${spinletId}:${Date.now()}`;
            await this.redis.hset(key, {
              cpu_percent: usage.cpu,
              memory_bytes: usage.memory,
              memory_percent: (usage.memory / (1024 * 1024 * 1024)) * 100, // Assume 1GB max
              timestamp: Date.now()
            });
            await this.redis.expire(key, 7 * 24 * 60 * 60); // 7 days TTL
          } catch (error) {
            // Process might have died
            console.error(`Failed to get metrics for ${spinletId}:`, error);
          }
        }
      }
    }, 5000); // Collect every 5 seconds
  }

  async getState(spinletId: string): Promise<SpinletState | null> {
    // Check in-memory first
    const localState = this.states.get(spinletId);
    if (localState) {
      return localState;
    }

    // Check Redis
    const data = await this.redis.hgetall(`spinforge:spinlets:${spinletId}`);
    if (Object.keys(data).length === 0) {
      return null;
    }

    return {
      spinletId: data.spinletId,
      customerId: data.customerId,
      pid: parseInt(data.pid),
      port: parseInt(data.port),
      state: data.state as SpinletState['state'],
      startTime: parseInt(data.startTime),
      lastAccess: parseInt(data.lastAccess),
      requests: parseInt(data.requests || '0'),
      errors: parseInt(data.errors || '0'),
      memory: parseInt(data.memory || '0'),
      cpu: parseFloat(data.cpu || '0'),
      host: data.host,
      servicePath: data.servicePath || `localhost:${data.port}`,
      domains: data.domains ? JSON.parse(data.domains) : []
    };
  }

  private async persistState(state: SpinletState): Promise<void> {
    const key = `spinforge:spinlets:${state.spinletId}`;
    // Convert domains array to JSON for storage
    const stateToStore = {
      ...state,
      domains: JSON.stringify(state.domains)
    };
    await this.redis.hset(key, stateToStore as any);
    
    // Create reverse mappings for quick lookup
    await this.redis.set(`spinforge:servicepath:${state.servicePath}`, state.spinletId);
    for (const domain of state.domains) {
      await this.redis.set(`spinforge:domain:${domain}`, state.spinletId);
    }
    
    if (state.state === 'running') {
      await this.redis.zadd('spinforge:active', state.lastAccess, state.spinletId);
    }
  }

  async updateLastAccess(spinletId: string): Promise<void> {
    const state = this.states.get(spinletId);
    if (state) {
      state.lastAccess = Date.now();
      await this.persistState(state);
    }
  }

  async incrementRequests(spinletId: string, errors: number = 0): Promise<void> {
    const state = this.states.get(spinletId);
    if (state) {
      state.requests++;
      state.errors += errors;
      state.lastAccess = Date.now();
      await this.persistState(state);
    }
  }

  destroy(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.stopAll();
  }
}