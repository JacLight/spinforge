# SpinForge API Reference

## Overview

SpinForge provides a comprehensive REST API for managing applications, monitoring system health, and controlling the platform. All API endpoints require authentication via the `X-Admin-Token` header.

## Base URL

```
http://localhost:9004
```

## Authentication

All admin endpoints require an API token:

```bash
curl -H "X-Admin-Token: your-token-here" http://localhost:9004/_admin/routes
```

## API Endpoints

### Health & Monitoring

#### GET /_health
Basic health check
```json
{
  "status": "healthy",
  "timestamp": "2025-07-18T12:00:00Z",
  "uptime": 3600
}
```

#### GET /_metrics/system
System hardware metrics (CPU, memory, disk, network)
```json
{
  "cpu": {
    "usage": 15,
    "cores": 8,
    "model": "Intel Core i7",
    "speed": 2400,
    "loadAverage": [1.5, 1.8, 2.0]
  },
  "memory": {
    "total": 16777216000,
    "used": 8388608000,
    "free": 8388608000,
    "usagePercent": 50
  }
}
```

#### GET /_metrics/docker
Docker container statistics
```json
{
  "containers": [
    {
      "id": "abc123",
      "name": "app-1",
      "status": "running",
      "cpu": 0.5,
      "memory": {
        "usage": 524288000,
        "limit": 1073741824,
        "percent": 50
      }
    }
  ],
  "total": 5,
  "running": 4,
  "stopped": 1
}
```

#### GET /_metrics/keydb
KeyDB/Redis metrics
```json
{
  "connected": true,
  "info": {
    "version": "6.3.4",
    "uptime": 86400,
    "connectedClients": 10,
    "usedMemory": 52428800,
    "usedMemoryHuman": "50MB"
  },
  "stats": {
    "totalCommands": 1000000,
    "opsPerSec": 1500,
    "hitRate": 95
  }
}
```

#### GET /_metrics/services
Service health status
```json
[
  {
    "name": "KeyDB",
    "status": "healthy",
    "uptime": 86400,
    "lastCheck": "2025-07-18T12:00:00Z"
  },
  {
    "name": "Nginx",
    "status": "healthy",
    "uptime": 86400,
    "lastCheck": "2025-07-18T12:00:00Z"
  }
]
```

#### GET /_metrics/all
Combined metrics from all sources

### Route Management

#### GET /_admin/routes
Get all configured routes
```json
[
  {
    "domain": "app.example.com",
    "customerId": "customer-123",
    "spinletId": "spin-456",
    "buildPath": "/apps/myapp",
    "framework": "express",
    "config": {
      "memory": "512MB",
      "cpu": "0.5"
    }
  }
]
```

#### POST /_admin/routes
Create a new route/deploy application
```json
{
  "domain": "myapp.example.com",
  "customerId": "customer-123",
  "spinletId": "spin-789",
  "buildPath": "/path/to/app",
  "framework": "express",
  "config": {
    "memory": "1GB",
    "cpu": "1.0",
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

#### DELETE /_admin/routes/:domain
Remove a route

### Spinlet Control

#### GET /_admin/spinlets/:spinletId
Get spinlet state

#### POST /_admin/spinlets/:spinletId/start
Start a stopped spinlet

#### POST /_admin/spinlets/:spinletId/stop
Stop a running spinlet

#### POST /_admin/spinlets/:spinletId/restart
Restart a spinlet

#### POST /_admin/spinlets/:spinletId/scale
Scale spinlet resources
```json
{
  "instances": 3,
  "memory": "2GB",
  "cpu": "2.0"
}
```

#### PUT /_admin/spinlets/:spinletId/env
Update environment variables
```json
{
  "env": {
    "NODE_ENV": "production",
    "DEBUG": "false"
  }
}
```

### Logs & Debugging

#### GET /_admin/spinlets/:spinletId/logs
Get spinlet logs
- Query params: `lines=100`, `follow=false`

#### POST /_admin/spinlets/:spinletId/exec
Execute command in container (restricted commands only)
```json
{
  "command": "ls -la",
  "workDir": "/app"
}
```

### Configuration

#### GET /_admin/config
Get platform configuration

#### PUT /_admin/config
Update platform configuration
```json
{
  "rateLimits": {
    "global": {
      "windowMs": 60000,
      "max": 1000
    }
  },
  "resources": {
    "defaultMemory": "512MB",
    "defaultCpu": "0.5"
  }
}
```

### Backup & Maintenance

#### POST /_admin/backup
Create system backup
```json
{
  "type": "full",
  "includeData": true,
  "includeConfigs": true,
  "includeLogs": false
}
```

#### GET /_admin/backup
List available backups

#### POST /_admin/backup/restore
Restore from backup
```json
{
  "backupId": "backup-20250718-123456",
  "restoreData": true,
  "restoreConfigs": true
}
```

### Security

#### POST /_admin/auth/keys
Generate API key
```json
{
  "name": "Production Key",
  "permissions": ["read", "write", "admin"],
  "expiresIn": "30d"
}
```

#### GET /_admin/auth/keys
List all API keys

#### DELETE /_admin/auth/keys/:keyId
Revoke an API key

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

Common HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Rate Limiting

The API implements rate limiting:
- Global: 1000 requests per minute
- Per customer: 100 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## WebSocket Endpoints

Some endpoints support WebSocket connections for real-time data:
- `/_admin/spinlets/:spinletId/logs/stream` - Live log streaming
- `/_metrics/stream` - Real-time metrics updates

## Postman Collection

Import the included `SpinForge-API.postman_collection.json` for a complete collection of all endpoints with examples.

## CLI Examples

```bash
# Get all routes
curl -H "X-Admin-Token: $TOKEN" http://localhost:9004/_admin/routes

# Deploy new app
curl -X POST -H "X-Admin-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"domain":"app.example.com","customerId":"cust-1","spinletId":"spin-1","buildPath":"/app","framework":"express"}' \
  http://localhost:9004/_admin/routes

# Get system metrics
curl http://localhost:9004/_metrics/system

# Restart a spinlet
curl -X POST -H "X-Admin-Token: $TOKEN" \
  http://localhost:9004/_admin/spinlets/spin-123/restart

# Scale resources
curl -X POST -H "X-Admin-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"memory":"2GB","cpu":"1.0"}' \
  http://localhost:9004/_admin/spinlets/spin-123/scale
```