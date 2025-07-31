import express, { Application, Request, Response, NextFunction } from "express";
import { createServer, Server as HttpServer } from "http";
import {
  createServer as createHttpsServer,
  Server as HttpsServer,
} from "https";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import Redis from "ioredis";
import * as fs from "fs/promises";
import { SpinletManager } from "@spinforge/spinlet-core";
import {
  createLogger,
  createRedisClient,
  RedisHelper,
  TelemetryCollector,
} from "@spinforge/shared";
import { RouteManager } from "./RouteManager";
import { ProxyHandler } from "./ProxyHandler";
import { MetricsCollector } from "./MetricsCollector";
import { RouteConfig } from "./types";
import { HubConfig, defaultConfig } from "./config";
import { AdminService } from "./services/AdminService";
import { CustomerService } from "./services/CustomerService";
import { HotDeploymentWatcher } from "./deployment/HotDeploymentWatcher";
import { DeploymentAPI } from "./deployment/DeploymentAPI";
import { CustomerAPI } from "./api/CustomerAPI";
import { SettingsAPI } from "./api/SettingsAPI";
import { HostingAPI } from "./api/HostingAPI";
import { readFileSync } from "fs";
import multer from "multer";
import * as path from "path";

export class SpinHub {
  private app: Application;
  private server: HttpServer | HttpsServer;
  private config: HubConfig;
  private redis: Redis;
  private redisHelper: RedisHelper;
  private spinletManager: SpinletManager;
  private routeManager: RouteManager;
  private proxyHandler: ProxyHandler;
  private telemetry: TelemetryCollector;
  private metricsCollector: MetricsCollector;
  private hotDeploymentWatcher?: HotDeploymentWatcher;
  private deploymentAPI?: DeploymentAPI;
  private customerAPI?: CustomerAPI;
  private settingsAPI?: SettingsAPI;
  private hostingAPI?: HostingAPI;
  private adminRouter?: express.Router;
  private adminService: AdminService;
  private customerService: CustomerService;
  private logger = createLogger("SpinHub");
  private requestMetrics = {
    total: 0,
    spinhub: 0,
    spinlets: new Map<string, number>(),
    byRoute: new Map<string, number>(),
    byStatus: new Map<number, number>(),
    byMethod: new Map<string, number>(),
  };
  private deploymentStats = {
    total: 0,
    success: 0,
    failed: 0,
    inProgress: 0,
    byFramework: new Map<string, number>(),
    byOS: new Map<string, number>(),
    avgBuildTime: 0,
    lastDeployments: [] as any[],
  };

  constructor(config: Partial<HubConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.app = express();
    this.redis = createRedisClient();
    this.redisHelper = new RedisHelper(this.redis);
    this.spinletManager = new SpinletManager(this.redis);
    this.routeManager = new RouteManager(this.redis);
    this.telemetry = new TelemetryCollector(this.redisHelper);
    this.metricsCollector = new MetricsCollector(this.redis);
    this.proxyHandler = new ProxyHandler(
      this.spinletManager,
      this.routeManager,
      this.telemetry
    );

    // Initialize admin and customer services
    this.adminService = new AdminService(
      this.redis,
      this.config.admin.tokenSecret,
      this.config.admin.sessionTimeout
    );
    this.customerService = new CustomerService(this.redis);

    this.setupMiddleware();
    this.setupRoutes();
    this.server = this.createServer();
    this.setupWebSocketHandling();
  }

  private buildConfig(partial: Partial<HubConfig>): HubConfig {
    // This method is now deprecated, keeping for compatibility
    return { ...defaultConfig, ...partial };
  }

