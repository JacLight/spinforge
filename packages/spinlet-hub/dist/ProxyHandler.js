"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyHandler = void 0;
const http_proxy_1 = __importDefault(require("http-proxy"));
const shared_1 = require("@spinforge/shared");
const nanoid_1 = require("nanoid");
class ProxyHandler {
    proxy;
    spinletManager;
    routeManager;
    telemetry;
    logger = (0, shared_1.createLogger)('ProxyHandler');
    activeRequests = new Map();
    defaultOptions = {
        timeout: 30000,
        retries: 3,
        preserveHostHeader: true,
        changeOrigin: false
    };
    constructor(spinletManager, routeManager, telemetry, options) {
        this.spinletManager = spinletManager;
        this.routeManager = routeManager;
        this.telemetry = telemetry;
        this.proxy = http_proxy_1.default.createProxyServer({
            xfwd: true,
            ws: true,
            timeout: options?.timeout || this.defaultOptions.timeout,
            proxyTimeout: options?.timeout || this.defaultOptions.timeout,
            changeOrigin: options?.changeOrigin || this.defaultOptions.changeOrigin
        });
        this.setupProxyHandlers();
    }
    async handleRequest(req, res) {
        const requestId = (0, nanoid_1.nanoid)();
        const startTime = Date.now();
        try {
            // Extract domain from host header
            const domain = this.extractDomain(req);
            if (!domain) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Bad Request: Missing Host header');
                return;
            }
            // Get route configuration
            const route = await this.routeManager.getRoute(domain);
            if (!route) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found: No application configured for this domain');
                return;
            }
            // Create request context
            const context = {
                requestId,
                domain,
                customerId: route.customerId,
                spinletId: route.spinletId,
                startTime,
                method: req.method || 'GET',
                path: req.url || '/',
                ip: this.getClientIp(req),
                userAgent: req.headers['user-agent']
            };
            this.activeRequests.set(requestId, context);
            // Ensure spinlet is running
            const target = await this.ensureSpinletRunning(route);
            // Update request headers
            this.addProxyHeaders(req, context);
            // Proxy the request
            this.logger.debug('Proxying request', {
                requestId,
                domain,
                target: `http://${target.host}:${target.port}`,
                path: req.url
            });
            this.proxy.web(req, res, {
                target: `http://${target.host}:${target.port}`,
                headers: {
                    'X-Spinlet-Request-Id': requestId,
                    'X-Spinlet-Domain': domain
                }
            });
        }
        catch (error) {
            this.logger.error('Request handling error', { requestId, error });
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
            }
            // Record error metric
            const context = this.activeRequests.get(requestId);
            if (context) {
                await this.recordMetrics(context, 500, 0, 0, true);
            }
        }
    }
    async handleWebSocket(req, socket, head) {
        const requestId = (0, nanoid_1.nanoid)();
        try {
            const domain = this.extractDomain(req);
            if (!domain) {
                socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
                return;
            }
            const route = await this.routeManager.getRoute(domain);
            if (!route) {
                socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
                return;
            }
            // Ensure spinlet is running
            const target = await this.ensureSpinletRunning(route);
            // Proxy WebSocket connection
            this.logger.debug('Proxying WebSocket', {
                requestId,
                domain,
                target: `ws://${target.host}:${target.port}`
            });
            this.proxy.ws(req, socket, head, {
                target: `ws://${target.host}:${target.port}`,
                ws: true
            });
        }
        catch (error) {
            this.logger.error('WebSocket handling error', { requestId, error });
            socket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        }
    }
    setupProxyHandlers() {
        // Handle successful proxy
        this.proxy.on('proxyRes', async (proxyRes, req, res) => {
            const requestId = req.headers['x-spinlet-request-id'];
            const context = this.activeRequests.get(requestId);
            if (context) {
                const latency = Date.now() - context.startTime;
                const statusCode = proxyRes.statusCode || 200;
                // Estimate bytes (in production, use actual measurements)
                const bytesIn = parseInt(req.headers['content-length'] || '0');
                const bytesOut = parseInt(proxyRes.headers['content-length'] || '0');
                await this.recordMetrics(context, statusCode, bytesIn, bytesOut, false);
                this.logger.debug('Request completed', {
                    requestId,
                    statusCode,
                    latency,
                    domain: context.domain
                });
                this.activeRequests.delete(requestId);
            }
        });
        // Handle proxy errors
        this.proxy.on('error', async (err, req, res) => {
            const requestId = req.headers?.['x-spinlet-request-id'];
            const context = requestId ? this.activeRequests.get(requestId) : null;
            this.logger.error('Proxy error', { requestId, error: err });
            if (res && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'text/plain' });
                res.end('Bad Gateway');
            }
            if (context) {
                await this.recordMetrics(context, 502, 0, 0, true);
                this.activeRequests.delete(requestId);
            }
        });
        // Handle WebSocket errors
        this.proxy.on('error', (err, req, socket) => {
            this.logger.error('WebSocket proxy error', { error: err });
            socket.end();
        });
    }
    async ensureSpinletRunning(route) {
        // Check if spinlet is already running
        let state = await this.spinletManager.getState(route.spinletId);
        if (!state || state.state !== 'running') {
            // Spawn the spinlet
            const config = {
                spinletId: route.spinletId,
                customerId: route.customerId,
                buildPath: route.buildPath,
                framework: route.framework,
                env: route.config?.env,
                resources: {
                    memory: route.config?.memory,
                    cpu: route.config?.cpu
                }
            };
            state = await this.spinletManager.spawn(config);
        }
        else {
            // Update last access time
            await this.spinletManager.updateLastAccess(route.spinletId);
        }
        return {
            spinletId: state.spinletId,
            port: state.port,
            host: state.host || 'localhost',
            state
        };
    }
    extractDomain(req) {
        const host = req.headers.host;
        if (!host)
            return null;
        // Remove port if present
        const domain = host.split(':')[0];
        return domain.toLowerCase();
    }
    getClientIp(req) {
        // Check X-Forwarded-For header
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
            return ips[0].trim();
        }
        // Check X-Real-IP header
        const realIp = req.headers['x-real-ip'];
        if (realIp) {
            return typeof realIp === 'string' ? realIp : realIp[0];
        }
        // Fall back to socket address
        return req.socket.remoteAddress || 'unknown';
    }
    addProxyHeaders(req, context) {
        // Add standard proxy headers
        req.headers['x-forwarded-for'] = context.ip;
        req.headers['x-forwarded-proto'] = 'http'; // Update based on actual protocol
        req.headers['x-forwarded-host'] = context.domain;
        req.headers['x-request-id'] = context.requestId;
        // Add SpinForge specific headers
        req.headers['x-spinlet-id'] = context.spinletId;
        req.headers['x-spinlet-customer'] = context.customerId;
        req.headers['x-spinlet-request-start'] = context.startTime.toString();
    }
    async recordMetrics(context, statusCode, bytesIn, bytesOut, isError) {
        const latency = Date.now() - context.startTime;
        // Record request metrics
        await this.telemetry.recordRequest(context.spinletId, latency, bytesIn, bytesOut, isError || statusCode >= 400);
        // Update spinlet request count
        await this.spinletManager.incrementRequests(context.spinletId, isError || statusCode >= 400 ? 1 : 0);
        // Record audit event for errors
        if (isError || statusCode >= 500) {
            await this.telemetry.recordEvent({
                spinletId: context.spinletId,
                customerId: context.customerId,
                event: 'request_error',
                timestamp: Date.now(),
                data: {
                    requestId: context.requestId,
                    statusCode,
                    latency,
                    method: context.method,
                    path: context.path,
                    domain: context.domain
                }
            });
        }
    }
    destroy() {
        this.proxy.close();
        this.activeRequests.clear();
    }
}
exports.ProxyHandler = ProxyHandler;
//# sourceMappingURL=ProxyHandler.js.map