export interface SpinletConfig {
  spinletId: string;
  customerId: string;
  buildPath: string;
  framework:
    | "nextjs"
    | "remix"
    | "static"
    | "custom"
    | "flutter"
    | "react"
    | "vue"
    | "astro"
    | "docker"
    | "node"
    | "nestjs"
    | "reverse-proxy";
  port?: number;
  env?: Record<string, string>;
  resources?: {
    memory?: string; // e.g., "512MB"
    cpu?: string; // e.g., "0.5"
  };
  domains?: string[]; // Optional domains for the spinlet
  mode?: 'development' | 'production'; // Deployment mode for watch/dev server support
}

export interface SpinletState {
  spinletId: string;
  customerId: string;
  pid: number;
  port: number;
  state: "starting" | "running" | "idle" | "stopping" | "stopped" | "crashed";
  startTime: number;
  lastAccess: number;
  requests: number;
  errors: number;
  memory: number;
  cpu: number;
  host: string;
  servicePath: string; // e.g., "localhost:40000"
  domains: string[]; // e.g., ["mynext.com", "www.mynext.com"]
}

export interface SpinletMetrics {
  timestamp: number;
  requests: number;
  errors: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  bytesIn: number;
  bytesOut: number;
}

export interface ResourceUsage {
  cpu: number; // percentage
  memory: number; // bytes
  memoryPercent: number;
  elapsed: number; // seconds since start
  timestamp: number;
}

export interface SpinletEvents {
  "spinlet:started": { spinletId: string; port: number };
  "spinlet:stopped": { spinletId: string; reason: string };
  "spinlet:crashed": { spinletId: string; error: Error };
  "spinlet:idle": { spinletId: string };
  "spinlet:active": { spinletId: string };
  "spinlet:error": { spinletId: string; error: Error };
}

export interface PortRange {
  start: number;
  end: number;
}