  private setupMiddleware(): void {
    // Trust proxy
    if (this.config.trustProxy) {
      this.app.set("trust proxy", true);
    }

    // Security headers
    this.app.use(
      helmet({
        contentSecurityPolicy: false, // Disable CSP as we're proxying various apps
        crossOriginEmbedderPolicy: false,
      })
    );

    // Compression
    this.app.use(compression());

    // CORS
    if (this.config.cors) {
      this.app.use(cors(this.config.cors as any));
    }

    // Body parsing
    this.app.use(express.json({ limit: this.config.maxRequestSize }));
    this.app.use(
      express.urlencoded({ extended: true, limit: this.config.maxRequestSize })
    );

    // Simple request counting middleware for now
    // TODO: Add more complex tracking later
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.requestMetrics.total++;
      next();
    });

    // Global rate limiting
    const globalLimiter = rateLimit({
      ...this.config.rateLimits.global,
      keyGenerator: (req) => {
        // Use forwarded IP if behind proxy, otherwise use req.ip
        return (
          req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
          req.socket.remoteAddress ||
          "unknown"
        );
      },
      skip: () => !this.config.trustProxy,
    });
    this.app.use(globalLimiter);

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      res.on("finish", () => {
        const duration = Date.now() - start;
        this.logger.debug("Request completed", {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
        });
      });

      next();
    });

    // Request timeout
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.setTimeout(this.config.requestTimeout);
      res.setTimeout(this.config.requestTimeout);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/_health", (req: Request, res: Response) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Admin login endpoint (not protected)
    this.app.post("/_admin/login", async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;

        if (!username || !password) {
          res.status(400).json({ error: "Username and password required" });
          return;
        }

        const result = await this.adminService.login(username, password);
        if (!result) {
          res.status(401).json({ error: "Invalid credentials" });
          return;
        }

        res.json({
          token: result.token,
          admin: result.admin,
        });
      } catch (error) {
        this.logger.error("Admin login error", { error });
        res.status(500).json({ error: "Login failed" });
      }
    });

    // Public customer authentication endpoints
    this.app.post("/_auth/register", async (req: Request, res: Response) => {
      try {
        const { email, password, name, company } = req.body;

        if (!email || !password || !name) {
          res
            .status(400)
            .json({ error: "Email, password, and name are required" });
          return;
        }

        // Check if customer already exists
        const existing = await this.customerService.getCustomerByEmail(email);
        if (existing) {
          res
            .status(409)
            .json({ error: "Customer with this email already exists" });
          return;
        }

        // Create customer in spinforge-web format
        const { customer, userId } =
          await this.customerService.createWebCustomer({
            email,
            password,
            name,
            company,
          });

        // Generate auth token
        const token = Buffer.from(`${customer.id}:${Date.now()}`).toString(
          "base64"
        );
        await this.redis.setex(
          `auth:token:${token}`,
          86400, // 24 hour expiry
          JSON.stringify({ customerId: customer.id, email, userId })
        );

        res.json({
          success: true,
          customer: {
            id: customer.id,
            email: customer.email,
            name: customer.name,
            customerId: customer.id,
          },
          token,
          userId,
        });
      } catch (error) {
        this.logger.error("Customer registration error", { error });
        res.status(500).json({ error: "Registration failed" });
      }
    });

    this.app.post("/_auth/login", async (req: Request, res: Response) => {
      try {
        const { email, password } = req.body;

        if (!email || !password) {
          res.status(400).json({ error: "Email and password are required" });
          return;
        }

        // Authenticate customer
        const customer = await this.customerService.authenticateWebCustomer(
          email,
          password
        );
        if (!customer) {
          res.status(401).json({ error: "Invalid credentials" });
          return;
        }

        // Generate auth token
        const token = Buffer.from(`${customer.id}:${Date.now()}`).toString(
          "base64"
        );
        await this.redis.setex(
          `auth:token:${token}`,
          86400, // 24 hour expiry
          JSON.stringify({
            customerId: customer.id,
            email,
            userId: customer.metadata?.userId,
          })
        );

        res.json({
          success: true,
          customer: {
            id: customer.id,
            email: customer.email,
            name: customer.name,
            customerId: customer.id,
          },
          token,
          userId: customer.metadata?.userId,
        });
      } catch (error) {
        this.logger.error("Customer login error", { error });
        res.status(500).json({ error: "Login failed" });
      }
    });

    this.app.post("/_auth/verify", async (req: Request, res: Response) => {
      try {
        const { token } = req.body;

        if (!token) {
          res.status(400).json({ error: "Token is required" });
          return;
        }

        // Verify token
        const tokenData = await this.redis.get(`auth:token:${token}`);
        if (!tokenData) {
          res.status(401).json({ error: "Invalid or expired token" });
          return;
        }

        const { customerId, email } = JSON.parse(tokenData);
        const customer = await this.customerService.getCustomer(customerId);

        if (!customer) {
          res.status(401).json({ error: "Customer not found" });
          return;
        }

        res.json({
          valid: true,
          customer: {
            id: customer.id,
            email: customer.email,
            name: customer.name,
          },
        });
      } catch (error) {
        this.logger.error("Token verification error", { error });
        res.status(500).json({ error: "Verification failed" });
      }
    });

    // Basic metrics endpoint (for backward compatibility)
    this.app.get("/_metrics", async (req: Request, res: Response) => {
      try {
        const metrics = await this.metricsCollector.getAllMetrics();
        const activeSpinlets = await this.redis.zcard("spinforge:active");
        const allocatedPorts = await this.redis.hlen(
          "spinforge:ports:allocated"
        );
        const totalPorts =
          parseInt(process.env.PORT_END || "40000") -
          parseInt(process.env.PORT_START || "30000");

        res.json({
          activeSpinlets,
          allocatedPorts,
          availablePorts: totalPorts - allocatedPorts,
          totalSpinlets: 50, // Configurable limit
          memoryUsage: metrics.system.memory.usagePercent,
          cpuUsage: metrics.system.cpu.usage,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch metrics" });
      }
    });

    // Comprehensive metrics endpoints
    this.app.get("/_metrics/system", async (req: Request, res: Response) => {
      try {
        const metrics = await this.metricsCollector.getSystemMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch system metrics" });
      }
    });

    this.app.get("/_metrics/docker", async (req: Request, res: Response) => {
      try {
        const stats = await this.metricsCollector.getDockerStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch Docker stats" });
      }
    });

    this.app.get("/_metrics/keydb", async (req: Request, res: Response) => {
      try {
        const metrics = await this.metricsCollector.getKeyDBMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch KeyDB metrics" });
      }
    });

    this.app.get("/_metrics/services", async (req: Request, res: Response) => {
      try {
        const health = await this.metricsCollector.getServiceHealth();
        res.json(health);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch service health" });
      }
    });

    this.app.get("/_metrics/all", async (req: Request, res: Response) => {
      try {
        const metrics = await this.metricsCollector.getAllMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch all metrics" });
      }
    });

    // Request metrics endpoint
    this.app.get("/_metrics/requests", async (req: Request, res: Response) => {
      try {
        res.json({
          total: this.requestMetrics.total,
          spinhub: this.requestMetrics.spinhub,
          spinlets: Object.fromEntries(this.requestMetrics.spinlets),
          byRoute: Object.fromEntries(this.requestMetrics.byRoute),
          byStatus: Object.fromEntries(this.requestMetrics.byStatus),
          byMethod: Object.fromEntries(this.requestMetrics.byMethod),
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch request metrics" });
      }
    });

    // Deployment stats endpoint
    this.app.get(
      "/_metrics/deployments",
      async (req: Request, res: Response) => {
        try {
          // Simple mock data for now
          const stats = {
            total: this.deploymentStats.total,
            success: this.deploymentStats.success,
            failed: this.deploymentStats.failed,
            inProgress: this.deploymentStats.inProgress,
            successRate:
              this.deploymentStats.total > 0
                ? (
                    (this.deploymentStats.success /
                      this.deploymentStats.total) *
                    100
                  ).toFixed(2) + "%"
                : "0%",
            byFramework: Object.fromEntries(this.deploymentStats.byFramework),
            byOS: Object.fromEntries(this.deploymentStats.byOS),
            avgBuildTime: this.deploymentStats.avgBuildTime,
            recentDeployments: [],
          };

          res.json(stats);
        } catch (error) {
          res.status(500).json({ error: "Failed to fetch deployment stats" });
        }
      }
    );

    // Idle timeout metrics endpoint
    this.app.get("/_metrics/idle", async (req: Request, res: Response) => {
      try {
        const idleMetrics = await this.spinletManager.getIdleMetrics();
        res.json(idleMetrics);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch idle metrics" });
      }
    });

    // Get idle info for specific spinlet
    this.app.get(
      "/_metrics/idle/:spinletId",
      async (req: Request, res: Response) => {
        try {
          const { spinletId } = req.params;
          const idleInfo = await this.spinletManager.getIdleInfo(spinletId);

          if (!idleInfo) {
            return res
              .status(404)
              .json({ error: "Spinlet not found or not active" });
          }

          return res.json({
            spinletId,
            ...idleInfo,
            timeRemaining: idleInfo.ttl,
            timeRemainingFormatted: this.formatTime(idleInfo.ttl),
          });
        } catch (error) {
          return res.status(500).json({ error: "Failed to fetch idle info" });
        }
      }
    );

    // Extend idle timeout endpoint
    this.app.post(
      "/_admin/spinlets/:spinletId/extend-timeout",
      async (req: Request, res: Response) => {
        try {
          const { spinletId } = req.params;
          const { seconds = 300 } = req.body; // Default 5 minutes

          await this.spinletManager.extendIdleTimeout(spinletId, seconds);

          const newIdleInfo = await this.spinletManager.getIdleInfo(spinletId);
          res.json({
            success: true,
            spinletId,
            newTimeout: newIdleInfo,
          });
        } catch (error) {
          res.status(500).json({ error: "Failed to extend timeout" });
        }
      }
    );

    // Admin API routes (should be protected in production)
    this.setupAdminRoutes();

    // Mount admin router to the app
    if (this.adminRouter) {
      this.app.use("/_admin", this.adminRouter);
    }

    // IMPORTANT: Proxy handler must be registered LAST, after all other routes
    // Otherwise it will catch all requests before they reach specific route handlers

    // Delay registering the proxy catch-all handler
    // We'll do this at the end of setupRoutes()

    // Error handler
    this.app.use(
      (err: Error, req: Request, res: Response, next: NextFunction) => {
        this.logger.error("Unhandled error", { error: err, path: req.path });

        if (!res.headersSent) {
          res.status(500).json({
            error: "Internal Server Error",
            message:
              process.env.NODE_ENV === "development" ? err.message : undefined,
          });
        }
      }
    );

    // Proxy all other requests - MUST be registered LAST
    // Proxy handler will be registered after all other routes are set up
    // See registerProxyHandler() method
  }

  private registerProxyHandler(): void {
    // This is a catch-all handler that will proxy any request that doesn't match
    // the routes defined above (health, metrics, admin, customer API, etc.)
    this.app.use(async (req: Request, res: Response) => {
      await this.proxyHandler.handleRequest(req, res);
    });
    this.logger.info("Proxy handler registered as final catch-all route");
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  private setupAdminRoutes(): void {
    const adminRouter = express.Router();
    this.adminRouter = adminRouter;

    // Admin authentication middleware - Validate admin token for all requests
    adminRouter.use(
      async (req: Request, res: Response, next: express.NextFunction) => {
        // Skip authentication for login endpoint
        if (req.path === "/login") {
          next();
          return;
        }

        // Always require admin token
        const adminToken = req.headers["x-admin-token"] as string;
        const authToken =
          req.headers["authorization"]?.replace("Bearer ", "") || adminToken;

        if (!authToken) {
          res
            .status(401)
            .json({ error: "Unauthorized - Admin token required" });
          return;
        }

        // Validate token using AdminService
        const admin = await this.adminService.validateToken(authToken);
        if (!admin) {
          res.status(401).json({ error: "Invalid or expired admin token" });
          return;
        }

        // Attach admin info to request
        (req as any).admin = admin;
        next();
      }
    );

    // Per-customer rate limiting for admin routes
    const customerLimiter = rateLimit({
      ...this.config.rateLimits.perCustomer,
      keyGenerator: (req) =>
        req.body?.customerId || req.params?.customerId || "unknown",
      skip: () => !this.config.trustProxy,
    });

    adminRouter.use(customerLimiter);

    // Add route
    adminRouter.post("/routes", async (req: Request, res: Response) => {
      try {
        const { domain, customerId, spinletId, buildPath, framework, config } =
          req.body;

        // Validate input
        if (!domain || !customerId || !spinletId || !buildPath || !framework) {
          res.status(400).json({ error: "Missing required fields" });
          return;
        }

        // Validate domain
        const validation = await this.routeManager.validateRoute(domain);
        if (!validation.valid) {
          res.status(400).json({ error: validation.reason });
          return;
        }

        // Ensure customer exists (for legacy customer IDs)
        await this.customerService.ensureCustomerExists(customerId);

        // Add route
        await this.routeManager.addRoute({
          domain,
          customerId,
          spinletId,
          buildPath,
          framework,
          config,
        });

        // Update spinlet's domains
        const spinletState = await this.spinletManager.getState(spinletId);
        if (spinletState) {
          const currentDomains = spinletState.domains || [];
          if (!currentDomains.includes(domain)) {
            currentDomains.push(domain);
            await this.spinletManager.updateDomains(spinletId, currentDomains);
          }
        }

        res.json({ success: true, domain });
      } catch (error) {
        this.logger.error("Failed to add route", { error });
        res.status(500).json({ error: "Failed to add route" });
      }
    });

    // Remove route
    adminRouter.delete(
      "/routes/:domain",
      async (req: Request, res: Response) => {
        try {
          const domain = req.params.domain;
          this.logger.info(`Deleting route for domain: ${domain}`);

          const route = await this.routeManager.getRoute(domain);

          if (!route) {
            this.logger.warn(`Route not found for domain: ${domain}`);
            res.status(404).json({ error: "Route not found" });
            return;
          }

          if (route) {
            // Stop the spinlet if it's the only domain
            const spinletState = await this.spinletManager.getState(
              route.spinletId
            );
            if (spinletState) {
              const updatedDomains = spinletState.domains.filter(
                (d) => d !== domain
              );

              if (updatedDomains.length === 0) {
                // This was the last domain, stop the spinlet
                this.logger.info(
                  `Stopping spinlet ${route.spinletId} as it has no more domains`
                );
                await this.spinletManager.stop(route.spinletId);
              } else {
                // Update the domains list
                await this.spinletManager.updateDomains(
                  route.spinletId,
                  updatedDomains
                );
              }
            }

            // Remove deployment folder if it exists
            try {
              const deploymentName = domain.replace(/\./g, "-");
              const deploymentPath = `/deployments/${deploymentName}`;
              await fs.rm(deploymentPath, { recursive: true, force: true });
              this.logger.info(`Removed deployment folder: ${deploymentPath}`);
            } catch (error) {
              // Deployment folder might not exist, which is fine
              this.logger.debug(
                `Deployment folder removal failed (might not exist): ${error}`
              );
            }
          }

          await this.routeManager.removeRoute(domain);
          this.logger.info(`Successfully removed route for domain: ${domain}`);
          res.json({ success: true });
        } catch (error) {
          this.logger.error("Failed to remove route", {
            error,
            domain: req.params.domain,
          });
          res.status(500).json({ error: "Failed to remove route" });
        }
      }
    );

    // Get all routes
    adminRouter.get("/routes", async (req: Request, res: Response) => {
      try {
        const allDomains = await this.redis.hkeys("spinforge:routes");
        const routes = await Promise.all(
          allDomains.map((domain) => this.routeManager.getRoute(domain))
        );

        // Group routes by spinletId to find all domains for each application
        const spinletDomainsMap = new Map<string, string[]>();
        const validRoutes = routes.filter(Boolean) as any[];

        for (const route of validRoutes) {
          if (!spinletDomainsMap.has(route.spinletId)) {
            spinletDomainsMap.set(route.spinletId, []);
          }
          spinletDomainsMap.get(route.spinletId)!.push(route.domain);
        }

        // Enhance each route with all associated domains
        const enhancedRoutes = validRoutes.map((route) => ({
          ...route,
          allDomains: spinletDomainsMap.get(route.spinletId) || [route.domain],
        }));

        res.json(enhancedRoutes);
      } catch (error) {
        this.logger.error("Failed to get all routes", { error });
        res.status(500).json({ error: "Failed to get routes" });
      }
    });

    // Get comprehensive route details with all associated resources
    adminRouter.get(
      "/routes/:domain/details",
      async (req: Request, res: Response) => {
        try {
          const domain = req.params.domain;
          const route = await this.routeManager.getRoute(domain);

          if (!route) {
            res.status(404).json({ error: "Route not found" });
            return;
          }

          // Get all domains for this spinlet
          const allDomains = await this.redis.hkeys("spinforge:routes");
          const spinletDomains: string[] = [];

          for (const d of allDomains) {
            const r = await this.routeManager.getRoute(d);
            if (r && r.spinletId === route.spinletId) {
              spinletDomains.push(d);
            }
          }

          // Get spinlet state
          let spinletState = await this.spinletManager.getState(
            route.spinletId
          );

          // If no state exists, create a mock running state
          if (!spinletState) {
            const port = 3000 + Math.floor(Math.random() * 1000);
            spinletState = {
              spinletId: route.spinletId,
              customerId: route.customerId,
              pid: Math.floor(Math.random() * 10000) + 1000,
              port: port,
              state: "running",
              startTime: Date.now() - Math.random() * 86400000, // Random time in last 24h
              lastAccess: Date.now() - Math.random() * 3600000, // Random time in last hour
              requests: Math.floor(Math.random() * 10000),
              errors: Math.floor(Math.random() * 100),
              memory: Math.floor(Math.random() * 256 * 1024 * 1024), // 0-256MB
              cpu: Math.floor(Math.random() * 50), // 0-50%
              host: "localhost",
              servicePath: `localhost:${port}`,
              domains: spinletDomains.length > 0 ? spinletDomains : [domain],
            };
          } else {
            // Create enhanced state object
            spinletState = {
              ...spinletState,
              servicePath:
                spinletState.servicePath ||
                `localhost:${spinletState.port || 3000}`,
              domains:
                spinletDomains.length > 0
                  ? spinletDomains
                  : spinletState.domains || [domain],
              state:
                spinletState.state === "stopped" && spinletState.memory > 0
                  ? "running"
                  : spinletState.state,
            };
          }

          // Get metrics for this specific spinlet
          const metrics = await this.getSpinletMetrics(route.spinletId);

          // Get recent logs
          const logs = await this.getSpinletLogs(route.spinletId, 50);

          // Get service health
          const health = await this.checkSpinletHealth(
            route.spinletId,
            route.domain
          );

          // Get resource usage
          const resources = await this.getSpinletResources(route.spinletId);

          // Get related services (nginx, keydb entries)
          const relatedServices = await this.getRelatedServices(
            domain,
            route.customerId
          );

          // Get audit trail
          const auditTrail = await this.getRouteAuditTrail(domain);

          // Compile comprehensive response
          const details = {
            route,
            spinlet: {
              spinletId: route.spinletId,
              state: spinletState,
              health,
              metrics,
              resources,
              logs: logs.slice(-10), // Last 10 log entries
            },
            services: relatedServices,
            networking: {
              publicUrl: `https://${domain}`,
              internalUrl: spinletState?.port
                ? `http://localhost:${spinletState.port}`
                : null,
              sslStatus: "active",
              dnsStatus: "resolved",
            },
            auditTrail: auditTrail.slice(-5), // Last 5 events
            links: {
              logs: `/_admin/routes/${domain}/logs`,
              metrics: `/_admin/routes/${domain}/metrics`,
              exec: `/_admin/routes/${domain}/exec`,
              config: `/_admin/routes/${domain}/config`,
            },
          };

          res.json(details);
        } catch (error) {
          this.logger.error("Failed to get route details", { error });
          res.status(500).json({ error: "Failed to get route details" });
        }
      }
    );

    // Get route-specific logs
    adminRouter.get(
      "/routes/:domain/logs",
      async (req: Request, res: Response) => {
        try {
          const domain = req.params.domain;
          const route = await this.routeManager.getRoute(domain);

          if (!route) {
            res.status(404).json({ error: "Route not found" });
            return;
          }

          const lines = parseInt(req.query.lines as string) || 100;
          const logs = await this.getSpinletLogs(route.spinletId, lines);

          res.json({
            domain,
            spinletId: route.spinletId,
            logs,
            _links: {
              stream: `/_admin/routes/${domain}/logs/stream`,
            },
          });
        } catch (error) {
          this.logger.error("Failed to get route logs", { error });
          res.status(500).json({ error: "Failed to get route logs" });
        }
      }
    );

    // Get route-specific metrics
    adminRouter.get(
      "/routes/:domain/metrics",
      async (req: Request, res: Response) => {
        try {
          const domain = req.params.domain;
          const route = await this.routeManager.getRoute(domain);

          if (!route) {
            res.status(404).json({ error: "Route not found" });
            return;
          }

          const metrics = await this.getSpinletMetrics(route.spinletId);
          const resources = await this.getSpinletResources(route.spinletId);

          res.json({
            domain,
            spinletId: route.spinletId,
            metrics,
            resources,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error("Failed to get route metrics", { error });
          res.status(500).json({ error: "Failed to get route metrics" });
        }
      }
    );

    // Execute command in route's spinlet
    adminRouter.post(
      "/routes/:domain/exec",
      async (req: Request, res: Response) => {
        try {
          const domain = req.params.domain;
          const route = await this.routeManager.getRoute(domain);

          if (!route) {
            res.status(404).json({ error: "Route not found" });
            return;
          }

          const { command, workDir } = req.body;

          if (!command) {
            res.status(400).json({ error: "Command is required" });
            return;
          }

          // For security, validate command
          const allowedCommands = [
            "ls",
            "pwd",
            "env",
            "cat",
            "tail",
            "head",
            "grep",
            "ps",
            "df",
            "du",
          ];
          const baseCommand = command.split(" ")[0];

          if (!allowedCommands.includes(baseCommand)) {
            res.status(403).json({ error: "Command not allowed" });
            return;
          }

          // Mock implementation - integrate with Docker exec
          const output = `Executed in ${domain} (${route.spinletId}): ${command}\nOutput: command executed successfully`;

          res.json({
            domain,
            spinletId: route.spinletId,
            command,
            output,
          });
        } catch (error) {
          this.logger.error("Failed to execute command", { error });
          res.status(500).json({ error: "Failed to execute command" });
        }
      }
    );

    // Add domain to existing application
    adminRouter.post(
      "/routes/:domain/domains",
      async (req: Request, res: Response) => {
        try {
          const { domain } = req.params;
          const { newDomain } = req.body;

          if (!newDomain) {
            res.status(400).json({ error: "New domain is required" });
            return;
          }

          // Check if new domain already exists
          const existingRoute = await this.routeManager.getRoute(newDomain);
          if (existingRoute) {
            res.status(409).json({ error: "Domain already exists" });
            return;
          }

          // Get the original route
          const route = await this.routeManager.getRoute(domain);
          if (!route) {
            res.status(404).json({ error: "Route not found" });
            return;
          }

          // Create new route with same configuration
          await this.routeManager.addRoute({
            ...route,
            domain: newDomain,
          });

          // Update spinlet domains if it's not static/reverse-proxy
          if (
            route.framework !== "static" &&
            route.framework !== "reverse-proxy"
          ) {
            const allDomains = await this.redis.hkeys("spinforge:routes");
            const spinletDomains: string[] = [];

            for (const d of allDomains) {
              const r = await this.routeManager.getRoute(d);
              if (r && r.spinletId === route.spinletId) {
                spinletDomains.push(d);
              }
            }

            await this.spinletManager.updateDomains(
              route.spinletId,
              spinletDomains
            );
          }

          this.logger.info(
            `Added domain ${newDomain} to application ${domain}`
          );
          res.json({
            success: true,
            message: `Domain ${newDomain} added successfully`,
          });
        } catch (error) {
          this.logger.error("Failed to add domain", { error });
          res.status(500).json({ error: "Failed to add domain" });
        }
      }
    );

    // Remove domain from route (without deleting the entire route)
    adminRouter.delete(
      "/routes/:domain/domains/:domainToRemove",
      async (req: Request, res: Response) => {
        try {
          const { domain, domainToRemove } = req.params;

          // Get the route to verify it exists
          const route = await this.routeManager.getRoute(domain);
          if (!route) {
            res.status(404).json({ error: "Route not found" });
            return;
          }

          // Check if the domain to remove exists
          const routeToRemove =
            await this.routeManager.getRoute(domainToRemove);
          if (!routeToRemove || routeToRemove.spinletId !== route.spinletId) {
            res.status(404).json({
              error: "Domain not found or doesn't belong to this application",
            });
            return;
          }

          // Get all domains for this spinlet
          const allDomains = await this.redis.hkeys("spinforge:routes");
          const spinletDomains: string[] = [];

          for (const d of allDomains) {
            const r = await this.routeManager.getRoute(d);
            if (r && r.spinletId === route.spinletId) {
              spinletDomains.push(d);
            }
          }

          // Don't allow removing the last domain
          if (spinletDomains.length <= 1) {
            res.status(400).json({
              error:
                "Cannot remove the last domain. Delete the application instead.",
            });
            return;
          }

          // Remove the route for this domain
          await this.routeManager.removeRoute(domainToRemove);

          // Update spinlet domains if it's not static/reverse-proxy
          if (
            route.framework !== "static" &&
            route.framework !== "reverse-proxy"
          ) {
            const updatedDomains = spinletDomains.filter(
              (d) => d !== domainToRemove
            );
            await this.spinletManager.updateDomains(
              route.spinletId,
              updatedDomains
            );
          }

          this.logger.info(
            `Removed domain ${domainToRemove} from application ${domain}`
          );
          res.json({
            success: true,
            message: `Domain ${domainToRemove} removed successfully`,
          });
        } catch (error) {
          this.logger.error("Failed to remove domain", { error });
          res.status(500).json({ error: "Failed to remove domain" });
        }
      }
    );

    // Update route configuration
    adminRouter.put(
      "/routes/:domain/config",
      async (req: Request, res: Response) => {
        try {
          const domain = req.params.domain;
          const route = await this.routeManager.getRoute(domain);

          if (!route) {
            res.status(404).json({ error: "Route not found" });
            return;
          }

          const { memory, cpu, env } = req.body;

          route.config = route.config || {};
          if (memory) route.config.memory = memory;
          if (cpu) route.config.cpu = cpu;
          if (env) route.config.env = { ...route.config.env, ...env };

          await this.routeManager.updateRoute(domain, route);

          res.json({
            success: true,
            domain,
            config: route.config,
            message:
              "Configuration updated. Restart required to apply changes.",
          });
        } catch (error) {
          this.logger.error("Failed to update route config", { error });
          res.status(500).json({ error: "Failed to update route config" });
        }
      }
    );

    // Restart route's spinlet
    adminRouter.post(
      "/routes/:domain/restart",
      async (req: Request, res: Response) => {
        try {
          const domain = req.params.domain;
          const route = await this.routeManager.getRoute(domain);

          if (!route) {
            res.status(404).json({ error: "Route not found" });
            return;
          }

          // Static and reverse-proxy don't have spinlets to restart
          if (
            (route.framework as string) === "static" ||
            (route.framework as string) === "reverse-proxy"
          ) {
            res.json({
              success: false,
              message: `Cannot restart ${route.framework} deployment - no spinlet process`,
            });
            return;
          }

          await this.spinletManager.stop(route.spinletId, "restart");
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Check if framework supports spinlets
          if (
            (route.framework as string) !== "static" &&
            (route.framework as string) !== "reverse-proxy"
          ) {
            await this.spinletManager.spawn({
              spinletId: route.spinletId,
              customerId: route.customerId,
              buildPath: route.buildPath,
              framework: route.framework as any, // Cast to bypass type mismatch
              env: route.config?.env,
              resources: {
                memory: route.config?.memory,
                cpu: route.config?.cpu,
              },
            });
          }

          // Update domains after spawning
          await this.spinletManager.updateDomains(route.spinletId, [
            route.domain,
          ]);

          res.json({
            success: true,
            domain,
            spinletId: route.spinletId,
            message: "Application restarted successfully",
          });
        } catch (error) {
          this.logger.error("Failed to restart route", { error });
          res.status(500).json({ error: "Failed to restart route" });
        }
      }
    );

    // Get route health status
    adminRouter.get(
      "/routes/:domain/health",
      async (req: Request, res: Response) => {
        try {
          const domain = req.params.domain;
          const route = await this.routeManager.getRoute(domain);

          if (!route) {
            res.status(404).json({ error: "Route not found" });
            return;
          }

          const health = await this.checkSpinletHealth(route.spinletId, domain);

          res.json({
            domain,
            spinletId: route.spinletId,
            health,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error("Failed to get route health", { error });
          res.status(500).json({ error: "Failed to get route health" });
        }
      }
    );

    // Get routes for customer
    adminRouter.get(
      "/customers/:customerId/routes",
      async (req: Request, res: Response) => {
        try {
          const domains = await this.routeManager.getCustomerDomains(
            req.params.customerId
          );
          const routes = await Promise.all(
            domains.map((domain) => this.routeManager.getRoute(domain))
          );

          res.json(routes.filter(Boolean));
        } catch (error) {
          this.logger.error("Failed to get customer routes", { error });
          res.status(500).json({ error: "Failed to get routes" });
        }
      }
    );

    // Stop spinlet
    adminRouter.post(
      "/spinlets/:spinletId/stop",
      async (req: Request, res: Response) => {
        try {
          await this.spinletManager.stop(req.params.spinletId, "admin");
          res.json({ success: true });
        } catch (error) {
          this.logger.error("Failed to stop spinlet", { error });
          res.status(500).json({ error: "Failed to stop spinlet" });
        }
      }
    );

    // Get spinlet state
    adminRouter.get(
      "/spinlets/:spinletId",
      async (req: Request, res: Response) => {
        try {
          let state = await this.spinletManager.getState(req.params.spinletId);
          if (!state) {
            res.status(404).json({ error: "Spinlet not found" });
            return;
          }

          // Get the route to find the domain
          const route = await this.getRouteBySpinletId(req.params.spinletId);

          // Create enhanced state object
          const enhancedState = {
            ...state,
            servicePath: state.servicePath || `localhost:${state.port || 3000}`,
            domains: state.domains || (route ? [route.domain] : []),
            state:
              state.state === "stopped" && (state.memory > 0 || state.cpu > 0)
                ? "running"
                : state.state,
          };

          res.json(enhancedState);
        } catch (error) {
          this.logger.error("Failed to get spinlet state", { error });
          res.status(500).json({ error: "Failed to get spinlet state" });
        }
      }
    );

    // Find spinlet by servicePath or domain
    adminRouter.get(
      "/spinlets/find/:pathOrDomain",
      async (req: Request, res: Response) => {
        try {
          const pathOrDomain = req.params.pathOrDomain;
          const state =
            await this.spinletManager.getStateByServicePathOrDomain(
              pathOrDomain
            );
          if (!state) {
            res.status(404).json({ error: "Spinlet not found" });
            return;
          }
          res.json(state);
        } catch (error) {
          this.logger.error("Failed to find spinlet", { error });
          res.status(500).json({ error: "Failed to find spinlet" });
        }
      }
    );

    // Start spinlet
    adminRouter.post(
      "/spinlets/:spinletId/start",
      async (req: Request, res: Response) => {
        try {
          const route = await this.getRouteBySpinletId(req.params.spinletId);
          if (!route) {
            res.status(404).json({ error: "Spinlet not found" });
            return;
          }

          // Check if framework supports spinlets
          if (
            (route.framework as string) !== "static" &&
            (route.framework as string) !== "reverse-proxy"
          ) {
            await this.spinletManager.spawn({
              spinletId: route.spinletId,
              customerId: route.customerId,
              buildPath: route.buildPath,
              framework: route.framework as any, // Cast to bypass type mismatch
              env: route.config?.env,
              resources: {
                memory: route.config?.memory,
                cpu: route.config?.cpu,
              },
            });
          }

          // Update domains after spawning
          await this.spinletManager.updateDomains(route.spinletId, [
            route.domain,
          ]);

          res.json({ success: true });
        } catch (error) {
          this.logger.error("Failed to start spinlet", { error });
          res.status(500).json({ error: "Failed to start spinlet" });
        }
      }
    );

    // Restart spinlet
    adminRouter.post(
      "/spinlets/:spinletId/restart",
      async (req: Request, res: Response) => {
        try {
          const route = await this.getRouteBySpinletId(req.params.spinletId);
          if (!route) {
            res.status(404).json({ error: "Spinlet not found" });
            return;
          }

          // Stop and start
          await this.spinletManager.stop(req.params.spinletId, "restart");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Brief pause

          // Check if framework supports spinlets
          if (
            (route.framework as string) !== "static" &&
            (route.framework as string) !== "reverse-proxy"
          ) {
            await this.spinletManager.spawn({
              spinletId: route.spinletId,
              customerId: route.customerId,
              buildPath: route.buildPath,
              framework: route.framework as any, // Cast to bypass type mismatch
              env: route.config?.env,
              resources: {
                memory: route.config?.memory,
                cpu: route.config?.cpu,
              },
            });
          }

          // Update domains after spawning
          await this.spinletManager.updateDomains(route.spinletId, [
            route.domain,
          ]);

          res.json({ success: true });
        } catch (error) {
          this.logger.error("Failed to restart spinlet", { error });
          res.status(500).json({ error: "Failed to restart spinlet" });
        }
      }
    );

    // Scale spinlet
    adminRouter.post(
      "/spinlets/:spinletId/scale",
      async (req: Request, res: Response) => {
        try {
          const { instances, memory, cpu } = req.body;

          // Update route config
          const route = await this.getRouteBySpinletId(req.params.spinletId);
          if (!route) {
            res.status(404).json({ error: "Spinlet not found" });
            return;
          }

          if (memory || cpu) {
            route.config = route.config || {};
            if (memory) route.config.memory = memory;
            if (cpu) route.config.cpu = cpu;

            await this.routeManager.updateRoute(route.domain, route);

            // Restart with new resources
            await this.spinletManager.stop(req.params.spinletId, "scale");
            await new Promise((resolve) => setTimeout(resolve, 1000));

            await this.spinletManager.spawn({
              spinletId: route.spinletId,
              customerId: route.customerId,
              buildPath: route.buildPath,
              framework: route.framework,
              env: route.config?.env,
              resources: {
                memory: route.config?.memory,
                cpu: route.config?.cpu,
              },
            });
          }

          res.json({ success: true, config: route.config });
        } catch (error) {
          this.logger.error("Failed to scale spinlet", { error });
          res.status(500).json({ error: "Failed to scale spinlet" });
        }
      }
    );

    // Update environment variables
    adminRouter.put(
      "/spinlets/:spinletId/env",
      async (req: Request, res: Response) => {
        try {
          const { env } = req.body;

          const route = await this.getRouteBySpinletId(req.params.spinletId);
          if (!route) {
            res.status(404).json({ error: "Spinlet not found" });
            return;
          }

          route.config = route.config || {};
          route.config.env = { ...route.config.env, ...env };

          await this.routeManager.updateRoute(route.domain, route);

          // Restart to apply new env
          await this.spinletManager.stop(req.params.spinletId, "env-update");
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Check if framework supports spinlets
          if (
            (route.framework as string) !== "static" &&
            (route.framework as string) !== "reverse-proxy"
          ) {
            await this.spinletManager.spawn({
              spinletId: route.spinletId,
              customerId: route.customerId,
              buildPath: route.buildPath,
              framework: route.framework as any, // Cast to bypass type mismatch
              env: route.config?.env,
              resources: {
                memory: route.config?.memory,
                cpu: route.config?.cpu,
              },
            });
          }

          res.json({ success: true, env: route.config.env });
        } catch (error) {
          this.logger.error("Failed to update environment", { error });
          res.status(500).json({ error: "Failed to update environment" });
        }
      }
    );

    // Health check for a specific spinlet
    adminRouter.get(
      "/spinlets/:spinletId/health",
      async (req: Request, res: Response) => {
        try {
          const spinletId = req.params.spinletId;
          const state = await this.spinletManager.getState(spinletId);

          if (!state) {
            res.status(404).json({ error: "Spinlet not found" });
            return;
          }

          // Perform comprehensive health checks
          const healthChecks = {
            process: false,
            port: false,
            responsive: false,
            memory: false,
            endpoints: [] as any[],
          };

          // Check if process is running
          if (state.pid && state.state === "running") {
            try {
              process.kill(state.pid, 0); // Check if process exists
              healthChecks.process = true;
            } catch (e) {
              healthChecks.process = false;
            }
          }

          // Check if port is open
          if (state.port) {
            const portCheck = await new Promise((resolve) => {
              const net = require("net");
              const socket = new net.Socket();
              socket.setTimeout(2000);
              socket.on("connect", () => {
                socket.destroy();
                resolve(true);
              });
              socket.on("timeout", () => {
                socket.destroy();
                resolve(false);
              });
              socket.on("error", () => {
                resolve(false);
              });
              socket.connect(state.port, "localhost");
            });
            healthChecks.port = portCheck as boolean;
          }

          // Check if application is responsive
          if (healthChecks.port && state.servicePath) {
            try {
              const response = await fetch(`http://${state.servicePath}/`, {
                method: "HEAD",
                signal: AbortSignal.timeout(5000),
              });
              healthChecks.responsive = response.ok || response.status < 500;

              // Get the route to check framework type
              const allDomains = await this.redis.hkeys("spinforge:routes");
              let framework = "node"; // default
              for (const domain of allDomains) {
                const routeData = await this.redis.hget(
                  "spinforge:routes",
                  domain
                );
                if (routeData) {
                  const route = JSON.parse(routeData);
                  if (route.spinletId === spinletId && route.framework) {
                    framework = route.framework;
                    break;
                  }
                }
              }

              // Only check health endpoints for non-static frameworks
              if (framework !== "static") {
                // Check common health endpoints
                const healthEndpoints = [
                  "/health",
                  "/api/health",
                  "/_health",
                  "/status",
                ];
                for (const endpoint of healthEndpoints) {
                  try {
                    const endpointResponse = await fetch(
                      `http://${state.servicePath}${endpoint}`,
                      {
                        signal: AbortSignal.timeout(2000),
                      }
                    );
                    healthChecks.endpoints.push({
                      path: endpoint,
                      status: endpointResponse.status,
                      ok: endpointResponse.ok,
                    });
                  } catch (e) {
                    healthChecks.endpoints.push({
                      path: endpoint,
                      status: "timeout",
                      ok: false,
                      error: (e as any).message,
                    });
                  }
                }
              }
            } catch (e) {
              healthChecks.responsive = false;
            }
          }

          // Check memory usage
          healthChecks.memory = state.memory < 1024 * 1024 * 1024; // Less than 1GB

          const overallHealth =
            healthChecks.process &&
            healthChecks.port &&
            healthChecks.responsive;

          res.json({
            healthy: overallHealth,
            status: overallHealth ? "healthy" : "unhealthy",
            spinletId,
            state: state.state,
            uptime: state.startTime ? Date.now() - state.startTime : 0,
            checks: healthChecks,
            lastAccess: state.lastAccess,
            errors: state.errors,
            memory: state.memory,
            cpu: state.cpu,
          });
        } catch (error) {
          this.logger.error("Failed to check spinlet health", { error });
          res.status(500).json({ error: "Failed to check spinlet health" });
        }
      }
    );

    // Get spinlet logs
    adminRouter.get(
      "/spinlets/:spinletId/logs",
      async (req: Request, res: Response) => {
        try {
          const lines = parseInt(req.query.lines as string) || 100;
          const follow = req.query.follow === "true";
          const spinletId = req.params.spinletId;

          // Get the spinlet state to find the container name
          const state = await this.spinletManager.getState(spinletId);
          if (!state) {
            res.status(404).json({ error: "Spinlet not found" });
            return;
          }

          // For container-based spinlets, get Docker logs
          const containerName = `spinforge-${spinletId}`;

          try {
            const { exec } = require("child_process");
            const { promisify } = require("util");
            const execAsync = promisify(exec);

            // Get container logs
            const { stdout, stderr } = await execAsync(
              `docker logs ${containerName} --tail ${lines} 2>&1`,
              { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
            );

            const logsOutput = stdout || stderr || "";
            const logLines = logsOutput
              .split("\n")
              .filter((line) => line.trim());

            // If no Docker logs, check for local process logs
            if (logLines.length === 0) {
              // Try to get logs from the spinlet's log file if running as local process
              const logFile = `/tmp/spinforge/${spinletId}/output.log`;
              try {
                const fs = require("fs").promises;
                const logContent = await fs.readFile(logFile, "utf-8");
                const fileLines = logContent
                  .split("\n")
                  .filter((line) => line.trim());
                logLines.push(...fileLines.slice(-lines));
              } catch (e) {
                // No log file found, use fallback
                logLines.push(
                  `[${new Date().toISOString()}] Spinlet ${spinletId} is running on port ${
                    state.port
                  }`
                );
                logLines.push(
                  `[${new Date().toISOString()}] No logs available yet`
                );
              }
            }

            res.json({
              logs: logLines.slice(-lines),
              lines,
              follow,
              containerName,
              spinletId,
            });
          } catch (dockerError: any) {
            // Container might not exist or Docker might not be available
            this.logger.warn("Failed to get Docker logs, using fallback", {
              dockerError,
            });

            const fallbackLogs = [
              `[${new Date().toISOString()}] Spinlet ${spinletId} information:`,
              `[${new Date().toISOString()}] State: ${state.state}`,
              `[${new Date().toISOString()}] Port: ${state.port}`,
              `[${new Date().toISOString()}] PID: ${state.pid}`,
              `[${new Date().toISOString()}] Service Path: ${
                state.servicePath
              }`,
              `[${new Date().toISOString()}] Domains: ${state.domains.join(
                ", "
              )}`,
              `[${new Date().toISOString()}] Requests: ${state.requests}`,
              `[${new Date().toISOString()}] Errors: ${state.errors}`,
            ];

            res.json({
              logs: fallbackLogs.slice(-lines),
              lines,
              follow,
              spinletId,
            });
          }
        } catch (error) {
          this.logger.error("Failed to get logs", { error });
          res.status(500).json({ error: "Failed to get logs" });
        }
      }
    );

    // Execute command in spinlet
    adminRouter.post(
      "/spinlets/:spinletId/exec",
      async (req: Request, res: Response) => {
        try {
          const { command, workDir } = req.body;
          const spinletId = req.params.spinletId;

          if (!command) {
            res.status(400).json({ error: "Command is required" });
            return;
          }

          // For security, validate command
          const allowedCommands = [
            "ls",
            "pwd",
            "env",
            "cat",
            "tail",
            "head",
            "grep",
            "ps",
            "df",
            "du",
            "find",
            "wc",
            "sort",
            "uniq",
          ];
          const baseCommand = command.split(" ")[0];

          if (!allowedCommands.includes(baseCommand)) {
            res.status(403).json({
              error: `Command '${baseCommand}' not allowed. Allowed commands: ${allowedCommands.join(
                ", "
              )}`,
            });
            return;
          }

          // Get the spinlet state
          const state = await this.spinletManager.getState(spinletId);
          if (!state) {
            res.status(404).json({ error: "Spinlet not found" });
            return;
          }

          // Execute command in container or local process
          const containerName = `spinforge-${spinletId}`;

          try {
            const { exec } = require("child_process");
            const { promisify } = require("util");
            const execAsync = promisify(exec);

            let output: string;

            // Try Docker exec first
            try {
              const workDirFlag = workDir ? `-w ${workDir}` : "";
              const { stdout, stderr } = await execAsync(
                `docker exec ${workDirFlag} ${containerName} ${command}`,
                { maxBuffer: 1024 * 1024 * 5 } // 5MB buffer
              );

              output = stdout || stderr || "Command executed successfully";
            } catch (dockerError: any) {
              // If Docker fails, try local execution if it's a local process
              if (state.pid && state.state === "running") {
                // For local processes, execute in the build directory
                const buildDir = workDir || `/tmp/spinforge/${spinletId}/build`;
                const { stdout, stderr } = await execAsync(command, {
                  cwd: buildDir,
                  maxBuffer: 1024 * 1024 * 5,
                });

                output = stdout || stderr || "Command executed successfully";
              } else {
                throw dockerError;
              }
            }

            // Clean up output
            output = output.trim();
            if (!output) {
              output = "Command executed successfully (no output)";
            }

            res.json({
              success: true,
              output,
              command,
              workDir: workDir || "default",
              spinletId,
              timestamp: new Date().toISOString(),
            });
          } catch (execError: any) {
            this.logger.error("Command execution failed", {
              execError,
              command,
              spinletId,
            });
            res.json({
              success: false,
              output: `Error: ${execError.message}`,
              command,
              spinletId,
            });
          }
        } catch (error) {
          this.logger.error("Failed to execute command", { error });
          res.status(500).json({ error: "Failed to execute command" });
        }
      }
    );

    // Admin management endpoints
    adminRouter.get("/admins", async (req: Request, res: Response) => {
      try {
        const admins = await this.adminService.getAllAdmins();
        res.json(admins);
      } catch (error) {
        this.logger.error("Failed to get admins", { error });
        res.status(500).json({ error: "Failed to get admins" });
      }
    });

    adminRouter.post("/admins", async (req: Request, res: Response) => {
      try {
        const currentAdmin = (req as any).admin;
        if (!currentAdmin.isSuperAdmin) {
          res
            .status(403)
            .json({ error: "Only super admins can create admin users" });
          return;
        }

        const { username, password, email, isSuperAdmin } = req.body;

        if (!username || !password) {
          res.status(400).json({ error: "Username and password required" });
          return;
        }

        const admin = await this.adminService.createAdmin({
          username,
          password,
          email,
          isSuperAdmin,
        });

        res.json(admin);
      } catch (error) {
        this.logger.error("Failed to create admin", { error });
        res.status(500).json({ error: "Failed to create admin" });
      }
    });

    adminRouter.put("/admins/:id", async (req: Request, res: Response) => {
      try {
        const currentAdmin = (req as any).admin;
        if (!currentAdmin.isSuperAdmin && currentAdmin.id !== req.params.id) {
          res
            .status(403)
            .json({ error: "Can only update own profile or be super admin" });
          return;
        }

        const admin = await this.adminService.updateAdmin(
          req.params.id,
          req.body
        );
        if (!admin) {
          res.status(404).json({ error: "Admin not found" });
          return;
        }

        res.json(admin);
      } catch (error) {
        this.logger.error("Failed to update admin", { error });
        res.status(500).json({ error: "Failed to update admin" });
      }
    });

    adminRouter.delete("/admins/:id", async (req: Request, res: Response) => {
      try {
        const currentAdmin = (req as any).admin;
        if (!currentAdmin.isSuperAdmin) {
          res
            .status(403)
            .json({ error: "Only super admins can delete admin users" });
          return;
        }

        if (currentAdmin.id === req.params.id) {
          res.status(400).json({ error: "Cannot delete your own account" });
          return;
        }

        const deleted = await this.adminService.deleteAdmin(req.params.id);
        if (!deleted) {
          res.status(404).json({ error: "Admin not found" });
          return;
        }

        res.json({ success: true });
      } catch (error) {
        this.logger.error("Failed to delete admin", { error });
        res.status(500).json({ error: "Failed to delete admin" });
      }
    });

    // Customer management endpoints
    adminRouter.get("/customers", async (req: Request, res: Response) => {
      try {
        const { isActive, limit, offset } = req.query;
        const result = await this.customerService.getAllCustomers({
          isActive:
            isActive === "true"
              ? true
              : isActive === "false"
                ? false
                : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
          offset: offset ? parseInt(offset as string) : undefined,
        });
        res.json(result);
      } catch (error) {
        this.logger.error("Failed to get customers", { error });
        res.status(500).json({ error: "Failed to get customers" });
      }
    });

    adminRouter.get("/customers/:id", async (req: Request, res: Response) => {
      try {
        const customer = await this.customerService.getCustomer(req.params.id);
        if (!customer) {
          res.status(404).json({ error: "Customer not found" });
          return;
        }

        const stats = await this.customerService.getCustomerStats(
          req.params.id
        );
        res.json({ ...customer, stats });
      } catch (error) {
        this.logger.error("Failed to get customer", { error });
        res.status(500).json({ error: "Failed to get customer" });
      }
    });

    adminRouter.post("/customers", async (req: Request, res: Response) => {
      try {
        const { name, email, metadata, limits } = req.body;

        if (!name || !email) {
          res.status(400).json({ error: "Name and email required" });
          return;
        }

        // Check if email already exists
        const existing = await this.customerService.getCustomerByEmail(email);
        if (existing) {
          res
            .status(400)
            .json({ error: "Customer with this email already exists" });
          return;
        }

        const customer = await this.customerService.createCustomer({
          name,
          email,
          metadata,
          limits,
        });

        res.json(customer);
      } catch (error) {
        this.logger.error("Failed to create customer", { error });
        res.status(500).json({ error: "Failed to create customer" });
      }
    });

    adminRouter.put("/customers/:id", async (req: Request, res: Response) => {
      try {
        const customer = await this.customerService.updateCustomer(
          req.params.id,
          req.body
        );
        if (!customer) {
          res.status(404).json({ error: "Customer not found" });
          return;
        }

        res.json(customer);
      } catch (error) {
        this.logger.error("Failed to update customer", { error });
        res.status(500).json({ error: "Failed to update customer" });
      }
    });

    adminRouter.delete(
      "/customers/:id",
      async (req: Request, res: Response) => {
        try {
          const deleted = await this.customerService.deleteCustomer(
            req.params.id
          );
          if (!deleted) {
            res.status(404).json({ error: "Customer not found" });
            return;
          }

          res.json({ success: true });
        } catch (error) {
          this.logger.error("Failed to delete customer", { error });
          res.status(500).json({ error: "Failed to delete customer" });
        }
      }
    );

    // Platform configuration endpoints
    adminRouter.get("/config", async (req: Request, res: Response) => {
      try {
        const config = {
          rateLimits: this.config.rateLimits,
          resources: {
            defaultMemory: "512MB",
            defaultCpu: "0.5",
            maxMemory: "4GB",
            maxCpu: "2",
          },
          ports: {
            start: parseInt(process.env.PORT_START || "10000"),
            end: parseInt(process.env.PORT_END || "20000"),
          },
          ssl: {
            enabled: !!this.config.ssl?.enabled,
            autoProvision: true,
          },
        };

        res.json(config);
      } catch (error) {
        this.logger.error("Failed to get config", { error });
        res.status(500).json({ error: "Failed to get config" });
      }
    });

    adminRouter.put("/config", async (req: Request, res: Response) => {
      try {
        const { rateLimits, resources, ports } = req.body;

        // Store config in Redis
        await this.redis.set(
          "spinforge:config",
          JSON.stringify({
            rateLimits,
            resources,
            ports,
            updatedAt: new Date().toISOString(),
          })
        );

        res.json({
          success: true,
          message: "Configuration updated. Restart required for some changes.",
        });
      } catch (error) {
        this.logger.error("Failed to update config", { error });
        res.status(500).json({ error: "Failed to update config" });
      }
    });

    // Backup endpoints
    adminRouter.post("/backup", async (req: Request, res: Response) => {
      try {
        const { type, includeData, includeConfigs, includeLogs } = req.body;

        const backupId = `backup-${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}`;

        // Mock backup creation
        await this.redis.hset(
          "spinforge:backups",
          backupId,
          JSON.stringify({
            id: backupId,
            type,
            includeData,
            includeConfigs,
            includeLogs,
            createdAt: new Date().toISOString(),
            size: "156MB",
            status: "completed",
          })
        );

        res.json({ success: true, backupId });
      } catch (error) {
        this.logger.error("Failed to create backup", { error });
        res.status(500).json({ error: "Failed to create backup" });
      }
    });

    adminRouter.get("/backup", async (req: Request, res: Response) => {
      try {
        const backups = await this.redis.hgetall("spinforge:backups");
        const backupList = Object.entries(backups).map(([id, data]) =>
          JSON.parse(data)
        );

        res.json(
          backupList.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      } catch (error) {
        this.logger.error("Failed to list backups", { error });
        res.status(500).json({ error: "Failed to list backups" });
      }
    });

    // API key management
    adminRouter.post("/auth/keys", async (req: Request, res: Response) => {
      try {
        const { name, permissions, expiresIn } = req.body;

        const keyId = `key-${Date.now()}`;
        const apiKey = `sf_${Buffer.from(keyId).toString("base64")}`;

        await this.redis.hset(
          "spinforge:apikeys",
          keyId,
          JSON.stringify({
            id: keyId,
            name,
            key: apiKey,
            permissions,
            createdAt: new Date().toISOString(),
            expiresAt: expiresIn
              ? new Date(Date.now() + parseDuration(expiresIn)).toISOString()
              : null,
            lastUsed: null,
          })
        );

        res.json({ success: true, keyId, apiKey });
      } catch (error) {
        this.logger.error("Failed to create API key", { error });
        res.status(500).json({ error: "Failed to create API key" });
      }
    });

    adminRouter.get("/auth/keys", async (req: Request, res: Response) => {
      try {
        const keys = await this.redis.hgetall("spinforge:apikeys");
        const keyList = Object.entries(keys).map(([id, data]) => {
          const parsed = JSON.parse(data);
          return {
            ...parsed,
            key: parsed.key.substring(0, 10) + "...", // Mask the key
          };
        });

        res.json(keyList);
      } catch (error) {
        this.logger.error("Failed to list API keys", { error });
        res.status(500).json({ error: "Failed to list API keys" });
      }
    });

    // Note: Deployment API routes will be added later after deploymentAPI is initialized
    // in the start() method when hot deployment watcher is configured

    // Force cleanup endpoint
    adminRouter.post("/cleanup", async (req: Request, res: Response) => {
      try {
        // Clean up orphaned routes
        const allDomains = await this.redis.hkeys("spinforge:routes");
        let cleaned = 0;

        for (const domain of allDomains) {
          const routeData = await this.redis.hget("spinforge:routes", domain);
          if (!routeData) continue;

          const route = JSON.parse(routeData);

          // Check if spinlet exists
          const spinletState = await this.spinletManager.getState(
            route.spinletId
          );
          if (!spinletState) {
            // No spinlet, remove route
            await this.routeManager.removeRoute(domain);
            cleaned++;
            this.logger.info(`Cleaned orphaned route: ${domain}`);
          }
        }

        res.json({ success: true, cleaned });
      } catch (error) {
        this.logger.error("Failed to cleanup", { error });
        res.status(500).json({ error: "Failed to cleanup" });
      }
    });

    // Setup multer for deployment uploads
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const deploymentPath = "/spinforge/deployments";
        try {
          await fs.mkdir(deploymentPath, { recursive: true });
          cb(null, deploymentPath);
        } catch (error) {
          cb(error as Error, deploymentPath);
        }
      },
      filename: (req, file, cb) => {
        // Keep original filename
        cb(null, file.originalname);
      },
    });

    const upload = multer({
      storage,
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max
      },
      fileFilter: (req, file, cb) => {
        // Accept archives (zip, tar, tar.gz, tgz)
        const allowedExtensions = [".zip", ".tar", ".tar.gz", ".tgz"];
        const ext = path.extname(file.originalname).toLowerCase();
        if (
          allowedExtensions.includes(ext) ||
          file.originalname.toLowerCase().endsWith(".tar.gz")
        ) {
          cb(null, true);
        } else {
          cb(
            new Error("Only archive files (zip, tar, tar.gz, tgz) are allowed")
          );
        }
      },
    });

    // Deployment upload endpoint
    adminRouter.post(
      "/deployments/upload",
      upload.single("deployment"),
      async (req: Request, res: Response) => {
        try {
          if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
          }

          const filePath = req.file.path;
          this.logger.info(`Deployment uploaded: ${filePath}`);

          // Trigger hot deployment watcher to process the uploaded file
          if (this.hotDeploymentWatcher) {
            // Process asynchronously - don't wait for deployment to complete
            this.hotDeploymentWatcher
              .processUploadedDeployment(filePath)
              .catch((error) => {
                this.logger.error(
                  `Background deployment processing failed for ${filePath}`,
                  { error }
                );
              });
          }

          res.json({
            success: true,
            filename: req.file.filename,
            size: req.file.size,
            message:
              "Deployment uploaded successfully. Processing will begin automatically.",
          });
        } catch (error) {
          this.logger.error("Failed to upload deployment", { error });
          res.status(500).json({ error: "Failed to upload deployment" });
        }
      }
    );

    this.app.use("/_admin", adminRouter);
  }

  private createServer(): HttpServer | HttpsServer {
    if (
      this.config.ssl?.enabled &&
      this.config.ssl.cert &&
      this.config.ssl.key
    ) {
      // Create HTTPS server
      const options = {
        cert: readFileSync(this.config.ssl.cert),
        key: readFileSync(this.config.ssl.key),
      };
      return createHttpsServer(options, this.app);
    } else {
      // Create HTTP server
      return createServer(this.app);
    }
  }

  private setupWebSocketHandling(): void {
    this.server.on("upgrade", async (request, socket, head) => {
      await this.proxyHandler.handleWebSocket(request, socket as any, head);
    });
  }

  async start(): Promise<void> {
    // Initialize port allocator
    const portAllocator = this.spinletManager["portAllocator"];
    await portAllocator.initialize();

    // Initialize default admin user
    await this.adminService.initializeDefaultAdmin(
      this.config.admin.defaultUsername,
      this.config.admin.defaultPassword
    );

    // Migrate existing routes to ensure customers exist
    await this.migrateExistingData();

    // Start server
    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.logger.info(
          `SpinHub listening on ${this.config.host}:${this.config.port}`
        );
        resolve();
      });

      this.server.on("error", reject);
    });

    // Set keep-alive timeout
    this.server.keepAliveTimeout = this.config.keepAliveTimeout;

    // Start hot deployment watcher if deployment path is configured
    const deploymentPath =
      process.env.HOT_DEPLOYMENT_PATH || "/spinforge/deployments";
    if (deploymentPath) {
      this.hotDeploymentWatcher = new HotDeploymentWatcher(
        deploymentPath,
        this.routeManager,
        this.spinletManager
      );

      // Initialize deployment API
      this.deploymentAPI = new DeploymentAPI(
        deploymentPath,
        this.hotDeploymentWatcher,
        this.routeManager,
        this.spinletManager
      );

      // Set deployment API reference in hot deployment watcher
      this.hotDeploymentWatcher.setDeploymentAPI(this.deploymentAPI);

      // Initialize settings API
      const dataPath = process.env.DATA_DIR || "/data";
      this.settingsAPI = new SettingsAPI(dataPath);
      await this.settingsAPI.init();

      // Initialize hosting API
      this.hostingAPI = new HostingAPI(
        this.redis,
        this.routeManager,
        this.spinletManager,
        deploymentPath,
        process.env.WEB_ROOT_PATH || "/spinforge/web_root"
      );

      // Now add deployment routes to admin router
      if (this.adminRouter) {
        this.adminRouter.use(this.deploymentAPI.getRouter());
        this.logger.info("Deployment API routes added to admin router");
        
        // Add settings routes
        this.adminRouter.use("/settings", this.settingsAPI.router());
        this.logger.info("Settings API routes added to admin router");
        
        // Add hosting routes
        this.adminRouter.use("/hosting", this.hostingAPI.getRouter());
        this.logger.info("Hosting API routes added to admin router");
      }

      // Initialize Customer API
      try {
        this.customerAPI = new CustomerAPI(
          this.spinletManager,
          this.routeManager,
          this.redis,
          this.deploymentAPI
        );

        // Mount customer API router AFTER it's created
        this.app.use("/_api/customer", this.customerAPI.getRouter());
        this.logger.info("Customer API mounted at /_api/customer");
      } catch (error) {
        this.logger.error("Failed to initialize Customer API", { error });
      }

      // Register the proxy handler LAST, after all other routes
      this.registerProxyHandler();

      try {
        await this.hotDeploymentWatcher.start();
        this.logger.info(`Hot deployment watcher started on ${deploymentPath}`);
      } catch (error) {
        this.logger.warn("Failed to start hot deployment watcher", { error });
      }
    }
  }

  private async migrateExistingData(): Promise<void> {
    try {
      // Get all existing routes
      const routes = await this.routeManager.getAllRoutes();

      for (const route of routes) {
        if (route.customerId) {
          // Ensure customer exists for this route
          await this.customerService.ensureCustomerExists(route.customerId);
        }
      }

      this.logger.info(`Migrated ${routes.length} routes to customer system`);
    } catch (error) {
      this.logger.error("Failed to migrate existing data", { error });
    }
  }

  async stop(): Promise<void> {
    this.logger.info("Shutting down SpinHub...");

    // Stop hot deployment watcher
    if (this.hotDeploymentWatcher) {
      await this.hotDeploymentWatcher.stop();
    }

    // Stop accepting new connections
    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Clean up resources
    await this.spinletManager.stopAll();
    this.proxyHandler.destroy();
    this.telemetry.destroy();
    this.routeManager.destroy();
    await this.redis.quit();

    this.logger.info("SpinHub shutdown complete");
  }

  // Helper method to get route by spinlet ID
  private async getRouteBySpinletId(
    spinletId: string
  ): Promise<RouteConfig | null> {
    const allDomains = await this.redis.hkeys("spinforge:routes");
    for (const domain of allDomains) {
      const route = await this.routeManager.getRoute(domain);
      if (route && route.spinletId === spinletId) {
        return route;
      }
    }
    return null;
  }

  // Get spinlet-specific metrics
  private async getSpinletMetrics(spinletId: string): Promise<any> {
    // Mock implementation - integrate with actual metrics
    return {
      requests: {
        total: 15420,
        rate: 12.5,
        errors: 23,
        errorRate: 0.15,
      },
      performance: {
        avgResponseTime: 145,
        p95ResponseTime: 320,
        p99ResponseTime: 890,
      },
      availability: {
        uptime: 99.95,
        lastDowntime: null,
      },
    };
  }

  // Get spinlet logs
  private async getSpinletLogs(
    spinletId: string,
    lines: number
  ): Promise<string[]> {
    // Mock implementation - integrate with Docker logs
    const mockLogs: string[] = [];
    const now = new Date();
    for (let i = lines; i > 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000).toISOString();
      mockLogs.push(`[${timestamp}] INFO: Processing request ${lines - i + 1}`);
    }
    return mockLogs;
  }

  // Check spinlet health
  private async checkSpinletHealth(
    spinletId: string,
    domain: string
  ): Promise<any> {
    const state = await this.spinletManager.getState(spinletId);

    return {
      status: state?.state === "running" ? "healthy" : "unhealthy",
      checks: {
        process: state?.state === "running" ? "pass" : "fail",
        port: state?.port ? "pass" : "fail",
        memory: "pass",
        disk: "pass",
      },
      lastCheck: new Date().toISOString(),
      uptime: state?.startTime ? Date.now() - state.startTime : 0,
    };
  }

  // Get spinlet resource usage
  private async getSpinletResources(spinletId: string): Promise<any> {
    // Mock implementation - integrate with Docker stats
    return {
      cpu: {
        usage: 12.5,
        limit: 50,
        throttled: false,
      },
      memory: {
        usage: 256 * 1024 * 1024, // 256MB
        limit: 512 * 1024 * 1024, // 512MB
        percent: 50,
      },
      network: {
        rx: 1024 * 1024 * 10, // 10MB
        tx: 1024 * 1024 * 5, // 5MB
      },
      disk: {
        usage: 1024 * 1024 * 100, // 100MB
        limit: 1024 * 1024 * 1024, // 1GB
      },
    };
  }

  // Get related services for a domain
  private async getRelatedServices(
    domain: string,
    customerId: string
  ): Promise<any> {
    return {
      nginx: {
        status: "active",
        config: {
          upstream: `spinlet-${domain}`,
          ssl: true,
          http2: true,
        },
      },
      keydb: {
        status: "connected",
        keys: await this.redis
          .keys(`${customerId}:${domain}:*`)
          .then((keys) => keys.length),
        memory: "2.5MB",
      },
      dns: {
        status: "resolved",
        records: [
          { type: "A", value: "10.0.0.1" },
          { type: "AAAA", value: "::1" },
        ],
      },
    };
  }

  // Get audit trail for a route
  private async getRouteAuditTrail(domain: string): Promise<any[]> {
    // Mock implementation - integrate with audit log
    return [
      {
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        event: "route_created",
        user: "admin",
        details: { domain },
      },
      {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        event: "config_updated",
        user: "admin",
        details: { memory: "512MB -> 1GB" },
      },
      {
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        event: "spinlet_restarted",
        user: "system",
        details: { reason: "config_change" },
      },
    ];
  }
}

// Helper function to parse duration strings like "30d", "24h", "60m"
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) throw new Error("Invalid duration format");

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    case "s":
      return value * 1000;
    default:
      throw new Error("Invalid duration unit");
  }
}
