/**
 * SpinForge Deployment Configuration Schema
 *
 * This file defines the structure for deploy.yaml/deploy.json files
 * that can be placed in application folders for automatic deployment
 */

export interface DeploymentConfig {
  // Basic Information
  name: string; // Application name
  version?: string; // Application version
  description?: string; // Brief description

  // Deployment Target
  domain: string | string[]; // Domain(s) to deploy to
  customerId: string; // Customer identifier

  // Framework and Runtime
  framework:
    | "node"
    | "nextjs"
    | "remix"
    | "static"
    | "custom"
    | "flutter"
    | "react"
    | "vue"
    | "astro"
    | "docker"
    | "nestjs"
    | "reverse-proxy";
  runtime?: "node" | "python" | "ruby" | "php" | "static";
  nodeVersion?: string; // e.g., "18", "20"

  // Build Configuration
  build?: {
    command?: string; // Build command (e.g., "npm run build")
    outputDir?: string; // Build output directory (e.g., "dist", "build")
    env?: Record<string, string>; // Build-time environment variables
  };

  // Archive Settings (for zip/tar deployments)
  archive?: {
    extractTo?: string; // Where to extract files (default: deployment root)
    stripComponents?: number; // Number of leading path components to strip (default: auto-detect)
    rootDir?: string; // Expected root directory in archive (e.g., "build", "dist")
  };

  // Runtime Configuration
  start?: {
    command?: string; // Start command (e.g., "npm start", "node server.js")
    port?: number; // Port the app listens on (default: 3000)
    healthCheck?: {
      path?: string; // Health check endpoint (default: "/")
      interval?: number; // Check interval in seconds
      timeout?: number; // Timeout in seconds
    };
  };

  // Resources
  resources?: {
    memory?: string; // Memory limit (e.g., "512MB", "1GB")
    cpu?: number; // CPU limit (e.g., 0.5, 1, 2)
    disk?: string; // Disk space (e.g., "1GB")
  };

  // Environment Variables
  env?: Record<string, string>; // Runtime environment variables

  // Deployment Mode
  mode?: 'development' | 'production'; // Deployment mode for watch/dev server support

  // Scaling
  scaling?: {
    min?: number; // Minimum instances (default: 1)
    max?: number; // Maximum instances
    targetCPU?: number; // Target CPU % for autoscaling
  };

  // Networking
  networking?: {
    cors?:
      | boolean
      | {
          origins?: string[];
          methods?: string[];
          headers?: string[];
        };
    timeout?: number; // Request timeout in seconds
    maxBodySize?: string; // Max request body size (e.g., "10MB")
  };

  // Reverse Proxy Configuration (for reverse-proxy framework)
  proxy?: {
    target: string; // Target URL to proxy to (e.g., "http://localhost:4050")
    changeOrigin?: boolean; // Change the origin header to match target
    preserveHostHeader?: boolean; // Keep the original Host header
    headers?: Record<string, string>; // Additional headers to add
    rewrite?: {
      // Path rewriting rules
      [pattern: string]: string;
    };
  };

  // Dependencies
  dependencies?: {
    services?: string[]; // Required services (e.g., ["redis", "postgres"])
    volumes?: Array<{
      host: string; // Host path or volume name
      container: string; // Container path
      readOnly?: boolean;
    }>;
  };

  // Hooks
  hooks?: {
    preDeploy?: string | string[]; // Commands to run before deployment
    postDeploy?: string | string[]; // Commands to run after deployment
    preStop?: string | string[]; // Commands to run before stopping
  };

  // Monitoring
  monitoring?: {
    logs?: {
      level?: "debug" | "info" | "warn" | "error";
      format?: "json" | "text";
    };
    metrics?: {
      enabled?: boolean;
      path?: string; // Metrics endpoint path
    };
  };
}

// Example deploy.yaml:
/*
name: my-awesome-app
version: 1.0.0
description: My awesome Express application

domain: 
  - app.example.com
  - www.app.example.com
customerId: customer-123

framework: node
runtime: node
nodeVersion: "20"

build:
  command: npm install && npm run build
  outputDir: dist
  env:
    NODE_ENV: production

start:
  command: npm start
  port: 3000
  healthCheck:
    path: /health
    interval: 30
    timeout: 5

resources:
  memory: 512MB
  cpu: 0.5
  disk: 1GB

env:
  NODE_ENV: production
  API_KEY: ${SECRET_API_KEY}
  DATABASE_URL: ${SECRET_DATABASE_URL}

scaling:
  min: 1
  max: 3
  targetCPU: 70

networking:
  cors: true
  timeout: 30
  maxBodySize: 10MB

dependencies:
  services:
    - redis
  volumes:
    - host: ./uploads
      container: /app/uploads
    - host: logs-volume
      container: /app/logs

hooks:
  preDeploy:
    - npm run migrate
  postDeploy:
    - npm run seed
    - curl -X POST https://hooks.example.com/deployed

monitoring:
  logs:
    level: info
    format: json
  metrics:
    enabled: true
    path: /metrics
*/

// Example deploy.json:
/*
{
  "name": "my-static-site",
  "version": "2.0.0",
  "domain": "static.example.com",
  "customerId": "customer-456",
  "framework": "static",
  "runtime": "static",
  "build": {
    "command": "npm run build",
    "outputDir": "public"
  },
  "resources": {
    "memory": "128MB",
    "cpu": 0.1
  },
  "networking": {
    "cors": {
      "origins": ["https://example.com"],
      "methods": ["GET", "POST"],
      "headers": ["Content-Type"]
    }
  }
}
*/
