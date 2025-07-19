"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinletManager = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
const pidusage_1 = __importDefault(require("pidusage"));
const PortAllocator_1 = require("./PortAllocator");
const SpinletMonitor_1 = require("./SpinletMonitor");
const constants_1 = require("./constants");
class SpinletManager extends events_1.EventEmitter {
    spinlets = new Map();
    states = new Map();
    monitors = new Map();
    redis;
    portAllocator;
    idleCheckInterval;
    metricsInterval;
    constructor(redis, portRange) {
        super();
        this.redis = redis;
        this.portAllocator = new PortAllocator_1.PortAllocator(redis, portRange);
        this.startIdleChecker();
        this.startMetricsCollector();
    }
    async spawn(config) {
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
        const child = (0, child_process_1.fork)(config.buildPath, [], {
            cwd: config.buildPath.substring(0, config.buildPath.lastIndexOf('/')),
            env,
            silent: true, // Capture stdout/stderr
            execArgv: this.getExecArgv(config)
        });
        const state = {
            spinletId: config.spinletId,
            customerId: config.customerId,
            pid: child.pid,
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
        const monitor = new SpinletMonitor_1.SpinletMonitor(config.spinletId, child);
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
    async stop(spinletId, reason = 'manual') {
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
        await new Promise((resolve) => {
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
    async stopAll() {
        const promises = Array.from(this.spinlets.keys()).map(id => this.stop(id, 'shutdown'));
        await Promise.all(promises);
    }
    async updateDomains(spinletId, domains) {
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
    async findByServicePath(servicePath) {
        return await this.redis.get(`spinforge:servicepath:${servicePath}`);
    }
    async findByDomain(domain) {
        return await this.redis.get(`spinforge:domain:${domain}`);
    }
    async getStateByServicePathOrDomain(pathOrDomain) {
        let spinletId = null;
        // Check if it's a servicePath (contains port)
        if (pathOrDomain.includes(':')) {
            spinletId = await this.findByServicePath(pathOrDomain);
        }
        else {
            // Assume it's a domain
            spinletId = await this.findByDomain(pathOrDomain);
        }
        if (!spinletId) {
            return null;
        }
        return await this.getState(spinletId);
    }
    async cleanup(spinletId, reason) {
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
    setupProcessHandlers(spinletId, child) {
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
    async waitForReady(spinletId, port, timeout = 30000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                // Check if process is still alive
                const child = this.spinlets.get(spinletId);
                if (!child || child.killed) {
                    throw new Error('Process died during startup');
                }
                // Try to connect to the port
                const http = await Promise.resolve().then(() => __importStar(require('http')));
                await new Promise((resolve, reject) => {
                    const req = http.get(`http://localhost:${port}/health`, (res) => {
                        if (res.statusCode === 200) {
                            resolve();
                        }
                        else {
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
            }
            catch (error) {
                // Not ready yet, wait a bit
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        throw new Error(`Spinlet ${spinletId} failed to start within ${timeout}ms`);
    }
    getExecArgv(config) {
        const args = [];
        if (config.resources?.memory) {
            const memoryMB = this.parseMemory(config.resources.memory);
            args.push(`--max-old-space-size=${memoryMB}`);
        }
        return args;
    }
    parseMemory(memory) {
        const match = memory.match(/^(\d+)(MB|GB)$/i);
        if (!match) {
            throw new Error(`Invalid memory format: ${memory}`);
        }
        const value = parseInt(match[1]);
        const unit = match[2].toUpperCase();
        return unit === 'GB' ? value * 1024 : value;
    }
    startIdleChecker() {
        this.idleCheckInterval = setInterval(async () => {
            const now = Date.now();
            for (const [spinletId, state] of this.states) {
                if (state.state === 'running' && now - state.lastAccess > constants_1.IDLE_TIMEOUT_MS) {
                    await this.stop(spinletId, 'idle');
                }
            }
        }, 30000); // Check every 30 seconds
    }
    startMetricsCollector() {
        this.metricsInterval = setInterval(async () => {
            for (const [spinletId, state] of this.states) {
                if (state.state === 'running') {
                    try {
                        const usage = await (0, pidusage_1.default)(state.pid);
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
                    }
                    catch (error) {
                        // Process might have died
                        console.error(`Failed to get metrics for ${spinletId}:`, error);
                    }
                }
            }
        }, 5000); // Collect every 5 seconds
    }
    async getState(spinletId) {
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
            state: data.state,
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
    async persistState(state) {
        const key = `spinforge:spinlets:${state.spinletId}`;
        // Convert domains array to JSON for storage
        const stateToStore = {
            ...state,
            domains: JSON.stringify(state.domains)
        };
        await this.redis.hset(key, stateToStore);
        // Create reverse mappings for quick lookup
        await this.redis.set(`spinforge:servicepath:${state.servicePath}`, state.spinletId);
        for (const domain of state.domains) {
            await this.redis.set(`spinforge:domain:${domain}`, state.spinletId);
        }
        if (state.state === 'running') {
            await this.redis.zadd('spinforge:active', state.lastAccess, state.spinletId);
        }
    }
    async updateLastAccess(spinletId) {
        const state = this.states.get(spinletId);
        if (state) {
            state.lastAccess = Date.now();
            await this.persistState(state);
        }
    }
    async incrementRequests(spinletId, errors = 0) {
        const state = this.states.get(spinletId);
        if (state) {
            state.requests++;
            state.errors += errors;
            state.lastAccess = Date.now();
            await this.persistState(state);
        }
    }
    destroy() {
        if (this.idleCheckInterval) {
            clearInterval(this.idleCheckInterval);
        }
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        this.stopAll();
    }
}
exports.SpinletManager = SpinletManager;
//# sourceMappingURL=SpinletManager.js.map