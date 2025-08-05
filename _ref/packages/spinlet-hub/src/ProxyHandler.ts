import httpProxy from 'http-proxy';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { SpinletManager, SpinletConfig } from '@spinforge/spinlet-core';
import { createLogger, TelemetryCollector } from '@spinforge/shared';
import { RouteManager } from './RouteManager';
import { RequestContext, ProxyTarget, ProxyOptions } from './types';
import { nanoid } from 'nanoid';

export class ProxyHandler {
  private proxy: httpProxy;
  private spinletManager: SpinletManager;
  private routeManager: RouteManager;
  private telemetry: TelemetryCollector;
  private logger = createLogger('ProxyHandler');
  private activeRequests: Map<string, RequestContext> = new Map();
  
  private readonly defaultOptions: ProxyOptions = {
    timeout: 30000,
    retries: 3,
    preserveHostHeader: true,
    changeOrigin: false
  };

  constructor(
    spinletManager: SpinletManager,
    routeManager: RouteManager,
    telemetry: TelemetryCollector,
    options?: Partial<ProxyOptions>
  ) {
    this.spinletManager = spinletManager;
    this.routeManager = routeManager;
    this.telemetry = telemetry;
    
    this.proxy = httpProxy.createProxyServer({
      xfwd: true,
      ws: true,
      timeout: options?.timeout || this.defaultOptions.timeout,
      proxyTimeout: options?.timeout || this.defaultOptions.timeout,
      changeOrigin: options?.changeOrigin || this.defaultOptions.changeOrigin
    });

    this.setupProxyHandlers();
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = nanoid();
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
      const context: RequestContext = {
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

      // Handle static sites differently
      if (route.framework === 'static') {
        // For static sites, serve files directly
        const staticPath = route.buildPath.startsWith('/') 
          ? route.buildPath 
          : `/deployments/${route.buildPath}`;
        
        this.logger.debug('Serving static content', {
          requestId,
          domain,
          staticPath,
          requestedPath: req.url
        });

        // Import required modules
        const path = require('path');
        const fs = require('fs');
        const mime = require('mime-types');
        
        // Construct file path
        const requestPath = req.url || '/';
        const filePath = path.join(staticPath, requestPath === '/' ? 'index.html' : requestPath);
        
        // Security: prevent directory traversal
        if (!filePath.startsWith(staticPath)) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }
        
        // Check if file exists
        fs.stat(filePath, (err: any, stats: any) => {
          if (err || !stats.isFile()) {
            // Try index.html for directories
            if (!err && stats.isDirectory()) {
              const indexPath = path.join(filePath, 'index.html');
              fs.stat(indexPath, (err2: any, stats2: any) => {
                if (!err2 && stats2.isFile()) {
                  this.serveStaticFile(indexPath, res);
                } else {
                  res.writeHead(404, { 'Content-Type': 'text/plain' });
                  res.end('Not Found');
                }
              });
            } else {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not Found');
            }
          } else {
            this.serveStaticFile(filePath, res);
          }
        });
        
        // Record metrics
        await this.recordMetrics(context, 200, 0, 0, false);
        return;
      }

      // Handle reverse-proxy sites
      if (route.framework === 'reverse-proxy') {
        const proxyConfig = route.config?.proxy;
        if (!proxyConfig?.target) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Reverse proxy target not configured');
          return;
        }

        this.logger.debug('Proxying to target', {
          requestId,
          domain,
          target: proxyConfig.target,
          requestedPath: req.url
        });

        // Parse target URL
        const targetUrl = new URL(proxyConfig.target);
        
        // Apply path rewriting if configured
        let targetPath = req.url || '/';
        if (proxyConfig.rewrite) {
          for (const [pattern, replacement] of Object.entries(proxyConfig.rewrite)) {
            targetPath = targetPath.replace(new RegExp(pattern), replacement as string);
          }
        }

        // Set up proxy options
        const proxyOptions: any = {
          target: `${targetUrl.protocol}//${targetUrl.host}`,
          changeOrigin: proxyConfig.changeOrigin !== false, // Default true
          headers: {
            'X-Forwarded-Host': domain,
            'X-Forwarded-Proto': 'http', // Would be https in production
            'X-Real-IP': this.getClientIp(req),
            ...proxyConfig.headers
          }
        };

        // Preserve host header if requested
        if (proxyConfig.preserveHostHeader) {
          proxyOptions.headers['Host'] = req.headers.host;
        }

        // Update the request URL to include the target path
        req.url = targetPath;

        // Proxy the request
        this.proxy.web(req, res, proxyOptions);
        
        // Record metrics
        await this.recordMetrics(context, 200, 0, 0, false);
        return;
      }

      // For non-static, non-proxy sites, ensure spinlet is running
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

    } catch (error) {
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

  async handleWebSocket(req: IncomingMessage, socket: Socket, head: Buffer): Promise<void> {
    const requestId = nanoid();
    
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

    } catch (error) {
      this.logger.error('WebSocket handling error', { requestId, error });
      socket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    }
  }

  private setupProxyHandlers(): void {
    // Handle successful proxy
    this.proxy.on('proxyRes', async (proxyRes, req, res) => {
      const requestId = req.headers['x-spinlet-request-id'] as string;
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
      const requestId = (req as any).headers?.['x-spinlet-request-id'] as string;
      const context = requestId ? this.activeRequests.get(requestId) : null;
      
      this.logger.error('Proxy error', { requestId, error: err });
      
      if (res && 'headersSent' in res && !res.headersSent) {
        (res as any).writeHead(502, { 'Content-Type': 'text/plain' });
        (res as any).end('Bad Gateway');
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

  private async ensureSpinletRunning(route: any): Promise<ProxyTarget> {
    // Check if spinlet is already running
    let state = await this.spinletManager.getState(route.spinletId);
    
    if (!state || state.state !== 'running') {
      // Spawn the spinlet
      const config: SpinletConfig = {
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
    } else {
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

  private extractDomain(req: IncomingMessage): string | null {
    const host = req.headers.host;
    if (!host) return null;
    
    // Remove port if present
    const domain = host.split(':')[0];
    return domain.toLowerCase();
  }

  private getClientIp(req: IncomingMessage): string {
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

  private addProxyHeaders(req: IncomingMessage, context: RequestContext): void {
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

  private async recordMetrics(
    context: RequestContext,
    statusCode: number,
    bytesIn: number,
    bytesOut: number,
    isError: boolean
  ): Promise<void> {
    const latency = Date.now() - context.startTime;
    
    // Record request metrics
    await this.telemetry.recordRequest(
      context.spinletId,
      latency,
      bytesIn,
      bytesOut,
      isError || statusCode >= 400
    );
    
    // Update spinlet request count
    await this.spinletManager.incrementRequests(
      context.spinletId,
      isError || statusCode >= 400 ? 1 : 0
    );
    
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

  private serveStaticFile(filePath: string, res: ServerResponse): void {
    const fs = require('fs');
    const path = require('path');
    const mime = require('mime-types');
    
    // Get mime type
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    
    // Read and serve file
    fs.readFile(filePath, (err: any, data: Buffer) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }
      
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': data.length,
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(data);
    });
  }

  destroy(): void {
    this.proxy.close();
    this.activeRequests.clear();
  }
}