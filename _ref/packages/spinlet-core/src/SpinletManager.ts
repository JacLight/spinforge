import { ChildProcess, fork } from "child_process";
import { EventEmitter } from "events";
import Redis from "ioredis";
import pidusage from "pidusage";
import * as path from "path";
import { SpinletConfig, SpinletState } from "./types";
import { PortAllocator } from "./PortAllocator";
import { SpinletMonitor } from "./SpinletMonitor";
import { IDLE_TIMEOUT_MS, STARTUP_TIMEOUT_MS } from "./constants";
import { createLogger } from "@spinforge/shared";

export class SpinletManager extends EventEmitter {
  private spinlets: Map<string, ChildProcess> = new Map();
  private states: Map<string, SpinletState> = new Map();
  private monitors: Map<string, SpinletMonitor> = new Map();
  private redis: Redis;
  private portAllocator: PortAllocator;
  private metricsInterval?: NodeJS.Timeout;
  private logger = createLogger("SpinletManager");

  constructor(redis: Redis, portRange?: { start: number; end: number }) {
    super();
    this.redis = redis;
    this.portAllocator = new PortAllocator(redis, portRange);
    this.setupKeyspaceNotifications();
    this.startMetricsCollector();

    // Check for orphaned spinlets on startup
    setTimeout(() => {
      this.checkAndFixOrphanedSpinlets().catch((err) => {
        this.logger.error("Error checking orphaned spinlets", { error: err });
      });
    }, 5000); // Wait 5 seconds for system to stabilize
  }

