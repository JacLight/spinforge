# SpinForge Architecture

## Table of Contents
1. [Overview](#overview)
2. [Problems We Solved](#problems-we-solved)
3. [Architecture Deep Dive](#architecture-deep-dive)
4. [System Components](#system-components)
5. [Data Flow](#data-flow)
6. [Design Decisions](#design-decisions)

## Overview

SpinForge is a modern Platform-as-a-Service (PaaS) designed to simplify application deployment and management. It provides a Heroku-like experience that you can self-host, with automatic builds, zero-downtime deployments, and intelligent resource management.

```
┌─────────────────────────────────────────────────────────────────┐
│                          User Domain                             │
│                     (app.example.com:443)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                          NGINX                                   │
│                    (SSL Termination)                             │
│                     Ports: 9006/9007                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                         SpinHub                                  │
│              (Main Orchestration Service)                        │
│                      Port: 8080                                  │
│  ┌─────────────┬──────────────┬─────────────┬────────────────┐ │
│  │ProxyHandler │ RouteManager │SpinletManager│ AdminAPI       │ │
│  └─────────────┴──────────────┴─────────────┴────────────────┘ │
└───────────┬──────────────────┬─────────────────┬───────────────┘
            │                  │                 │
            │                  │                 │
     ┌──────▼──────┐    ┌──────▼──────┐  ┌──────▼──────┐
     │  Spinlet 1  │    │  Spinlet 2  │  │  Spinlet N  │
     │ Port: 30001 │    │ Port: 30002 │  │ Port: 3000N │
     └─────────────┘    └─────────────┘  └─────────────┘
            │                  │                 │
     ┌──────▼──────────────────▼─────────────────▼──────┐
     │                    KeyDB/Redis                    │
     │              (State & Coordination)               │
     │                   Port: 16378                      │
     └───────────────────────────────────────────────────┘
```

## Problems We Solved

### 1. **Complex Deployment Process**
**Problem**: Traditional deployment requires:
- Manual server configuration
- Complex CI/CD pipelines
- Framework-specific knowledge
- Manual SSL certificate management

**Solution**: SpinForge provides:
- One-command deployment
- Automatic build detection
- Framework auto-detection
- Automatic SSL with Let's Encrypt (planned)

### 2. **Resource Waste**
**Problem**: Applications running 24/7 even with no traffic
- Wasted CPU and memory
- Higher hosting costs
- Environmental impact

**Solution**: Intelligent resource management:
- Automatic idle timeout (5 minutes default)
- On-demand spinup (<1 second)
- Memory/CPU limits per app
- Shared resource pooling

### 3. **Multi-App Complexity**
**Problem**: Running multiple apps requires:
- Multiple servers or complex nginx configs
- Port management nightmares
- Manual load balancing
- Separate monitoring per app

**Solution**: Domain-based routing:
- Unlimited apps on one server
- Automatic port allocation
- Built-in load balancing
- Unified monitoring

### 4. **Zero-Downtime Deployments**
**Problem**: Traditional deployments cause:
- Service interruptions
- Lost requests
- Poor user experience

**Solution**: Smart deployment strategy:
- Health check validation
- Graceful shutdown
- Request buffering
- Automatic rollback (planned)

### 5. **Build Complexity**
**Problem**: Each framework needs:
- Different build commands
- Specific configurations
- Manual dependency management

**Solution**: Intelligent build system:
- Auto-detects framework
- Runs appropriate build commands
- Handles TypeScript automatically
- Manages dependencies

## Architecture Deep Dive

### Core Design Principles

1. **Microservices Architecture**
   - Each component has a single responsibility
   - Services communicate via Redis pub/sub
   - Loosely coupled for scalability

2. **Event-Driven Design**
   - Asynchronous processing
   - Event sourcing for state changes
   - Reliable message delivery

3. **Container-First**
   - Everything runs in containers
   - Consistent environment
   - Easy scaling

4. **Stateless Services**
   - All state in Redis
   - Services can be restarted anytime
   - Horizontal scaling ready

### Request Flow

```
1. User Request → NGINX
   - SSL termination
   - Rate limiting
   - Security headers

2. NGINX → SpinHub
   - Host header routing
   - Load balancing
   - Health checks

3. SpinHub → Route Lookup
   - Domain to spinlet mapping
   - Customer validation
   - Resource limits check

4. SpinHub → Spinlet Manager
   - Check if spinlet running
   - Start if needed
   - Update last access time

5. SpinHub → Proxy Request
   - Add tracking headers
   - Forward to spinlet
   - Handle WebSocket upgrade

6. Spinlet → Process Request
   - Handle business logic
   - Return response

7. Response → User
   - Add telemetry
   - Update metrics
   - Log request
```

## System Components

### 1. **NGINX (Reverse Proxy)**
**Purpose**: Entry point for all traffic

**Responsibilities**:
- SSL/TLS termination
- HTTP/2 support
- Compression (gzip, brotli)
- Static file caching
- Security headers
- Rate limiting (layer 7)

**Configuration Highlights**:
```nginx
# Dynamic upstream based on host header
proxy_pass http://spinhub:8080;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;

# WebSocket support
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
```

### 2. **SpinHub (Orchestration Engine)**
**Purpose**: Core routing and management service

**Components**:

#### ProxyHandler
- HTTP/WebSocket proxying
- Request ID generation
- Error handling
- Telemetry collection

#### RouteManager
- Domain → Spinlet mapping
- Route CRUD operations
- Domain validation
- Route caching

#### SpinletManager
- Process lifecycle management
- Health monitoring
- Resource allocation
- Idle timeout

#### AdminAPI
- RESTful management endpoints
- Authentication/authorization
- Metrics endpoints
- Configuration management

**Key Features**:
- Zero-downtime deployments
- Automatic retries
- Circuit breaker pattern
- Request tracing

### 3. **Spinlet (Application Container)**
**Purpose**: Isolated application runtime

**Characteristics**:
- Single Node.js process
- Memory/CPU limits
- Health endpoint injection
- Graceful shutdown support
- Environment isolation

**Lifecycle**:
```
Created → Starting → Running → Idle → Stopping → Stopped
                        ↑_______________|
```

### 4. **Builder Service**
**Purpose**: Convert source code to runnable applications

**Build Pipeline**:
```
1. Source Acquisition
   - Git clone
   - URL download
   - File upload

2. Framework Detection
   - Check package.json
   - Identify framework
   - Determine build needs

3. Dependency Installation
   - npm/yarn/pnpm install
   - Cache dependencies
   - Security scanning

4. Build Execution
   - TypeScript compilation
   - Asset bundling
   - Environment injection

5. Optimization
   - Remove dev dependencies
   - Minification
   - Tree shaking

6. Packaging
   - Create deployment artifact
   - Generate metadata
   - Calculate checksums
```

**Supported Frameworks**:
- **Express**: Detects via express dependency
- **Next.js**: Detects via next dependency
- **Remix**: Detects via @remix-run
- **Static**: Fallback for HTML/CSS/JS

### 5. **KeyDB/Redis**
**Purpose**: Central state management and coordination

**Data Structures**:

```
Routes:
  spinforge:routes:{domain} → JSON {
    domain, customerId, spinletId, 
    buildPath, framework, config
  }

Spinlet State:
  spinforge:spinlets:{id} → HASH {
    state, pid, port, lastAccess,
    requests, errors, memory, cpu
  }

Active Spinlets:
  spinforge:active → ZSET {
    spinletId: lastAccessTime
  }

Metrics:
  spinforge:metrics:* → Time-series data

Build Queue:
  build:queue → LIST of build jobs
  build:status:{id} → Build progress
```

### 6. **Monitoring Stack**

#### Prometheus
- Metrics collection
- Time-series storage
- Alerting rules
- Service discovery

#### Grafana
- Visualization dashboards
- Real-time monitoring
- Historical analysis
- Alert management

**Key Metrics**:
- Request rate/latency
- Spinlet lifecycle events
- Resource utilization
- Error rates
- Build success/failure

### 7. **Hot Deployment Watcher**
**Purpose**: File-system based deployment

**Workflow**:
```
1. Watch deployment directory
2. Detect new applications
3. Validate deployment config
4. Trigger build process
5. Deploy on success
6. Create status markers
```

## Data Flow

### Deployment Flow
```
Source Code → Builder → Build Artifact → Spinlet Manager → Running App
     ↓                      ↓                    ↓              ↓
  Validation            Build Logs          State/Redis     Metrics
```

### Request Flow
```
Client → NGINX → SpinHub → Route Lookup → Spinlet Check → Proxy
                    ↓            ↓              ↓            ↓
                Telemetry     Redis         Start/Active   Response
```

### State Management
```
All State in Redis:
- Routes (domain mappings)
- Spinlet states
- Active processes
- Metrics/telemetry
- Build status
- Configuration
```

## Design Decisions

### 1. **Why Node.js for Spinlets?**
- JavaScript/TypeScript dominance in web development
- Excellent performance for I/O operations
- Large ecosystem of packages
- Easy to sandbox and monitor

### 2. **Why Redis/KeyDB?**
- Fast in-memory operations
- Pub/sub for events
- Persistence options
- Atomic operations
- Well-understood

### 3. **Why Domain-Based Routing?**
- Natural multi-tenancy
- Easy to understand
- SEO friendly
- No port management

### 4. **Why Idle Timeout?**
- 90% of apps have idle periods
- Significant resource savings
- Fast restart (<1 second)
- Transparent to users

### 5. **Why Monorepo?**
- Shared types/utilities
- Easier development
- Atomic changes
- Better code reuse

## Scalability Considerations

### Horizontal Scaling
```
Load Balancer
     ↓
┌─────────┐ ┌─────────┐ ┌─────────┐
│SpinHub 1│ │SpinHub 2│ │SpinHub N│
└────┬────┘ └────┬────┘ └────┬────┘
     └───────────┼───────────┘
                 ↓
          Shared Redis Cluster
```

### Vertical Scaling
- Increase spinlet port range
- Adjust memory limits
- CPU pinning for performance
- Resource pools

### Multi-Region (Future)
```
Region A          Region B
SpinHub ←────────→ SpinHub
   ↓                 ↓
Redis ←─────────────→ Redis
   (Replication)
```

## Security Architecture

### Network Security
- All internal communication on private network
- Only NGINX exposed publicly
- Firewall rules for ports
- DDoS protection at NGINX

### Application Security
- Process isolation
- Resource limits
- No root access
- Sandboxed file system

### Data Security
- Redis password protection
- Encrypted secrets (planned)
- Audit logging
- RBAC (planned)

## Future Enhancements

1. **Kubernetes Operator**
   - CRDs for spinlets
   - Native K8s integration
   - Helm charts

2. **Multi-Language Support**
   - Python/Django
   - Go
   - Ruby/Rails
   - PHP

3. **Advanced Features**
   - Blue/green deployments
   - Canary releases
   - A/B testing
   - Edge computing

4. **Enterprise Features**
   - SAML/OIDC
   - Audit logs
   - Compliance reports
   - SLA monitoring