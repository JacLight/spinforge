# SpinForge Environment Configuration

This document describes how to configure SpinForge for different environments (development, staging, production).

## Overview

SpinForge uses environment variables to configure services across different environments. Configuration is centralized through:

1. Environment-specific `.env` files (`.env.development`, `.env.staging`, `.env.production`)
2. A shared configuration module (`packages/shared/src/config.ts`)
3. Environment-aware Docker Compose configurations

## Quick Start

### Setting Up an Environment

```bash
# Set up for development (default)
./scripts/env-setup.sh development

# Set up for staging
./scripts/env-setup.sh staging

# Set up for production
./scripts/env-setup.sh production
```

This script will:
- Copy the appropriate `.env.{environment}` file to `.env`
- Create necessary directories
- Set up authentication for the CLI (development only)
- Build shared packages (development only)

### Starting Services

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d redis hub ui

# View logs
docker-compose logs -f hub
```

## Environment Variables

### Core Configuration

| Variable | Description | Default (Dev) | Default (Prod) |
|----------|-------------|---------------|----------------|
| `NODE_ENV` | Environment mode | `development` | `production` |
| `SPINFORGE_API_URL` | API service URL | `http://localhost:9006` | `https://api.spinforge.dev` |
| `SPINFORGE_WEB_URL` | Web UI URL | `http://localhost:9010` | `https://spinforge.dev` |
| `SPINFORGE_AUTH_URL` | Auth service URL | `http://localhost:3000` | `https://auth.spinforge.dev` |

### Redis Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `16378` |
| `REDIS_PASSWORD` | Redis password | (none in dev) |
| `REDIS_DB` | Redis database | `0` |

### Deployment Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SPINFORGE_DEPLOYMENTS` | Deployment directory | `/Users/{user}/.spinforge/deployments` |
| `SPINLET_STARTUP_TIMEOUT_MS` | Startup timeout | `300000` (5 min) |
| `IDLE_TIMEOUT_MS` | Idle timeout | `300000` (5 min) |
| `PORT_RANGE_START` | Port allocation start | `10000` |
| `PORT_RANGE_END` | Port allocation end | `20000` |

### Security Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_SECRET` | Authentication secret | `dev-secret-key` |
| `JWT_SECRET` | JWT signing secret | `dev-jwt-secret` |
| `ADMIN_TOKEN` | Admin API token | `admin-token` |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:3000,http://localhost:9010` |

### Feature Flags

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_HOT_RELOAD` | Enable hot deployment | `true` (dev only) |
| `ENABLE_METRICS` | Enable metrics collection | `true` |
| `ENABLE_TELEMETRY` | Enable telemetry | `false` (dev) |

## Using Configuration in Code

### In Node.js Services

```typescript
import { config, getApiUrl, isDevelopment } from '@spinforge/shared';

// Get full configuration
const cfg = config.get();
console.log(`Running in ${cfg.env} mode`);

// Use helper functions
const apiUrl = getApiUrl();
const isDevMode = isDevelopment();

// Access specific config
const redisConfig = config.get().redis;
const deploymentDir = config.get().deployment.baseDir;
```

### In the CLI

The CLI automatically detects the environment and uses appropriate URLs:

```bash
# Set environment
export NODE_ENV=production

# CLI will use production URLs
spinforge deploy ./my-app

# Override specific URLs
export SPINFORGE_API_URL=https://custom-api.example.com
spinforge status
```

### In Docker Compose

Environment variables are automatically passed to containers:

```yaml
services:
  hub:
    environment:
      - NODE_ENV=${NODE_ENV:-development}
      - SPINFORGE_API_URL=${SPINFORGE_API_URL:-http://localhost:9006}
      - REDIS_HOST=${REDIS_HOST:-redis}
```

## Environment-Specific Configurations

### Development

- Uses local URLs (localhost)
- Enables hot reload
- Debug logging
- No authentication required for local development
- Shorter timeouts for faster iteration

### Staging

- Uses staging URLs (staging.spinforge.dev)
- Real authentication required
- Production-like configuration
- Debug logging enabled
- Metrics and telemetry enabled

### Production

- Uses production URLs (spinforge.dev)
- Strict authentication
- Info-level logging in JSON format
- All monitoring enabled
- Longer timeouts for stability

## CLI Authentication

### Development
```bash
# Automatic setup with env-setup.sh
./scripts/env-setup.sh development

# Or manual setup
spinforge login --token local-dev-token
```

### Staging/Production
```bash
# Browser-based authentication
spinforge login

# Token-based authentication
spinforge login --token your-api-token

# Environment variable
export SPINFORGE_TOKEN=your-api-token
spinforge deploy ./app
```

## Docker Deployment

### Development
```bash
# Use environment-aware compose file
docker-compose -f docker-compose.env.yml up -d
```

### Production
```bash
# Set production environment
export NODE_ENV=production

# Load production environment variables
source .env.production

# Start services
docker-compose up -d
```

## Troubleshooting

### Services Not Using Correct URLs

1. Check that `.env` file exists and contains correct values
2. Verify environment variables are loaded: `env | grep SPINFORGE`
3. Restart services after changing environment

### CLI Not Connecting

1. Check `~/.spinforge/config.json` has correct `apiUrl`
2. Verify API service is running: `curl http://localhost:9006/_health`
3. Check environment: `echo $NODE_ENV`

### Redis Connection Issues

1. Verify Redis is running: `docker-compose ps redis`
2. Check Redis password in environment
3. Test connection: `redis-cli -h localhost -p 16378 ping`

## Best Practices

1. **Never commit `.env` files** - Only commit `.env.example` or `.env.{environment}` templates
2. **Use strong secrets in production** - Generate secure random values for AUTH_SECRET and JWT_SECRET
3. **Separate Redis databases** - Use different REDIS_DB values for different environments
4. **Monitor resource usage** - Adjust timeouts and limits based on actual usage
5. **Use environment-specific deployments** - Keep deployment directories separate

## Migration Guide

### From Hardcoded Values

1. Identify hardcoded URLs and configuration
2. Replace with environment variables or config imports
3. Test in all environments

### Example Migration

Before:
```typescript
const apiUrl = 'http://localhost:8080';
const redisHost = 'localhost';
```

After:
```typescript
import { getApiUrl, getRedisConfig } from '@spinforge/shared';

const apiUrl = getApiUrl();
const { host: redisHost } = getRedisConfig();
```