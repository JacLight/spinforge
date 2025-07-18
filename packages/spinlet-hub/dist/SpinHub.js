"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinHub = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const https_1 = require("https");
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const spinlet_core_1 = require("@spinforge/spinlet-core");
const shared_1 = require("@spinforge/shared");
const RouteManager_1 = require("./RouteManager");
const ProxyHandler_1 = require("./ProxyHandler");
const fs_1 = require("fs");
class SpinHub {
    app;
    server;
    config;
    redis;
    redisHelper;
    spinletManager;
    routeManager;
    proxyHandler;
    telemetry;
    logger = (0, shared_1.createLogger)('SpinHub');
    constructor(config = {}) {
        this.config = this.buildConfig(config);
        this.app = (0, express_1.default)();
        this.redis = (0, shared_1.createRedisClient)();
        this.redisHelper = new shared_1.RedisHelper(this.redis);
        this.spinletManager = new spinlet_core_1.SpinletManager(this.redis);
        this.routeManager = new RouteManager_1.RouteManager(this.redis);
        this.telemetry = new shared_1.TelemetryCollector(this.redisHelper);
        this.proxyHandler = new ProxyHandler_1.ProxyHandler(this.spinletManager, this.routeManager, this.telemetry);
        this.setupMiddleware();
        this.setupRoutes();
        this.server = this.createServer();
        this.setupWebSocketHandling();
    }
    buildConfig(partial) {
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
    setupMiddleware() {
        // Trust proxy
        if (this.config.trustProxy) {
            this.app.set('trust proxy', true);
        }
        // Security headers
        this.app.use((0, helmet_1.default)({
            contentSecurityPolicy: false, // Disable CSP as we're proxying various apps
            crossOriginEmbedderPolicy: false
        }));
        // Compression
        this.app.use((0, compression_1.default)());
        // CORS
        if (this.config.cors) {
            this.app.use((0, cors_1.default)(this.config.cors));
        }
        // Body parsing
        this.app.use(express_1.default.json({ limit: this.config.maxRequestSize }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: this.config.maxRequestSize }));
        // Global rate limiting
        const globalLimiter = (0, express_rate_limit_1.default)(this.config.rateLimits.global);
        this.app.use(globalLimiter);
        // Request logging
        this.app.use((req, res, next) => {
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
        this.app.use((req, res, next) => {
            req.setTimeout(this.config.requestTimeout);
            res.setTimeout(this.config.requestTimeout);
            next();
        });
    }
    setupRoutes() {
        // Health check endpoint
        this.app.get('/_health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });
        // Metrics endpoint
        this.app.get('/_metrics', async (req, res) => {
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
            }
            catch (error) {
                res.status(500).json({ error: 'Failed to fetch metrics' });
            }
        });
        // Admin API routes (should be protected in production)
        this.setupAdminRoutes();
        // Proxy all other requests
        this.app.use(async (req, res) => {
            await this.proxyHandler.handleRequest(req, res);
        });
        // Error handler
        this.app.use((err, req, res, next) => {
            this.logger.error('Unhandled error', { error: err, path: req.path });
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: process.env.NODE_ENV === 'development' ? err.message : undefined
                });
            }
        });
    }
    setupAdminRoutes() {
        const adminRouter = express_1.default.Router();
        // Per-customer rate limiting for admin routes
        const customerLimiter = (0, express_rate_limit_1.default)({
            ...this.config.rateLimits.perCustomer,
            keyGenerator: (req) => req.body.customerId || req.params.customerId || 'unknown'
        });
        adminRouter.use(customerLimiter);
        // Add route
        adminRouter.post('/routes', async (req, res) => {
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
            }
            catch (error) {
                this.logger.error('Failed to add route', { error });
                res.status(500).json({ error: 'Failed to add route' });
            }
        });
        // Remove route
        adminRouter.delete('/routes/:domain', async (req, res) => {
            try {
                await this.routeManager.removeRoute(req.params.domain);
                res.json({ success: true });
            }
            catch (error) {
                this.logger.error('Failed to remove route', { error });
                res.status(500).json({ error: 'Failed to remove route' });
            }
        });
        // Get routes for customer
        adminRouter.get('/customers/:customerId/routes', async (req, res) => {
            try {
                const domains = await this.routeManager.getCustomerDomains(req.params.customerId);
                const routes = await Promise.all(domains.map(domain => this.routeManager.getRoute(domain)));
                res.json(routes.filter(Boolean));
            }
            catch (error) {
                this.logger.error('Failed to get customer routes', { error });
                res.status(500).json({ error: 'Failed to get routes' });
            }
        });
        // Stop spinlet
        adminRouter.post('/spinlets/:spinletId/stop', async (req, res) => {
            try {
                await this.spinletManager.stop(req.params.spinletId, 'admin');
                res.json({ success: true });
            }
            catch (error) {
                this.logger.error('Failed to stop spinlet', { error });
                res.status(500).json({ error: 'Failed to stop spinlet' });
            }
        });
        // Get spinlet state
        adminRouter.get('/spinlets/:spinletId', async (req, res) => {
            try {
                const state = await this.spinletManager.getState(req.params.spinletId);
                if (!state) {
                    return res.status(404).json({ error: 'Spinlet not found' });
                }
                res.json(state);
            }
            catch (error) {
                this.logger.error('Failed to get spinlet state', { error });
                res.status(500).json({ error: 'Failed to get spinlet state' });
            }
        });
        this.app.use('/_admin', adminRouter);
    }
    createServer() {
        if (this.config.ssl?.enabled && this.config.ssl.cert && this.config.ssl.key) {
            // Create HTTPS server
            const options = {
                cert: (0, fs_1.readFileSync)(this.config.ssl.cert),
                key: (0, fs_1.readFileSync)(this.config.ssl.key)
            };
            return (0, https_1.createServer)(options, this.app);
        }
        else {
            // Create HTTP server
            return (0, http_1.createServer)(this.app);
        }
    }
    setupWebSocketHandling() {
        this.server.on('upgrade', async (request, socket, head) => {
            await this.proxyHandler.handleWebSocket(request, socket, head);
        });
    }
    async start() {
        // Initialize port allocator
        const portAllocator = this.spinletManager['portAllocator'];
        await portAllocator.initialize();
        // Start server
        await new Promise((resolve, reject) => {
            this.server.listen(this.config.port, this.config.host, () => {
                this.logger.info(`SpinHub listening on ${this.config.host}:${this.config.port}`);
                resolve();
            });
            this.server.on('error', reject);
        });
        // Set keep-alive timeout
        this.server.keepAliveTimeout = this.config.keepAliveTimeout;
    }
    async stop() {
        this.logger.info('Shutting down SpinHub...');
        // Stop accepting new connections
        await new Promise((resolve, reject) => {
            this.server.close((err) => {
                if (err)
                    reject(err);
                else
                    resolve();
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
exports.SpinHub = SpinHub;
//# sourceMappingURL=SpinHub.js.map