# SpinForge API Reference

## Table of Contents
1. [Authentication](#authentication)
2. [Routes API](#routes-api)
3. [Applications API](#applications-api)
4. [Metrics API](#metrics-api)
5. [Admin API](#admin-api)
6. [WebSocket API](#websocket-api)
7. [Error Responses](#error-responses)
8. [Rate Limiting](#rate-limiting)

## Base URL

```
Production: https://api.spinforge.yourdomain.com
Development: http://localhost:9004
```

## Authentication

All API requests require authentication using a Bearer token in the Authorization header:

```bash
Authorization: Bearer YOUR_API_TOKEN
```

### Getting a Token

Tokens are configured in the `.env` file during setup:
```bash
ADMIN_TOKEN=your-secure-token-here
```

### Example Request

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  https://api.spinforge.yourdomain.com/api/status
```

## Routes API

### List All Routes

```http
GET /api/routes
```

**Response:**
```json
{
  "routes": [
    {
      "domain": "app.example.com",
      "customerId": "customer-123",
      "spinletId": "spin-app-123",
      "framework": "express",
      "status": "active",
      "createdAt": "2025-01-19T10:00:00Z",
      "lastAccess": "2025-01-19T12:00:00Z"
    }
  ],
  "total": 1
}
```

### Get Route by Domain

```http
GET /api/routes/:domain
```

**Parameters:**
- `domain` (string, required): The domain name

**Response:**
```json
{
  "domain": "app.example.com",
  "customerId": "customer-123",
  "spinletId": "spin-app-123",
  "buildPath": "/builds/app-123",
  "framework": "express",
  "status": "active",
  "config": {
    "memory": "512MB",
    "cpu": "0.5",
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

### Create Route

```http
POST /api/routes
```

**Request Body:**
```json
{
  "domain": "newapp.example.com",
  "customerId": "customer-123",
  "framework": "express",
  "gitUrl": "https://github.com/user/repo.git",
  "config": {
    "memory": "1GB",
    "cpu": 1,
    "env": {
      "API_KEY": "secret-key"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "route": {
    "domain": "newapp.example.com",
    "spinletId": "spin-newapp-1642598400000",
    "status": "deploying"
  },
  "buildId": "build-123"
}
```

### Update Route

```http
PUT /api/routes/:domain
```

**Request Body:**
```json
{
  "config": {
    "memory": "2GB",
    "cpu": 2,
    "env": {
      "DEBUG": "true"
    }
  }
}
```

### Delete Route

```http
DELETE /api/routes/:domain
```

**Response:**
```json
{
  "success": true,
  "message": "Route deleted successfully"
}
```

## Applications API

### List Applications

```http
GET /api/applications
```

**Query Parameters:**
- `customerId` (string, optional): Filter by customer
- `status` (string, optional): Filter by status (running, stopped, starting)
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

**Response:**
```json
{
  "applications": [
    {
      "spinletId": "spin-app-123",
      "customerId": "customer-123",
      "domains": ["app.example.com", "www.app.example.com"],
      "framework": "express",
      "status": "running",
      "resources": {
        "memory": "512MB",
        "cpu": "0.5"
      },
      "metrics": {
        "requests": 1523,
        "errors": 3,
        "uptime": 86400
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### Get Application Details

```http
GET /api/applications/:spinletId
```

**Response:**
```json
{
  "spinletId": "spin-app-123",
  "customerId": "customer-123",
  "domains": ["app.example.com"],
  "framework": "express",
  "status": "running",
  "pid": 1234,
  "port": 30001,
  "startTime": "2025-01-19T10:00:00Z",
  "lastAccess": "2025-01-19T12:00:00Z",
  "resources": {
    "memory": "512MB",
    "cpu": "0.5",
    "memoryUsage": "245MB",
    "cpuUsage": "23%"
  },
  "metrics": {
    "requests": 1523,
    "errors": 3,
    "avgResponseTime": 145,
    "uptime": 86400
  },
  "config": {
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

### Start Application

```http
POST /api/applications/:spinletId/start
```

**Response:**
```json
{
  "success": true,
  "status": "starting",
  "message": "Application is starting"
}
```

### Stop Application

```http
POST /api/applications/:spinletId/stop
```

**Response:**
```json
{
  "success": true,
  "status": "stopped",
  "message": "Application stopped successfully"
}
```

### Restart Application

```http
POST /api/applications/:spinletId/restart
```

**Response:**
```json
{
  "success": true,
  "status": "restarting",
  "message": "Application is restarting"
}
```

### Get Application Logs

```http
GET /api/applications/:spinletId/logs
```

**Query Parameters:**
- `lines` (number, optional): Number of lines to return (default: 100)
- `since` (string, optional): ISO timestamp to get logs since
- `until` (string, optional): ISO timestamp to get logs until
- `level` (string, optional): Log level filter (debug, info, warn, error)

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-01-19T12:00:00Z",
      "level": "info",
      "message": "Server started on port 30001"
    },
    {
      "timestamp": "2025-01-19T12:00:01Z",
      "level": "info",
      "message": "Connected to database"
    }
  ],
  "hasMore": true
}
```

### Scale Application

```http
POST /api/applications/:spinletId/scale
```

**Request Body:**
```json
{
  "memory": "1GB",
  "cpu": 1,
  "instances": 2
}
```

## Metrics API

### Get System Metrics

```http
GET /api/metrics/system
```

**Response:**
```json
{
  "timestamp": "2025-01-19T12:00:00Z",
  "system": {
    "cpuUsage": 45.2,
    "memoryUsage": 67.8,
    "diskUsage": 23.4,
    "loadAverage": [1.2, 1.5, 1.8]
  },
  "spinforge": {
    "totalApplications": 45,
    "runningApplications": 42,
    "totalRequests": 152340,
    "totalErrors": 234,
    "avgResponseTime": 123
  }
}
```

### Get Application Metrics

```http
GET /api/metrics/applications/:spinletId
```

**Query Parameters:**
- `period` (string, optional): Time period (1h, 24h, 7d, 30d)
- `resolution` (string, optional): Data resolution (1m, 5m, 1h, 1d)

**Response:**
```json
{
  "spinletId": "spin-app-123",
  "period": "24h",
  "resolution": "1h",
  "metrics": {
    "requests": [
      { "timestamp": "2025-01-19T00:00:00Z", "value": 120 },
      { "timestamp": "2025-01-19T01:00:00Z", "value": 135 }
    ],
    "errors": [
      { "timestamp": "2025-01-19T00:00:00Z", "value": 2 },
      { "timestamp": "2025-01-19T01:00:00Z", "value": 1 }
    ],
    "responseTime": [
      { "timestamp": "2025-01-19T00:00:00Z", "value": 145 },
      { "timestamp": "2025-01-19T01:00:00Z", "value": 132 }
    ],
    "cpu": [
      { "timestamp": "2025-01-19T00:00:00Z", "value": 23.5 },
      { "timestamp": "2025-01-19T01:00:00Z", "value": 28.1 }
    ],
    "memory": [
      { "timestamp": "2025-01-19T00:00:00Z", "value": 245 },
      { "timestamp": "2025-01-19T01:00:00Z", "value": 256 }
    ]
  }
}
```

### Export Metrics

```http
GET /api/metrics/export
```

**Query Parameters:**
- `format` (string, required): Export format (prometheus, json, csv)
- `period` (string, optional): Time period to export

**Response (Prometheus format):**
```
# HELP spinforge_requests_total Total number of requests
# TYPE spinforge_requests_total counter
spinforge_requests_total{app="spin-app-123",customer="customer-123"} 1523

# HELP spinforge_errors_total Total number of errors
# TYPE spinforge_errors_total counter
spinforge_errors_total{app="spin-app-123",customer="customer-123"} 3

# HELP spinforge_response_time_seconds Response time in seconds
# TYPE spinforge_response_time_seconds histogram
spinforge_response_time_seconds_bucket{le="0.1",app="spin-app-123"} 1200
spinforge_response_time_seconds_bucket{le="0.5",app="spin-app-123"} 1500
spinforge_response_time_seconds_bucket{le="1",app="spin-app-123"} 1520
```

## Admin API

### Get System Status

```http
GET /api/admin/status
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 864000,
  "services": {
    "redis": "connected",
    "builder": "ready",
    "nginx": "running"
  },
  "resources": {
    "totalMemory": "16GB",
    "usedMemory": "8.5GB",
    "totalCPU": 8,
    "loadAverage": [2.1, 2.5, 2.8]
  }
}
```

### List Builds

```http
GET /api/admin/builds
```

**Query Parameters:**
- `status` (string, optional): Filter by status (pending, building, success, failed)
- `limit` (number, optional): Number of builds to return

**Response:**
```json
{
  "builds": [
    {
      "buildId": "build-123",
      "spinletId": "spin-app-123",
      "status": "success",
      "framework": "express",
      "startTime": "2025-01-19T10:00:00Z",
      "endTime": "2025-01-19T10:02:00Z",
      "duration": 120,
      "size": 15728640,
      "logs": "Build output..."
    }
  ]
}
```

### Get Build Details

```http
GET /api/admin/builds/:buildId
```

### Cancel Build

```http
POST /api/admin/builds/:buildId/cancel
```

### Clear Cache

```http
POST /api/admin/cache/clear
```

**Request Body (optional):**
```json
{
  "type": "routes",  // routes, metrics, builds, all
  "pattern": "app.*" // Optional pattern matching
}
```

### Update Configuration

```http
PUT /api/admin/config
```

**Request Body:**
```json
{
  "rateLimits": {
    "global": 20000,
    "customer": 2000
  },
  "resources": {
    "defaultMemory": "512MB",
    "defaultCPU": "0.5"
  },
  "timeouts": {
    "build": 600,
    "proxy": 60,
    "idle": 300
  }
}
```

### Maintenance Mode

```http
POST /api/admin/maintenance
```

**Request Body:**
```json
{
  "enabled": true,
  "message": "System maintenance in progress",
  "allowedIPs": ["192.168.1.100"],
  "estimatedDuration": 3600
}
```

## WebSocket API

### Connect to Real-time Updates

```javascript
const ws = new WebSocket('wss://api.spinforge.yourdomain.com/ws');

ws.on('open', () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'YOUR_API_TOKEN'
  }));
  
  // Subscribe to events
  ws.send(JSON.stringify({
    type: 'subscribe',
    events: ['deployment', 'metrics', 'logs'],
    filters: {
      customerId: 'customer-123'
    }
  }));
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Event:', event);
});
```

### Event Types

**Deployment Event:**
```json
{
  "type": "deployment",
  "event": "started|completed|failed",
  "data": {
    "spinletId": "spin-app-123",
    "domain": "app.example.com",
    "status": "deploying",
    "progress": 45
  }
}
```

**Metrics Event:**
```json
{
  "type": "metrics",
  "data": {
    "spinletId": "spin-app-123",
    "cpu": 23.5,
    "memory": 245,
    "requests": 10,
    "errors": 0
  }
}
```

**Log Event:**
```json
{
  "type": "log",
  "data": {
    "spinletId": "spin-app-123",
    "timestamp": "2025-01-19T12:00:00Z",
    "level": "info",
    "message": "Request processed"
  }
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "details": {
      "resource": "application",
      "id": "spin-app-123"
    }
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|------------|
| UNAUTHORIZED | Missing or invalid authentication | 401 |
| FORBIDDEN | Insufficient permissions | 403 |
| RESOURCE_NOT_FOUND | Resource not found | 404 |
| VALIDATION_ERROR | Invalid request data | 400 |
| CONFLICT | Resource already exists | 409 |
| RATE_LIMITED | Too many requests | 429 |
| INTERNAL_ERROR | Server error | 500 |
| SERVICE_UNAVAILABLE | Service temporarily unavailable | 503 |

### Validation Error Example

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "fields": {
        "domain": "Invalid domain format",
        "memory": "Memory must be between 128MB and 8GB"
      }
    }
  }
}
```

## Rate Limiting

Rate limits are applied per IP address and API token:

### Default Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/routes | 100 | 1 minute |
| /api/applications | 200 | 1 minute |
| /api/metrics | 300 | 1 minute |
| /api/admin/* | 50 | 1 minute |

### Rate Limit Headers

```http
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1642598400
RateLimit-Policy: 100;w=60
```

### Rate Limited Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "details": {
      "limit": 100,
      "window": 60,
      "retryAfter": 30
    }
  }
}
```

## Pagination

For endpoints that return lists, pagination is handled with these parameters:

**Request:**
```http
GET /api/applications?page=2&limit=20&sort=createdAt&order=desc
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 145,
    "pages": 8,
    "hasNext": true,
    "hasPrev": true
  },
  "links": {
    "first": "/api/applications?page=1&limit=20",
    "prev": "/api/applications?page=1&limit=20",
    "next": "/api/applications?page=3&limit=20",
    "last": "/api/applications?page=8&limit=20"
  }
}
```

## Webhooks (Planned)

### Register Webhook

```http
POST /api/webhooks
```

**Request Body:**
```json
{
  "url": "https://your-server.com/webhook",
  "events": ["deployment.completed", "application.stopped", "error.critical"],
  "secret": "your-webhook-secret"
}
```

### Webhook Event Format

```json
{
  "id": "evt_123",
  "type": "deployment.completed",
  "timestamp": "2025-01-19T12:00:00Z",
  "data": {
    "spinletId": "spin-app-123",
    "domain": "app.example.com",
    "duration": 120
  }
}
```

### Webhook Security

All webhook requests include:
```http
X-SpinForge-Signature: sha256=abcdef123456...
X-SpinForge-Timestamp: 1642598400
X-SpinForge-Event: deployment.completed
```

## SDK Examples

### Node.js SDK

```javascript
const SpinForge = require('@spinforge/sdk');

const spinforge = new SpinForge({
  apiKey: 'YOUR_API_TOKEN',
  baseUrl: 'https://api.spinforge.yourdomain.com'
});

// Deploy an app
const deployment = await spinforge.deploy({
  domain: 'myapp.example.com',
  gitUrl: 'https://github.com/user/repo.git',
  framework: 'express',
  config: {
    memory: '512MB',
    cpu: 0.5
  }
});

// Get application status
const app = await spinforge.applications.get('spin-app-123');

// Watch logs
const logStream = spinforge.applications.logs('spin-app-123', {
  follow: true,
  since: '1h'
});

logStream.on('data', (log) => {
  console.log(log.message);
});
```

### Python SDK

```python
from spinforge import SpinForge

client = SpinForge(
    api_key='YOUR_API_TOKEN',
    base_url='https://api.spinforge.yourdomain.com'
)

# Deploy an app
deployment = client.deploy(
    domain='myapp.example.com',
    git_url='https://github.com/user/repo.git',
    framework='express',
    config={
        'memory': '512MB',
        'cpu': 0.5
    }
)

# Get metrics
metrics = client.metrics.get_application(
    spinlet_id='spin-app-123',
    period='24h',
    resolution='1h'
)

# Scale application
client.applications.scale(
    spinlet_id='spin-app-123',
    memory='1GB',
    cpu=1
)
```

### CLI Tool

```bash
# Install CLI
npm install -g @spinforge/cli

# Configure
spinforge config set api-key YOUR_API_TOKEN
spinforge config set api-url https://api.spinforge.yourdomain.com

# Deploy
spinforge deploy --domain myapp.example.com --git https://github.com/user/repo.git

# List apps
spinforge apps list

# View logs
spinforge logs spin-app-123 --follow

# Scale app
spinforge scale spin-app-123 --memory 1GB --cpu 1
```