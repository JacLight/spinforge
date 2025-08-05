# SpinForge Performance Tuning Guide

## Table of Contents
1. [Performance Overview](#performance-overview)
2. [System Optimization](#system-optimization)
3. [Application Optimization](#application-optimization)
4. [Database Optimization](#database-optimization)
5. [Caching Strategies](#caching-strategies)
6. [Load Balancing](#load-balancing)
7. [Monitoring & Profiling](#monitoring--profiling)
8. [Scaling Strategies](#scaling-strategies)

## Performance Overview

### Performance Goals

| Metric | Target | Critical |
|--------|--------|----------|
| Response Time (p50) | < 100ms | < 200ms |
| Response Time (p95) | < 500ms | < 1000ms |
| Response Time (p99) | < 1000ms | < 2000ms |
| Throughput | > 1000 RPS | > 500 RPS |
| Error Rate | < 0.1% | < 1% |
| CPU Usage | < 70% | < 90% |
| Memory Usage | < 80% | < 95% |

### Performance Testing

```bash
# Basic load test
ab -n 10000 -c 100 http://app.example.com/

# Advanced load test with wrk
wrk -t12 -c400 -d30s --latency http://app.example.com/

# Stress test with increasing load
for i in {1..10}; do
  echo "Load: $((i * 100)) concurrent users"
  wrk -t4 -c$((i * 100)) -d10s http://app.example.com/
  sleep 5
done
```

## System Optimization

### Docker Optimization

#### 1. Resource Limits

```yaml
# docker-compose.yml
services:
  spinhub:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G
        reservations:
          cpus: '2'
          memory: 2G
```

#### 2. Docker Settings

```json
// /etc/docker/daemon.json
{
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
```

#### 3. Container Optimization

```dockerfile
# Multi-stage build for smaller images
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["node", "server.js"]
```

### Linux Kernel Tuning

#### 1. Network Performance

```bash
# /etc/sysctl.conf
# Increase TCP buffer sizes
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728

# Increase connection backlog
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# Enable TCP fast open
net.ipv4.tcp_fastopen = 3

# Reuse TIME_WAIT sockets
net.ipv4.tcp_tw_reuse = 1

# Apply settings
sysctl -p
```

#### 2. File Descriptors

```bash
# /etc/security/limits.conf
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535

# For systemd services
# /etc/systemd/system/spinforge.service.d/override.conf
[Service]
LimitNOFILE=65535
```

### NGINX Optimization

#### 1. Worker Configuration

```nginx
# nginx.conf
worker_processes auto;
worker_cpu_affinity auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}
```

#### 2. HTTP Optimization

```nginx
http {
    # Enable sendfile
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    
    # Keepalive
    keepalive_timeout 65;
    keepalive_requests 100;
    
    # Buffers
    client_body_buffer_size 128k;
    client_max_body_size 100m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;
    output_buffers 1 32k;
    postpone_output 1460;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml application/atom+xml image/svg+xml;
    
    # Cache
    open_file_cache max=1000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
}
```

#### 3. Upstream Configuration

```nginx
upstream spinhub {
    least_conn;
    server spinhub1:8080 max_fails=3 fail_timeout=30s;
    server spinhub2:8080 max_fails=3 fail_timeout=30s;
    server spinhub3:8080 max_fails=3 fail_timeout=30s;
    
    keepalive 32;
    keepalive_requests 100;
    keepalive_timeout 60s;
}

server {
    location / {
        proxy_pass http://spinhub;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Redis/KeyDB Optimization

#### 1. Configuration

```conf
# keydb.conf
# Memory
maxmemory 4gb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error no
rdbcompression yes
rdbchecksum yes

# Performance
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
replica-lazy-flush yes

# Threading (KeyDB specific)
server-threads 4
server-thread-affinity true
```

#### 2. Connection Pooling

```javascript
// Optimal Redis client configuration
const Redis = require('ioredis');

const redis = new Redis({
  host: 'keydb',
  port: 16378,
  password: process.env.REDIS_PASSWORD,
  
  // Connection pool
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  
  // Performance
  enableAutoPipelining: true,
  autoPipeliningIgnoredCommands: ['brpop', 'blpop'],
  
  // Reconnection
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});
```

## Application Optimization

### Node.js Optimization

#### 1. Cluster Mode

```javascript
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork(); // Replace dead worker
  });
} else {
  // Worker process
  require('./server');
  console.log(`Worker ${process.pid} started`);
}
```

#### 2. Memory Management

```javascript
// Increase heap size
// package.json
{
  "scripts": {
    "start": "node --max-old-space-size=4096 server.js"
  }
}

// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  });
}, 60000);
```

#### 3. Async Optimization

```javascript
// Use Promise.all for parallel operations
async function fetchUserData(userId) {
  const [profile, posts, friends] = await Promise.all([
    getUserProfile(userId),
    getUserPosts(userId),
    getUserFriends(userId)
  ]);
  
  return { profile, posts, friends };
}

// Stream large responses
app.get('/large-file', (req, res) => {
  const stream = fs.createReadStream('large-file.json');
  stream.pipe(res);
});

// Use async iterators for large datasets
async function* fetchLargeDataset() {
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const data = await fetchPage(page);
    yield* data.items;
    hasMore = data.hasNextPage;
    page++;
  }
}
```

### Express Optimization

#### 1. Middleware Order

```javascript
// Optimal middleware order
const app = express();

// 1. Security and headers first
app.use(helmet());
app.use(cors());

// 2. Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Static files with caching
app.use(express.static('public', {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  index: false
}));

// 4. Compression (after static files)
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// 5. Rate limiting
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// 6. Your routes
app.use('/api', apiRoutes);

// 7. Error handling last
app.use(errorHandler);
```

#### 2. Route Optimization

```javascript
// Cache route handlers
const routeCache = new Map();

function cacheRoute(duration = 300) {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cached = routeCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < duration * 1000) {
      return res.json(cached.data);
    }
    
    const originalJson = res.json;
    res.json = function(data) {
      routeCache.set(key, { data, timestamp: Date.now() });
      originalJson.call(this, data);
    };
    
    next();
  };
}

