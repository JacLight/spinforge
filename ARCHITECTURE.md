# SpinForge Architecture & Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Core Components](#core-components)
3. [Data Architecture](#data-architecture)
4. [Telemetry & Monitoring](#telemetry--monitoring)
5. [Storage Strategy](#storage-strategy)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Technical Decisions](#technical-decisions)

## Overview

SpinForge is an open-source platform that enables on-demand execution of AI-generated applications in isolated runtime environments called "Spinlets". It provides a self-hosted alternative to serverless platforms like Vercel or AWS Lambda, specifically designed for multi-tenant applications where each user gets their own isolated runtime.

### Key Features
- 🚀 On-demand process spawning (no cold starts)
- 🔒 Complete isolation between customer applications
- 💰 Zero idle cost - processes shut down automatically
- 📊 Built-in telemetry and usage tracking
- 🌐 Support for full-stack frameworks (Next.js, Remix, Express)
- ⚡ KeyDB-powered routing and state management

## Core Components

### 1. Spinlet Core (Runtime Manager)
**Purpose**: Manages the lifecycle of individual Spinlet processes

**Responsibilities**:
- Fork/spawn Node.js processes on demand
- Assign ports and manage port allocation
- Monitor resource usage (CPU, memory)
- Implement auto-shutdown after idle timeout (5 minutes default)
- Handle process crashes and restarts

**Key Implementation Details**:
```javascript
// Example process spawning logic
const { fork } = require('child_process');

function spawnSpinlet(customerId, buildPath) {
  const port = allocatePort();
  const proc = fork(buildPath, [], {
    env: {
      PORT: port,
      CUSTOMER_ID: customerId,
      NODE_ENV: 'production'
    },
    cwd: `/spinforge/builds/${customerId}`
  });
  
  // Track in KeyDB
  // Set idle timeout
  // Monitor resources
}
```

### 2. SpinHub (Router/Proxy)
**Purpose**: Intelligent request routing to appropriate Spinlets

**Responsibilities**:
- Accept incoming HTTP/HTTPS requests
- Map domains to customer IDs
- Check if Spinlet is running (KeyDB lookup)
- Spawn Spinlet if not running
- Proxy request to correct port
- Update last-accessed timestamps

**Routing Architecture**:
```
Internet → Load Balancer → SpinHub → Spinlet Process
                              ↓
                           KeyDB
```

### 3. SpinBuilder
**Purpose**: Transform source code into optimized, deployable Spinlets

**Supported Frameworks**:
- Next.js (SSR, API routes, static)
- Remix (full-stack)
- Express/Fastify APIs
- Static sites

**Build Pipeline**:
1. Receive source code from AI builder
2. Detect framework type
3. Install dependencies
4. Run build process
5. Create optimized output
6. Store in `/spinforge/builds/{customerId}/`

### 4. SpinStorage
**Purpose**: Manage persistent data for Spinlets

**Storage Layers**:
```
/spinforge/
├── builds/          # Compiled applications
│   ├── customer1/
│   └── customer2/
├── data/            # Persistent user data
│   ├── customer1/
│   └── customer2/
├── cache/           # Shared cache directory
└── tmp/             # Ephemeral workspace
```

## Data Architecture

### KeyDB as Primary Datastore

We use KeyDB (Redis-compatible) as our single source of truth for all operational data. No separate database server is required.

### KeyDB Schema Design

#### 1. Domain Routing
```redis
# Domain to Spinlet mapping
spinforge:routes:{domain} → JSON {
  "spinletId": "spin-abc123",
  "customerId": "cust-123",
  "buildPath": "/builds/cust-123/v42",
  "framework": "remix",
  "config": {
    "memory": "512MB",
    "cpu": "0.5"
  }
}

# Reverse lookup
spinforge:customer:{customerId}:domains → SET[domain1, domain2]
```

#### 2. Spinlet State Management
```redis
# Active Spinlets (sorted by last access)
spinforge:active → ZSET [
  score: timestamp,
  member: spinletId
]

# Spinlet details
spinforge:spinlets:{spinletId} → HASH {
  "pid": 12345,
  "port": 3001,
  "startTime": 1737115200,
  "requests": 1523,
  "memory": 245760000,
  "cpu": 0.23,
  "customerId": "cust-123",
  "state": "running|idle|stopped"
}

# Port allocation
spinforge:ports:used → SET[3001, 3002, ...]
spinforge:ports:available → LIST[3003, 3004, ...]
```

#### 3. Customer Configuration
```redis
spinforge:customers:{customerId} → JSON {
  "name": "Acme Corp",
  "tier": "pro",
  "limits": {
    "memory": "2GB",
    "cpu": "2.0",
    "spinlets": 10
  },
  "created": 1737000000
}
```

## Telemetry & Monitoring

### Metrics Collection (Built on KeyDB)

#### 1. Request Metrics
```redis
# Per-minute request counts (1-hour TTL)
spinforge:metrics:requests:{spinletId}:{timestamp} → HASH {
  "count": 150,
  "errors": 2,
  "latency_p50": 23,
  "latency_p95": 89,
  "latency_p99": 120
}

# Aggregated daily metrics (30-day TTL)
spinforge:metrics:daily:{spinletId}:{date} → HASH {
  "requests": 45000,
  "errors": 125,
  "uptime": 86200,
  "cold_starts": 12
}
```

#### 2. Resource Usage
```redis
# 5-minute resource snapshots (7-day TTL)
spinforge:metrics:resources:{spinletId}:{timestamp} → HASH {
  "cpu_percent": 23.5,
  "memory_bytes": 245760000,
  "disk_read_bytes": 1024000,
  "disk_write_bytes": 512000,
  "network_in_bytes": 10485760,
  "network_out_bytes": 52428800
}
```

#### 3. Usage Analytics
```redis
# Customer usage tracking
spinforge:usage:{customerId}:{year}:{month} → HASH {
  "compute_seconds": 2678400,
  "requests": 1234567,
  "bandwidth_bytes": 1099511627776,
  "storage_bytes": 10737418240,
  "unique_visitors": 45123  # HyperLogLog
}

# Real-time leaderboards
spinforge:top:spinlets:by_requests → ZSET
spinforge:top:customers:by_usage → ZSET
```

#### 4. Audit Trail
```redis
# Event stream (permanent retention)
spinforge:audit → STREAM [
  {
    "timestamp": 1737115200,
    "event": "spinlet_start",
    "spinletId": "spin-abc123",
    "customerId": "cust-123",
    "details": {...}
  }
]
```

### OpenTelemetry Integration

Each Spinlet automatically exports:
- **Traces**: Distributed tracing for requests
- **Metrics**: Runtime metrics, custom business metrics
- **Logs**: Structured logs with correlation IDs

```javascript
// Auto-injected into each Spinlet
const { trace, metrics } = require('@spinforge/telemetry');

// Automatic instrumentation
// Custom metrics API available
```

## Storage Strategy

### Data Retention Policies

| Data Type | Retention | Storage Location |
|-----------|-----------|------------------|
| Raw metrics | 1 hour | KeyDB with TTL |
| 5-min aggregates | 24 hours | KeyDB with TTL |
| Hourly rollups | 7 days | KeyDB with TTL |
| Daily summaries | 30 days | KeyDB with TTL |
| Monthly billing | Forever | KeyDB + backup |
| Audit logs | Forever | KeyDB streams + archive |
| Build artifacts | 30 days | Filesystem + S3 |

### Backup Strategy

1. **KeyDB Persistence**:
   - AOF (Append Only File) for durability
   - RDB snapshots every hour
   - Replicas for high availability

2. **Build Artifacts**:
   - Local filesystem for active builds
   - S3/MinIO for long-term storage
   - Automatic cleanup after 30 days

3. **Critical Data**:
   - Daily exports to S3
   - Cross-region replication
   - Point-in-time recovery

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Repository structure and build setup
- [ ] Basic Spinlet process manager
- [ ] Simple HTTP router/proxy
- [ ] KeyDB integration for state

### Phase 2: Production Features (Week 3-4)
- [ ] Auto-shutdown and resource limits
- [ ] Domain mapping system
- [ ] Basic telemetry collection
- [ ] Health checks and monitoring

### Phase 3: Advanced Features (Week 5-6)
- [ ] Kubernetes deployment support
- [ ] Advanced metrics and dashboards
- [ ] CLI tool for local development
- [ ] Web UI for management

### Phase 4: Scale & Polish (Week 7-8)
- [ ] Multi-node support
- [ ] Advanced caching strategies
- [ ] Performance optimizations
- [ ] Security hardening

## Technical Decisions

### Why KeyDB over Redis?
- 5x faster on multi-core systems
- Active-active replication
- Better memory efficiency
- Compatible with Redis clients

### Why Process Forking over Containers?
- Faster startup (< 100ms vs seconds)
- Lower overhead per Spinlet
- Simpler resource management
- Native Node.js cluster support

### Why Custom Router over NGINX?
- Dynamic spawning capability
- Integrated telemetry
- WebSocket support
- Custom load balancing

### Security Considerations
- Process isolation via Linux namespaces
- Resource limits via cgroups
- Network isolation per Spinlet
- Automatic secret injection
- Rate limiting per customer

## Next Steps

1. **Immediate Actions**:
   - Create GitHub repository
   - Set up basic project structure
   - Implement proof-of-concept Spinlet spawner

2. **Community Engagement**:
   - Open source announcement
   - Documentation website
   - Discord/Slack community

3. **Integration Planning**:
   - MintFlow.ai integration
   - API design for third-party tools
   - Webhook system for events

---

Last Updated: January 17, 2025
Version: 1.0.0