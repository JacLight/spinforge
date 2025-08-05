import { SpinletState } from "@spinforge/spinlet-core";

export interface RouteConfig {
  domain: string;
  spinletId: string;
  customerId: string;
  buildPath: string;
  framework:
    | "reverse-proxy"
    | "nextjs"
    | "remix"
    | "node"
    | "static"
    | "custom"
    | "flutter"
    | "react"
    | "vue"
    | "astro"
    | "docker"
    | "nestjs";
  ssl?: {
    cert: string;
    key: string;
  };
  config?: {
    memory?: string;
    cpu?: string;
    env?: Record<string, string>;
    proxy?: any;
  };
}

export interface ProxyTarget {
  spinletId: string;
  port: number;
  host: string;
  state: SpinletState;
}

export interface RequestContext {
  requestId: string;
  domain: string;
  customerId: string;
  spinletId: string;
  startTime: number;
  method: string;
  path: string;
  ip: string;
  userAgent?: string;
}

export interface ProxyOptions {
  timeout?: number;
  retries?: number;
  preserveHostHeader?: boolean;
  xForwardedPrefix?: string;
  changeOrigin?: boolean;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

export interface HubConfig {
  port: number;
  host: string;
  trustProxy: boolean;
  maxRequestSize: string;
  requestTimeout: number;
  keepAliveTimeout: number;
  rateLimits: {
    global: RateLimitConfig;
    perCustomer: RateLimitConfig;
  };
  ssl?: {
    enabled: boolean;
    cert?: string;
    key?: string;
  };
  cors?: {
    origin: string | string[] | boolean;
    credentials: boolean;
    methods?: string[];
    allowedHeaders?: string[];
  };
}