// Use specific routes instead of wildcards
// Good
app.get('/api/users/:id', getUser);
app.get('/api/users/:id/posts', getUserPosts);

// Bad
app.get('/api/*', handleAllApi);
```

## Database Optimization

### Query Optimization

#### 1. PostgreSQL

```sql
-- Use EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS) 
SELECT u.*, COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON p.user_id = u.id
WHERE u.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id;

-- Create efficient indexes
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC);

-- Use partial indexes for common queries
CREATE INDEX idx_active_users ON users(id) WHERE active = true;

-- Optimize JOIN order
-- Put smaller tables first
SELECT /*+ LEADING(small_table large_table) */ *
FROM small_table
JOIN large_table ON large_table.id = small_table.large_id;
```

#### 2. MongoDB

```javascript
// Create compound indexes
db.users.createIndex({ status: 1, createdAt: -1 });
db.posts.createIndex({ userId: 1, published: 1, createdAt: -1 });

// Use projection to limit fields
db.users.find(
  { status: 'active' },
  { name: 1, email: 1, _id: 0 }
).limit(100);

// Aggregate pipeline optimization
db.orders.aggregate([
  // Match first to reduce dataset
  { $match: { status: 'completed' } },
  
  // Use index
  { $sort: { createdAt: -1 } },
  
  // Limit before expensive operations
  { $limit: 1000 },
  
  // Then do complex operations
  { $lookup: {
    from: 'users',
    localField: 'userId',
    foreignField: '_id',
    as: 'user'
  }},
  
  // Project only needed fields
  { $project: {
    orderId: 1,
    total: 1,
    'user.name': 1,
    'user.email': 1
  }}
]);
```

### Connection Pooling

#### 1. PostgreSQL

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Pool configuration
  max: 20,                     // Maximum connections
  idleTimeoutMillis: 30000,    // Close idle connections
  connectionTimeoutMillis: 2000,
  
  // Performance options
  statement_timeout: 30000,
  query_timeout: 30000,
  application_name: 'spinforge',
  
  // Connection string options
  ssl: { rejectUnauthorized: false }
});

// Monitor pool
pool.on('connect', (client) => {
  client.query('SET statement_timeout = 30000');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});
```