  async spawn(config: SpinletConfig): Promise<SpinletState> {
    const existingState = await this.getState(config.spinletId);
    if (existingState && existingState.state === "running") {
      await this.resetIdleTimeout(config.spinletId);
      return existingState;
    }

    this.logger.info(`Starting spinlet ${config.spinletId}`, {
      customerId: config.customerId,
      framework: config.framework,
      buildPath: config.buildPath,
      domains: config.domains,
    });

    const port =
      config.port || (await this.portAllocator.allocate(config.spinletId));

    const isDevelopment = config.mode === 'development' || config.env?.NODE_ENV === 'development';
    
    const env = {
      PORT: port.toString(),
      SPINLET_ID: config.spinletId,
      CUSTOMER_ID: config.customerId,
      NODE_ENV: isDevelopment ? "development" : "production",
      ...config.env,
    };

    // Determine the working directory
    const cwd =
      config.framework === "nextjs" && config.buildPath.endsWith("/.next")
        ? config.buildPath.substring(0, config.buildPath.length - 6) // Remove /.next
        : config.buildPath;

    let child: ChildProcess | undefined;

    if (config.framework === "nextjs") {
      // For Next.js, check if standalone server exists
      const fs = require("fs");
      const path = require("path");
      const { spawn } = require("child_process");
      const standaloneServerPath = path.join(config.buildPath, ".next", "standalone", "server.js");
      
      if (fs.existsSync(standaloneServerPath)) {
        // Use standalone server if available
        child = fork(standaloneServerPath, [], {
          cwd: path.join(config.buildPath, ".next", "standalone"),
          env: {
            ...env,
            HOSTNAME: "0.0.0.0",
            PORT: port.toString(),
          },
          silent: true,
          execArgv: this.getExecArgv(config),
        });
      } else {
        // Check package.json for start/dev scripts
        const packageJsonPath = path.join(cwd, "package.json");
        let useNpmScripts = false;
        
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const scriptName = isDevelopment ? 'dev' : 'start';
            if (packageJson.scripts && packageJson.scripts[scriptName]) {
              useNpmScripts = true;
              // Use npm run with the script from package.json
              child = spawn("npm", ["run", scriptName], {
                cwd,
                env,
                stdio: ["ignore", "pipe", "pipe"],
              });
            }
          } catch (error) {
            this.logger.warn(`Failed to read package.json: ${error}`);
          }
        }
        
        if (!useNpmScripts) {
          // Fallback to direct next command if no npm scripts
          const startScript = path.join(cwd, "node_modules", ".bin", "next");
          
          if (fs.existsSync(startScript)) {
            const command = isDevelopment ? "dev" : "start";
            child = spawn("node", [startScript, command, "-p", port.toString()], {
              cwd,
              env,
              stdio: ["ignore", "pipe", "pipe"],
            });
          } else {
            // Last resort - try to use global next
            const command = isDevelopment ? "dev" : "start";
            child = spawn("npx", ["next", command, "-p", port.toString()], {
              cwd,
              env,
              stdio: ["ignore", "pipe", "pipe"],
            });
          }
        }
      }
    } else if (config.framework === "node" || config.framework === "custom") {
      // For Express/custom, check package.json first
      const fs = require("fs");
      const path = require("path");
      const { spawn } = require("child_process");
      const packageJsonPath = path.join(config.buildPath, "package.json");
      let useNpmScripts = false;
      
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          const scriptName = isDevelopment ? (packageJson.scripts?.dev ? 'dev' : 'start') : 'start';
          
          if (packageJson.scripts && packageJson.scripts[scriptName]) {
            useNpmScripts = true;
            child = spawn("npm", ["run", scriptName], {
              cwd: config.buildPath,
              env,
              stdio: ["ignore", "pipe", "pipe"],
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to read package.json: ${error}`);
        }
      }
      
      if (!useNpmScripts) {
        // Fallback to forking the entry point directly
        let entryPoint = config.buildPath;
        
        // If buildPath is a directory, look for common entry points
        if (fs.statSync(config.buildPath).isDirectory()) {
          const possibleEntries = ['server.js', 'index.js', 'app.js', 'main.js'];
          for (const entry of possibleEntries) {
            const entryPath = path.join(config.buildPath, entry);
            if (fs.existsSync(entryPath)) {
              entryPoint = entryPath;
              break;
            }
          }
        }
        
        child = fork(entryPoint, [], {
          cwd: path.dirname(entryPoint),
          env,
          silent: true,
          execArgv: this.getExecArgv(config),
        });
      }
    } else if (
      config.framework === "static" ||
      config.framework === "react" ||
      config.framework === "vue" ||
      config.framework === "astro"
    ) {
      const { spawn } = require("child_process");
      const fs = require("fs");
      const path = require("path");
      
      // For non-static frameworks in development mode, check for dev scripts
      if (config.framework !== "static" && isDevelopment) {
        const packageJsonPath = path.join(config.buildPath, "package.json");
        
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            
            if (packageJson.scripts && packageJson.scripts.dev) {
              // Use the dev script for hot reload
              child = spawn("npm", ["run", "dev"], {
                cwd: config.buildPath,
                env,
                stdio: ["ignore", "pipe", "pipe"],
              });
            } else if (packageJson.scripts && packageJson.scripts.start) {
              // Fallback to start script
              child = spawn("npm", ["run", "start"], {
                cwd: config.buildPath,
                env,
                stdio: ["ignore", "pipe", "pipe"],
              });
            } else {
              // Fallback to static server
              child = spawn("python3", ["-m", "http.server", port.toString()], {
                cwd: config.buildPath,
                env,
                stdio: ["ignore", "pipe", "pipe"],
              });
            }
          } catch (error) {
            // Fallback to static server
            child = spawn("python3", ["-m", "http.server", port.toString()], {
              cwd: config.buildPath,
              env,
              stdio: ["ignore", "pipe", "pipe"],
            });
          }
        } else {
          // No package.json, use static server
          child = spawn("python3", ["-m", "http.server", port.toString()], {
            cwd: config.buildPath,
            env,
            stdio: ["ignore", "pipe", "pipe"],
          });
        }
      } else {
        // For static sites or production builds, use a simple HTTP server
        child = spawn("python3", ["-m", "http.server", port.toString()], {
          cwd: config.buildPath,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
      }
    } else if (config.framework === "nestjs") {
      // For NestJS, use node with the main file
      child = fork(path.join(config.buildPath, "main.js"), [], {
        cwd: config.buildPath,
        env,
        silent: true,
        execArgv: this.getExecArgv(config),
      });
    } else if (config.framework === "remix") {
      // For Remix, use npm scripts
      const { spawn } = require("child_process");
      const fs = require("fs");
      const path = require("path");
      const packageJsonPath = path.join(config.buildPath, "package.json");
      
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          const scriptName = isDevelopment ? (packageJson.scripts?.dev ? 'dev' : 'start') : 'start';
          child = spawn("npm", ["run", scriptName], {
            cwd: config.buildPath,
            env,
            stdio: ["ignore", "pipe", "pipe"],
          });
        } catch (error) {
          // Fallback to npm start
          child = spawn("npm", ["run", "start"], {
            cwd: config.buildPath,
            env,
            stdio: ["ignore", "pipe", "pipe"],
          });
        }
      } else {
        child = spawn("npm", ["run", "start"], {
          cwd: config.buildPath,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
      }
    } else if (config.framework === "flutter") {
      const { spawn } = require("child_process");
      child = spawn(
        "flutter",
        ["run", "-d", "web-server", "--web-port", port.toString()],
        {
          cwd: config.buildPath,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        }
      );
    } else if (config.framework === "docker") {
      //if in kubernetes, use docker run
      //run deployment template
      const { spawn } = require("child_process");
      child = spawn("docker", ["run", "-p", `${port}:80`, config.buildPath], {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      throw new Error(`Unsupported framework: ${config.framework}`);
    }
    
    // Ensure child is defined
    if (!child) {
      throw new Error(`Failed to spawn process for framework: ${config.framework}`);
    }

    const state: SpinletState = {
      spinletId: config.spinletId,
      customerId: config.customerId,
      pid: child.pid!,
      port,
      state: "starting",
      startTime: Date.now(),
      lastAccess: Date.now(),
      requests: 0,
      errors: 0,
      memory: 0,
      cpu: 0,
      host: process.env.HOSTNAME || "localhost",
      servicePath: `localhost:${port}`,
      domains: [],
    };

    this.spinlets.set(config.spinletId, child);
    this.states.set(config.spinletId, state);

    // Setup monitoring
    const monitor = new SpinletMonitor(config.spinletId, child);
    this.monitors.set(config.spinletId, monitor);

    // Handle process events
    this.setupProcessHandlers(config.spinletId, child);

    // Wait for process to be ready
    await this.waitForReady(config.spinletId, port, config.framework);

    // Update state in Redis
    await this.persistState(state);

    // Set initial idle timeout
    await this.resetIdleTimeout(state.spinletId);

    this.logger.info(`Spinlet ${config.spinletId} started successfully`, {
      port,
      pid: state.pid,
      servicePath: state.servicePath,
      startupTime: Date.now() - state.startTime + "ms",
    });

    this.emit("spinlet:started", { spinletId: config.spinletId, port });

    return state;
  }

  /**
   * Stop a spinlet process and clean up all Redis / port allocations.
   *
   * Previous logic aborted when the in-memory ChildProcess or state map entry
   * was missing, which left stale records in KeyDB and caused the router to
   * believe the spinlet was still running. We now:
   *   1. Attempt to hydrate state from Redis if it is not in memory.
   *   2. If a ChildProcess is not tracked but state exists, run cleanup()
   *      so ports and KeyDB mappings are released.
   *   3. If both child and state are absent we simply return (nothing to do).
   */
  async stop(spinletId: string, reason: string = "manual"): Promise<void> {
    let child = this.spinlets.get(spinletId);
    let state: SpinletState | null | undefined = this.states.get(spinletId);

    // If the spinlet state is not cached locally, try to fetch it from Redis
    if (!state) {
      state = await this.getState(spinletId);
      if (state) {
        this.states.set(spinletId, state);
      }
    }

    // If the process reference is missing but state still exists,
    // perform stateless cleanup to avoid leaving stale entries in KeyDB.
    if (!child && state) {
      await this.cleanup(spinletId, reason);
      return;
    }

    // If we have neither a child nor state, there is nothing left to stop.
    if (!child) {
      return;
    }

    if (state) {
      this.logger.info(`Stopping spinlet ${spinletId}`, {
        reason,
        uptime: Math.floor((Date.now() - state.startTime) / 1000) + "s",
        requests: state.requests,
        errors: state.errors,
      });
    } else {
      this.logger.info(`Stopping spinlet ${spinletId}`, {
        reason,
        note: "no cached state",
      });
    }

    if (state) {
      state.state = "stopping";
      await this.persistState(state);
    }

    // Graceful shutdown
    child.send({ type: "shutdown" });

    // Give it 5 seconds to shut down gracefully
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5000);

      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    await this.cleanup(spinletId, reason);

    if (state) {
      this.logger.info(`Spinlet ${spinletId} stopped`, {
        reason,
        finalState: state.state,
      });
    } else {
      this.logger.info(`Spinlet ${spinletId} stopped`, {
        reason,
        note: "state unknown",
      });
    }
  }

  async stopAll(): Promise<void> {
    const promises = Array.from(this.spinlets.keys()).map((id) =>
      this.stop(id, "shutdown")
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

  async getStateByServicePathOrDomain(
    pathOrDomain: string
  ): Promise<SpinletState | null> {
    let spinletId: string | null = null;

    // Check if it's a servicePath (contains port)
    if (pathOrDomain.includes(":")) {
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

      state.state = "stopped";
      await this.persistState(state);
    }

    this.spinlets.delete(spinletId);
    this.states.delete(spinletId);

    const monitor = this.monitors.get(spinletId);
    if (monitor) {
      monitor.stop();
      this.monitors.delete(spinletId);
    }

    // Remove from Redis active set and idle timeout key
    await this.redis.zrem("spinforge:active", spinletId);
    await this.redis.del(`spinforge:idle:${spinletId}`);

    this.emit("spinlet:stopped", { spinletId, reason });
  }

  private setupProcessHandlers(spinletId: string, child: ChildProcess): void {
    child.on("error", (error) => {
      this.logger.error(`Spinlet ${spinletId} crashed`, {
        error: error.message,
        stack: error.stack,
      });
      console.error(`Spinlet ${spinletId} error:`, error);
      this.emit("spinlet:error", { spinletId, error });
    });

    child.on("exit", (code, signal) => {
      const reason = code === 0 ? "normal" : `crashed (${signal || code})`;
      this.logger.info(`Spinlet ${spinletId} process exited`, {
        code,
        signal,
        reason,
        exitType: code === 0 ? "normal" : "abnormal",
      });
      this.cleanup(spinletId, reason);

      if (code !== 0) {
        this.emit("spinlet:crashed", { spinletId, error: new Error(reason) });
      }
    });

    // Handle stdout/stderr
    if (child.stdout) {
      child.stdout.on("data", (data) => {
        // Forward to telemetry system
        this.emit("spinlet:log", {
          spinletId,
          level: "info",
          message: data.toString(),
        });
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (data) => {
        // Forward to telemetry system
        this.emit("spinlet:log", {
          spinletId,
          level: "error",
          message: data.toString(),
        });
      });
    }
  }

  private async waitForReady(
    spinletId: string,
    port: number,
    framework?: string,
    timeout: number = STARTUP_TIMEOUT_MS
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        // Check if process is still alive
        const child = this.spinlets.get(spinletId);
        if (!child || child.killed) {
          throw new Error("Process died during startup");
        }

        // Try to connect to the port
        const http = await import("http");
        await new Promise<void>((resolve, reject) => {
          // For static sites and Next.js, just check if the root responds
          const path = (framework === "static" || framework === "nextjs") ? "/" : "/health";
          const req = http.get(`http://localhost:${port}${path}`, (res) => {
            // For static sites and Next.js, any response is good (even 404 means server is up)
            if (framework === "static" || framework === "nextjs" || res.statusCode === 200) {
              resolve();
            } else {
              reject(new Error(`Health check returned ${res.statusCode}`));
            }
          });
          req.on("error", reject);
          req.setTimeout(1000);
        });

        // Process is ready
        const state = this.states.get(spinletId);
        if (state) {
          state.state = "running";
          await this.persistState(state);
        }
        return;
      } catch (error) {
        // Not ready yet, wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));
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

    return unit === "GB" ? value * 1024 : value;
  }

  private async setupKeyspaceNotifications(): Promise<void> {
    // Enable keyspace notifications for expired keys
    await this.redis.config("SET", "notify-keyspace-events", "Ex");

    // Subscribe to expired key events
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe("__keyevent@0__:expired");

    subscriber.on("message", async (_channel, key) => {
      // Check if this is an idle timeout key
      if (key.startsWith("spinforge:idle:")) {
        const spinletId = key.replace("spinforge:idle:", "");
        const state = await this.getState(spinletId);

        if (state && state.state === "running") {
          this.logger.info(`Stopping idle spinlet ${spinletId}`, {
            lastAccess: new Date(state.lastAccess),
            reason: "idle timeout expired",
          });
          await this.stop(spinletId, "idle");
        }
      }
    });
  }

  private async resetIdleTimeout(spinletId: string): Promise<void> {
    // Set/reset the idle timeout key with TTL
    const ttlSeconds = Math.floor(IDLE_TIMEOUT_MS / 1000);
    await this.redis.setex(`spinforge:idle:${spinletId}`, ttlSeconds, "1");

    // Also update lastAccess for monitoring
    const state = this.states.get(spinletId);
    if (state) {
      state.lastAccess = Date.now();
      await this.persistState(state);
    }
  }

  private async checkAndFixOrphanedSpinlets(): Promise<void> {
    // Get all active spinlets from Redis
    const spinletIds = await this.redis.zrange("spinforge:active", 0, -1);

    for (const spinletId of spinletIds) {
      const state = await this.getState(spinletId);
      if (state && state.state === "running") {
        // Check if idle timeout key exists
        const ttl = await this.redis.ttl(`spinforge:idle:${spinletId}`);
        if (ttl === -2) {
          // Key doesn't exist
          this.logger.warn(
            `Found orphaned spinlet without idle timeout: ${spinletId}`,
            {
              lastAccess: new Date(state.lastAccess),
              timeSinceLastAccess:
                Math.floor((Date.now() - state.lastAccess) / 1000) + "s",
            }
          );

          // Check if it should be stopped immediately
          const timeSinceLastAccess = Date.now() - state.lastAccess;
          if (timeSinceLastAccess > IDLE_TIMEOUT_MS) {
            this.logger.info(`Stopping orphaned idle spinlet ${spinletId}`);
            await this.stop(spinletId, "orphaned-idle");
          } else {
            // Create idle timeout key for remaining time
            const remainingTime = Math.floor(
              (IDLE_TIMEOUT_MS - timeSinceLastAccess) / 1000
            );
            if (remainingTime > 0) {
              await this.redis.setex(
                `spinforge:idle:${spinletId}`,
                remainingTime,
                "1"
              );
              this.logger.info(
                `Created idle timeout for orphaned spinlet ${spinletId}`,
                {
                  remainingTime: remainingTime + "s",
                }
              );
            }
          }
        }
      }
    }
  }

  private startMetricsCollector(): void {
    this.metricsInterval = setInterval(async () => {
      for (const [spinletId, state] of this.states) {
        if (state.state === "running") {
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
              timestamp: Date.now(),
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
      state: data.state as SpinletState["state"],
      startTime: parseInt(data.startTime),
      lastAccess: parseInt(data.lastAccess),
      requests: parseInt(data.requests || "0"),
      errors: parseInt(data.errors || "0"),
      memory: parseInt(data.memory || "0"),
      cpu: parseFloat(data.cpu || "0"),
      host: data.host,
      servicePath: data.servicePath || `localhost:${data.port}`,
      domains: data.domains ? JSON.parse(data.domains) : [],
    };
  }

  async getIdleInfo(
    spinletId: string
  ): Promise<{ ttl: number; willExpireAt: Date } | null> {
    const ttl = await this.redis.ttl(`spinforge:idle:${spinletId}`);
    if (ttl <= 0) return null;

    return {
      ttl,
      willExpireAt: new Date(Date.now() + ttl * 1000),
    };
  }

  async extendIdleTimeout(
    spinletId: string,
    additionalSeconds: number = 300
  ): Promise<void> {
    const state = await this.getState(spinletId);
    if (!state || state.state !== "running") return;

    const currentTTL = await this.redis.ttl(`spinforge:idle:${spinletId}`);
    if (currentTTL > 0) {
      const newTTL = currentTTL + additionalSeconds;
      await this.redis.expire(`spinforge:idle:${spinletId}`, newTTL);

      this.logger.info(`Extended idle timeout for ${spinletId}`, {
        previousTTL: currentTTL,
        newTTL,
        additionalTime: additionalSeconds,
      });
    }
  }

  async getIdleMetrics(): Promise<any> {
    const spinletIds = await this.redis.zrange("spinforge:active", 0, -1);
    const metrics = {
      totalActive: spinletIds.length,
      idleTimeouts: [] as any[],
      aboutToExpire: 0,
      avgTimeToExpire: 0,
    };

    let totalTTL = 0;
    for (const spinletId of spinletIds) {
      const idleInfo = await this.getIdleInfo(spinletId);
      if (idleInfo) {
        metrics.idleTimeouts.push({
          spinletId,
          ttl: idleInfo.ttl,
          willExpireAt: idleInfo.willExpireAt,
        });

        totalTTL += idleInfo.ttl;
        if (idleInfo.ttl < 60) {
          // Less than 1 minute
          metrics.aboutToExpire++;
        }
      }
    }

    if (metrics.idleTimeouts.length > 0) {
      metrics.avgTimeToExpire = Math.round(
        totalTTL / metrics.idleTimeouts.length
      );
    }

    return metrics;
  }

  private async persistState(state: SpinletState): Promise<void> {
    const key = `spinforge:spinlets:${state.spinletId}`;
    // Convert domains array to JSON for storage
    const stateToStore = {
      ...state,
      domains: JSON.stringify(state.domains),
    };
    await this.redis.hset(key, stateToStore as any);

    // Create reverse mappings for quick lookup
    await this.redis.set(
      `spinforge:servicepath:${state.servicePath}`,
      state.spinletId
    );
    for (const domain of state.domains) {
      await this.redis.set(`spinforge:domain:${domain}`, state.spinletId);
    }

    if (state.state === "running") {
      await this.redis.zadd(
        "spinforge:active",
        state.lastAccess,
        state.spinletId
      );
    }
  }

  async updateLastAccess(spinletId: string): Promise<void> {
    await this.resetIdleTimeout(spinletId);
  }

  async incrementRequests(
    spinletId: string,
    errors: number = 0
  ): Promise<void> {
    const state = this.states.get(spinletId);
    if (state) {
      state.requests++;
      state.errors += errors;
      state.lastAccess = Date.now();
      await this.persistState(state);

      // Reset idle timeout on each request
      await this.resetIdleTimeout(spinletId);
    }
  }

  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.stopAll();
  }
}
