import express, { Application, Request, Response, NextFunction } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { createServer as createHttpsServer, Server as HttpsServer } from 'https';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { SpinletManager } from '@spinforge/spinlet-core';
import { createLogger, createRedisClient, RedisHelper, TelemetryCollector } from '@spinforge/shared';
import { RouteManager } from './RouteManager';
import { ProxyHandler } from './ProxyHandler';
import { HubConfig } from './types';
import { readFileSync } from 'fs';

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
  private logger = createLogger('SpinHub');

  constructor(config: Partial<HubConfig> = {}) {
    this.config = this.buildConfig(config);
    this.app = express();
    this.redis = createRedisClient();
    this.redisHelper = new RedisHelper(this.redis);
    this.spinletManager = new SpinletManager(this.redis);
    this.routeManager = new RouteManager(this.redis);
    this.telemetry = new TelemetryCollector(this.redisHelper);
    this.proxyHandler = new ProxyHandler(
      this.spinletManager,
      this.routeManager,
      this.telemetry
    );

    this.setupMiddleware();
    this.setupRoutes();
    this.server = this.createServer();
    this.setupWebSocketHandling();
  }

  private buildConfig(partial: Partial<HubConfig>): HubConfig {
    return {
      port: partial.port || parseInt(process.env.PORT || '8080'),
      host: partial.host || process.env.HOST || '0.0.0.0',
      trustProxy: partial.trustProxy ?? true,
      maxRequestSize: partial.maxRequestSize || '10mb',
      requestTimeout: partial.requestTimeout || 30000,
      keepAliveTimeout: partial.keepAliveTimeout || 65000,
      rateLimits: partial.rateLimits || {
        global: {
          windowMs: 60 * 1000, // 1 minute
          max: 1000, // 1000 requests per minute
          standardHeaders: true,
          legacyHeaders: false
        },
        perCustomer: {
          windowMs: 60 * 1000,
          max: 100, // 100 requests per minute per customer
          standardHeaders: true,
          legacyHeaders: false
        }
      },
      ssl: partial.ssl,
      cors: partial.cors || {
        origin: true,
        credentials: true
      }
    };
  }

  private setupMiddleware(): void {
    // Trust proxy
    if (this.config.trustProxy) {
      this.app.set('trust proxy', true);
    }

    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable CSP as we're proxying various apps
      crossOriginEmbedderPolicy: false
    }));

    // Compression
    this.app.use(compression());

    // CORS
    if (this.config.cors) {
      this.app.use(cors(this.config.cors as any));
    }

    // Body parsing
    this.app.use(express.json({ limit: this.config.maxRequestSize }));
    this.app.use(express.urlencoded({ extended: true, limit: this.config.maxRequestSize }));

    // Global rate limiting
    const globalLimiter = rateLimit(this.config.rateLimits.global);
    this.app.use(globalLimiter);

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.debug('Request completed', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          ip: req.ip
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
    this.app.get('/_health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Metrics endpoint
    this.app.get('/_metrics', async (req: Request, res: Response) => {
      try {
        const activeSpinlets = await this.redis.zcard('spinforge:active');
        const allocatedPorts = await this.redis.hlen('spinforge:ports:allocated');
        
        res.json({
          activeSpinlets,
          allocatedPorts,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch metrics' });
      }
    });

    // Admin API routes (should be protected in production)
    this.setupAdminRoutes();

    // Proxy all other requests
    this.app.use(async (req: Request, res: Response) => {
      await this.proxyHandler.handleRequest(req, res);
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error', { error: err, path: req.path });
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
    });
  }

  private setupAdminRoutes(): void {
    const adminRouter = express.Router();

    // Per-customer rate limiting for admin routes
    const customerLimiter = rateLimit({
      ...this.config.rateLimits.perCustomer,
      keyGenerator: (req) => req.body.customerId || req.params.customerId || 'unknown'
    });

    adminRouter.use(customerLimiter);

    // Add route
    adminRouter.post('/routes', async (req: Request, res: Response) => {
      try {
        const { domain, customerId, spinletId, buildPath, framework, config } = req.body;
        
        // Validate input
        if (!domain || !customerId || !spinletId || !buildPath || !framework) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate domain
        const validation = await this.routeManager.validateRoute(domain);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.reason });
        }

        // Add route
        await this.routeManager.addRoute({
          domain,
          customerId,
          spinletId,
          buildPath,
          framework,
          config
        });

        res.json({ success: true, domain });
      } catch (error) {
        this.logger.error('Failed to add route', { error });
        res.status(500).json({ error: 'Failed to add route' });
      }
    });

    // Remove route
    adminRouter.delete('/routes/:domain', async (req: Request, res: Response) => {
      try {
        await this.routeManager.removeRoute(req.params.domain);
        res.json({ success: true });
      } catch (error) {
        this.logger.error('Failed to remove route', { error });
        res.status(500).json({ error: 'Failed to remove route' });
      }
    });

    // Get routes for customer
    adminRouter.get('/customers/:customerId/routes', async (req: Request, res: Response) => {
      try {
        const domains = await this.routeManager.getCustomerDomains(req.params.customerId);
        const routes = await Promise.all(
          domains.map(domain => this.routeManager.getRoute(domain))
        );
        
        res.json(routes.filter(Boolean));
      } catch (error) {
        this.logger.error('Failed to get customer routes', { error });
        res.status(500).json({ error: 'Failed to get routes' });
      }
    });

    // Stop spinlet
    adminRouter.post('/spinlets/:spinletId/stop', async (req: Request, res: Response) => {
      try {
        await this.spinletManager.stop(req.params.spinletId, 'admin');
        res.json({ success: true });
      } catch (error) {
        this.logger.error('Failed to stop spinlet', { error });
        res.status(500).json({ error: 'Failed to stop spinlet' });
      }
    });

    // Get spinlet state
    adminRouter.get('/spinlets/:spinletId', async (req: Request, res: Response) => {
      try {
        const state = await this.spinletManager.getState(req.params.spinletId);
        if (!state) {
          return res.status(404).json({ error: 'Spinlet not found' });
        }
        res.json(state);
      } catch (error) {
        this.logger.error('Failed to get spinlet state', { error });
        res.status(500).json({ error: 'Failed to get spinlet state' });
      }
    });

    this.app.use('/_admin', adminRouter);
  }

  private createServer(): HttpServer | HttpsServer {
    if (this.config.ssl?.enabled && this.config.ssl.cert && this.config.ssl.key) {
      // Create HTTPS server
      const options = {
        cert: readFileSync(this.config.ssl.cert),
        key: readFileSync(this.config.ssl.key)
      };
      return createHttpsServer(options, this.app);
    } else {
      // Create HTTP server
      return createServer(this.app);
    }
  }

  private setupWebSocketHandling(): void {
    this.server.on('upgrade', async (request, socket, head) => {
      await this.proxyHandler.handleWebSocket(request, socket, head);
    });
  }

  async start(): Promise<void> {
    // Initialize port allocator
    const portAllocator = this.spinletManager['portAllocator'];
    await portAllocator.initialize();

    // Start server
    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.logger.info(`SpinHub listening on ${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });

    // Set keep-alive timeout
    this.server.keepAliveTimeout = this.config.keepAliveTimeout;
  }

  async stop(): Promise<void> {
    this.logger.info('Shutting down SpinHub...');

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

    this.logger.info('SpinHub shutdown complete');
  }
}