#### 2. MongoDB

```javascript
const mongoose = require('mongoose');

mongoose.connect(uri, {
  // Connection pool
  maxPoolSize: 20,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  
  // Performance
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  
  // Write concern
  writeConcern: {
    w: 1,
    j: false,
    wtimeout: 1000
  },
  
  // Read preference
  readPreference: 'secondaryPreferred',
  readConcern: { level: 'local' }
});
```

## Caching Strategies

### Multi-Layer Caching

```javascript
// 1. Memory cache (fastest)
const NodeCache = require('node-cache');
const memCache = new NodeCache({ stdTTL: 60 });

// 2. Redis cache (shared)
const Redis = require('ioredis');
const redis = new Redis();

// 3. CDN cache (edge)
// Configured via headers

async function getCachedData(key, fetchFn) {
  // Check memory cache
  let data = memCache.get(key);
  if (data) return { data, source: 'memory' };
  
  // Check Redis
  data = await redis.get(key);
  if (data) {
    data = JSON.parse(data);
    memCache.set(key, data); // Populate memory cache
    return { data, source: 'redis' };
  }
  
  // Fetch fresh data
  data = await fetchFn();
  
  // Cache in both layers
  memCache.set(key, data);
  await redis.setex(key, 300, JSON.stringify(data));
  
  return { data, source: 'fresh' };
}
```

### Cache Invalidation

```javascript
class CacheManager {
  constructor(redis, memCache) {
    this.redis = redis;
    this.memCache = memCache;
    this.subscribers = new Map();
  }
  
  async set(key, value, ttl = 300) {
    this.memCache.set(key, value, ttl);
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
  
  async invalidate(pattern) {
    // Clear memory cache
    const keys = this.memCache.keys();
    keys.forEach(key => {
      if (key.match(pattern)) {
        this.memCache.del(key);
      }
    });
    
    // Clear Redis cache
    const redisKeys = await this.redis.keys(pattern);
    if (redisKeys.length > 0) {
      await this.redis.del(...redisKeys);
    }
    
    // Notify subscribers
    this.publish('cache:invalidated', { pattern });
  }
  
  async invalidateTag(tag) {
    const keys = await this.redis.smembers(`tag:${tag}`);
    if (keys.length > 0) {
      await this.invalidate(keys);
      await this.redis.del(`tag:${tag}`);
    }
  }
  
  async tagKey(key, tags) {
    for (const tag of tags) {
      await this.redis.sadd(`tag:${tag}`, key);
    }
  }
}
```

### HTTP Caching

```javascript
// Cache middleware
function httpCache(duration = 300) {
  return (req, res, next) => {
    // Skip for non-GET requests
    if (req.method !== 'GET') return next();
    
    // Set cache headers
    res.set({
      'Cache-Control': `public, max-age=${duration}`,
      'Surrogate-Control': `max-age=${duration * 2}`,
      'Vary': 'Accept-Encoding'
    });
    
    // Generate ETag
    const originalSend = res.send;
    res.send = function(body) {
      const etag = generateETag(body);
      res.set('ETag', etag);
      
      // Check If-None-Match
      if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return;
      }
      
      originalSend.call(this, body);
    };
    
    next();
  };
}
```

## Load Balancing

### Application-Level Load Balancing

```javascript
// Round-robin load balancer
class LoadBalancer {
  constructor(backends) {
    this.backends = backends;
    this.current = 0;
  }
  
  getNext() {
    const backend = this.backends[this.current];
    this.current = (this.current + 1) % this.backends.length;
    return backend;
  }
}

// Weighted round-robin
class WeightedLoadBalancer {
  constructor(backends) {
    this.backends = backends;
    this.weights = backends.map(b => b.weight || 1);
    this.currentWeight = 0;
    this.index = -1;
  }
  
  getNext() {
    while (true) {
      this.index = (this.index + 1) % this.backends.length;
      
      if (this.index === 0) {
        this.currentWeight -= this.gcd();
        if (this.currentWeight <= 0) {
          this.currentWeight = this.maxWeight();
        }
      }
      
      if (this.weights[this.index] >= this.currentWeight) {
        return this.backends[this.index];
      }
    }
  }
  
  gcd() {
    return this.weights.reduce((a, b) => {
      while (b) [a, b] = [b, a % b];
      return a;
    });
  }
  
  maxWeight() {
    return Math.max(...this.weights);
  }
}
```

### Health Check Implementation

```javascript
class HealthChecker {
  constructor(backends, options = {}) {
    this.backends = backends;
    this.interval = options.interval || 5000;
    this.timeout = options.timeout || 2000;
    this.healthy = new Set(backends);
    
    this.startChecking();
  }
  
  async checkHealth(backend) {
    try {
      const response = await axios.get(
        `http://${backend.host}:${backend.port}/health`,
        { timeout: this.timeout }
      );
      
      if (response.status === 200) {
        this.healthy.add(backend);
        backend.failures = 0;
      } else {
        this.handleFailure(backend);
      }
    } catch (error) {
      this.handleFailure(backend);
    }
  }
  
  handleFailure(backend) {
    backend.failures = (backend.failures || 0) + 1;
    
    if (backend.failures >= 3) {
      this.healthy.delete(backend);
      console.error(`Backend ${backend.host} marked as unhealthy`);
    }
  }
  
  startChecking() {
    setInterval(() => {
      this.backends.forEach(backend => {
        this.checkHealth(backend);
      });
    }, this.interval);
  }
  
  getHealthyBackends() {
    return Array.from(this.healthy);
  }
}
```

## Monitoring & Profiling

### Application Profiling

```javascript
// CPU Profiling
const v8Profiler = require('v8-profiler-next');

function startCPUProfile(duration = 10000) {
  const title = `CPU-Profile-${Date.now()}`;
  v8Profiler.startProfiling(title, true);
  
  setTimeout(() => {
    const profile = v8Profiler.stopProfiling(title);
    
    profile.export((error, result) => {
      fs.writeFileSync(`${title}.cpuprofile`, result);
      profile.delete();
    });
  }, duration);
}

// Memory Profiling
function takeHeapSnapshot() {
  const snapshot = v8Profiler.takeSnapshot();
  const filePath = `Heap-${Date.now()}.heapsnapshot`;
  
  const stream = snapshot.export();
  const fileStream = fs.createWriteStream(filePath);
  
  stream.pipe(fileStream);
  stream.on('end', () => {
    snapshot.delete();
    console.log(`Heap snapshot saved to ${filePath}`);
  });
}

// Async hooks for tracing
const async_hooks = require('async_hooks');
const asyncResources = new Map();

const asyncHook = async_hooks.createHook({
  init(asyncId, type, triggerAsyncId) {
    asyncResources.set(asyncId, {
      type,
      triggerAsyncId,
      startTime: Date.now()
    });
  },
  destroy(asyncId) {
    const resource = asyncResources.get(asyncId);
    if (resource) {
      const duration = Date.now() - resource.startTime;
      if (duration > 100) {
        console.log(`Slow async operation: ${resource.type} took ${duration}ms`);
      }
      asyncResources.delete(asyncId);
    }
  }
});

// Enable in development only
if (process.env.NODE_ENV === 'development') {
  asyncHook.enable();
}
```

### Custom Metrics

```javascript
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const activeConnections = new prometheus.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

// Middleware to collect metrics
app.use((req, res, next) => {
  const start = Date.now();
  activeConnections.inc();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || 'unknown';
    const labels = {
      method: req.method,
      route,
      status: res.statusCode
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
    activeConnections.dec();
  });
  
  next();
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

## Scaling Strategies

### Horizontal Scaling

#### 1. Stateless Design

```javascript
// Bad: Storing state in memory
const sessions = {};
app.post('/login', (req, res) => {
  const sessionId = generateId();
  sessions[sessionId] = { user: req.body.username };
  res.json({ sessionId });
});

// Good: Store state in Redis
app.post('/login', async (req, res) => {
  const sessionId = generateId();
  await redis.setex(
    `session:${sessionId}`,
    3600,
    JSON.stringify({ user: req.body.username })
  );
  res.json({ sessionId });
});
```

#### 2. Service Discovery

```javascript
class ServiceRegistry {
  constructor(redis) {
    this.redis = redis;
    this.services = new Map();
  }
  
  async register(service) {
    const key = `service:${service.name}:${service.id}`;
    const data = {
      ...service,
      lastHeartbeat: Date.now()
    };
    
    await this.redis.setex(key, 30, JSON.stringify(data));
    this.services.set(service.id, data);
    
    // Keep alive
    this.startHeartbeat(service);
  }
  
  startHeartbeat(service) {
    const interval = setInterval(async () => {
      try {
        await this.redis.expire(
          `service:${service.name}:${service.id}`,
          30
        );
      } catch (error) {
        clearInterval(interval);
        this.services.delete(service.id);
      }
    }, 10000);
  }
  
  async discover(serviceName) {
    const keys = await this.redis.keys(`service:${serviceName}:*`);
    const services = [];
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        services.push(JSON.parse(data));
      }
    }
    
    return services;
  }
}
```

### Auto-Scaling

#### 1. Metrics-Based Scaling

```javascript
class AutoScaler {
  constructor(options) {
    this.minInstances = options.minInstances || 1;
    this.maxInstances = options.maxInstances || 10;
    this.targetCPU = options.targetCPU || 70;
    this.targetMemory = options.targetMemory || 80;
    this.scaleUpThreshold = options.scaleUpThreshold || 3;
    this.scaleDownThreshold = options.scaleDownThreshold || 5;
    
    this.metrics = [];
    this.checkInterval = setInterval(() => this.check(), 30000);
  }
  
  async check() {
    const metrics = await this.collectMetrics();
    this.metrics.push(metrics);
    
    // Keep last 10 data points
    if (this.metrics.length > 10) {
      this.metrics.shift();
    }
    
    const decision = this.makeDecision();
    if (decision !== 0) {
      await this.scale(decision);
    }
  }
  
  makeDecision() {
    if (this.metrics.length < 3) return 0;
    
    const recentMetrics = this.metrics.slice(-3);
    const avgCPU = average(recentMetrics.map(m => m.cpu));
    const avgMemory = average(recentMetrics.map(m => m.memory));
    
    // Scale up
    if (avgCPU > this.targetCPU || avgMemory > this.targetMemory) {
      const highCount = recentMetrics.filter(
        m => m.cpu > this.targetCPU || m.memory > this.targetMemory
      ).length;
      
      if (highCount >= this.scaleUpThreshold) {
        return 1; // Scale up
      }
    }
    
    // Scale down
    if (avgCPU < this.targetCPU * 0.5 && avgMemory < this.targetMemory * 0.5) {
      const lowCount = recentMetrics.filter(
        m => m.cpu < this.targetCPU * 0.5 && m.memory < this.targetMemory * 0.5
      ).length;
      
      if (lowCount >= this.scaleDownThreshold) {
        return -1; // Scale down
      }
    }
    
    return 0; // No change
  }
  
  async scale(direction) {
    const currentInstances = await this.getCurrentInstances();
    let targetInstances = currentInstances + direction;
    
    // Apply limits
    targetInstances = Math.max(this.minInstances, targetInstances);
    targetInstances = Math.min(this.maxInstances, targetInstances);
    
    if (targetInstances !== currentInstances) {
      console.log(`Scaling from ${currentInstances} to ${targetInstances} instances`);
      await this.setInstances(targetInstances);
    }
  }
}
```

#### 2. Predictive Scaling

```javascript
class PredictiveScaler {
  constructor() {
    this.historicalData = [];
    this.predictions = new Map();
  }
  
  async collectHistoricalData() {
    // Collect metrics every 5 minutes
    setInterval(async () => {
      const metrics = await this.getMetrics();
      this.historicalData.push({
        timestamp: Date.now(),
        dayOfWeek: new Date().getDay(),
        hour: new Date().getHours(),
        ...metrics
      });
      
      // Keep 7 days of data
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      this.historicalData = this.historicalData.filter(
        d => d.timestamp > weekAgo
      );
    }, 5 * 60 * 1000);
  }
  
  predictLoad(futureTime) {
    const futureDate = new Date(futureTime);
    const dayOfWeek = futureDate.getDay();
    const hour = futureDate.getHours();
    
    // Find similar time periods in history
    const similarPeriods = this.historicalData.filter(d => 
      d.dayOfWeek === dayOfWeek &&
      Math.abs(d.hour - hour) <= 1
    );
    
    if (similarPeriods.length === 0) {
      return null;
    }
    
    // Calculate average metrics
    const avgMetrics = {
      cpu: average(similarPeriods.map(p => p.cpu)),
      memory: average(similarPeriods.map(p => p.memory)),
      requests: average(similarPeriods.map(p => p.requests))
    };
    
    // Apply trend adjustment
    const trend = this.calculateTrend();
    avgMetrics.cpu *= (1 + trend);
    avgMetrics.memory *= (1 + trend);
    avgMetrics.requests *= (1 + trend);
    
    return avgMetrics;
  }
  
  async preScale() {
    // Look 15 minutes ahead
    const futureTime = Date.now() + 15 * 60 * 1000;
    const prediction = this.predictLoad(futureTime);
    
    if (prediction) {
      const requiredInstances = this.calculateRequiredInstances(prediction);
      const currentInstances = await this.getCurrentInstances();
      
      if (requiredInstances > currentInstances) {
        console.log(`Pre-scaling to ${requiredInstances} instances for predicted load`);
        await this.setInstances(requiredInstances);
      }
    }
  }
}
```

## Performance Best Practices

### 1. Code-Level Optimizations

```javascript
// Avoid blocking operations
// Bad
const data = fs.readFileSync('large-file.json');

// Good
const data = await fs.promises.readFile('large-file.json');

// Use streaming for large data
const stream = fs.createReadStream('large-file.json');
stream.pipe(res);

// Batch operations
// Bad
for (const id of userIds) {
  await updateUser(id);
}

// Good
await updateUsers(userIds);

// Lazy loading
const heavyModule = require('heavy-module'); // Bad - loads at startup

app.get('/special', (req, res) => {
  const heavyModule = require('heavy-module'); // Good - loads when needed
});
```

### 2. Database Best Practices

```javascript
// Connection reuse
const pool = createPool();
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Prepared statements
const query = {
  text: 'SELECT * FROM users WHERE id = $1',
  values: [userId]
};
const result = await pool.query(query);

// Batch inserts
const values = users.map(u => `('${u.name}', '${u.email}')`).join(',');
await pool.query(`INSERT INTO users (name, email) VALUES ${values}`);

// Use transactions for consistency
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO users...');
  await client.query('UPDATE stats...');
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### 3. Monitoring Checklist

- [ ] Response time percentiles (p50, p95, p99)
- [ ] Error rates and types
- [ ] Request throughput
- [ ] CPU and memory usage
- [ ] Database query performance
- [ ] Cache hit rates
- [ ] Network I/O
- [ ] Disk I/O
- [ ] Container metrics
- [ ] Application-specific metrics

### 4. Performance Testing

```bash
# Load test script
#!/bin/bash

echo "Starting performance test..."

# Warm up
echo "Warming up..."
wrk -t2 -c10 -d30s $TARGET_URL > /dev/null

# Baseline test
echo "Baseline test..."
wrk -t4 -c50 -d60s --latency $TARGET_URL

# Stress test
echo "Stress test..."
wrk -t8 -c200 -d120s --latency $TARGET_URL

# Spike test
echo "Spike test..."
wrk -t12 -c500 -d30s --latency $TARGET_URL

# Endurance test
echo "Endurance test..."
wrk -t4 -c100 -d600s --latency $TARGET_URL

echo "Performance test completed"
```

## Conclusion

Performance optimization is an ongoing process. Key takeaways:

1. **Measure First**: Don't optimize without data
2. **Start Simple**: Basic optimizations often yield the biggest gains
3. **Monitor Continuously**: Performance can degrade over time
4. **Test Realistically**: Use production-like data and load
5. **Iterate**: Small, incremental improvements add up

Remember: Premature optimization is the root of all evil, but deliberate optimization based on real metrics is essential for scalability.