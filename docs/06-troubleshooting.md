# SpinForge Troubleshooting Guide

## Table of Contents
1. [Common Issues](#common-issues)
2. [Deployment Problems](#deployment-problems)
3. [Runtime Errors](#runtime-errors)
4. [Performance Issues](#performance-issues)
5. [Network Problems](#network-problems)
6. [Database Issues](#database-issues)
7. [Debug Techniques](#debug-techniques)
8. [Log Analysis](#log-analysis)
9. [Recovery Procedures](#recovery-procedures)

## Common Issues

### SpinHub Won't Start

**Symptoms:**
- SpinHub container exits immediately
- Error: "Cannot connect to Redis"
- Port already in use

**Solutions:**

1. **Check Redis Connection:**
```bash
# Test Redis connection
docker exec spinforge-keydb keydb-cli -a $REDIS_PASSWORD ping
# Should return: PONG

# Check Redis logs
docker logs spinforge-keydb

# Verify Redis password in .env
grep REDIS_PASSWORD .env
```

2. **Port Conflicts:**
```bash
# Check if ports are in use
netstat -tlnp | grep -E '(9004|8080)'
lsof -i :9004

# Kill process using port
kill -9 $(lsof -t -i:9004)

# Or change port in docker-compose.yml
```

3. **Missing Dependencies:**
```bash
# Rebuild with fresh dependencies
docker-compose build --no-cache spinhub
docker-compose up -d spinhub
```

### 502 Bad Gateway Error

**Symptoms:**
- NGINX returns 502 error
- "upstream connect() failed"
- Application not accessible

**Solutions:**

1. **Check SpinHub Health:**
```bash
# Check if SpinHub is running
docker ps | grep spinforge-hub

# Check SpinHub logs
docker logs spinforge-hub --tail 100

# Test SpinHub directly
curl http://localhost:9004/health
```

2. **Restart Services:**
```bash
# Restart in correct order
docker-compose restart keydb
sleep 5
docker-compose restart spinhub
docker-compose restart nginx
```

3. **Check NGINX Config:**
```bash
# Test NGINX configuration
docker exec spinforge-nginx nginx -t

# View NGINX error logs
docker logs spinforge-nginx --tail 50
```

### Application Won't Deploy

**Symptoms:**
- Deployment stuck in "deploying" state
- Build fails
- No response after deployment

**Solutions:**

1. **Check Builder Logs:**
```bash
# View builder logs
docker logs spinforge-builder --tail 100

# Check build queue
docker exec spinforge-keydb keydb-cli -a $REDIS_PASSWORD lrange build:queue 0 -1
```

2. **Verify Build Path:**
```bash
# For Docker deployment
docker exec spinforge-hub ls -la /spinforge/examples/test-app

# Check deployment directory
docker exec spinforge-hub ls -la /spinforge/deployments/
```

3. **Manual Build Test:**
```bash
# Enter builder container
docker exec -it spinforge-builder sh

# Try manual build
cd /builds/your-app
npm install
npm run build
```

## Deployment Problems

### Build Failures

#### TypeScript Compilation Errors

**Error:**
```
error TS2307: Cannot find module 'express'
```

**Solution:**
```bash
# Ensure dependencies are installed
npm install --save express
npm install --save-dev @types/express

# Check tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

#### Missing Build Script

**Error:**
```
npm ERR! Missing script: "build"
```

**Solution:**
Add build script to package.json:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

#### Out of Memory During Build

**Error:**
```
FATAL ERROR: Reached heap limit Allocation failed
```

**Solution:**
1. Increase builder memory:
```yaml
# docker-compose.yml
builder:
  mem_limit: 2g
```

2. Optimize build:
```json
{
  "scripts": {
    "build": "node --max-old-space-size=1024 ./node_modules/.bin/tsc"
  }
}
```

### Git Clone Failures

**Error:**
```
fatal: could not read Username for 'https://github.com'
```

**Solutions:**

1. **Use Public Repository:**
```yaml
gitUrl: https://github.com/username/public-repo.git
```

2. **Use Personal Access Token:**
```yaml
gitUrl: https://TOKEN@github.com/username/private-repo.git
```

3. **Configure Git Credentials:**
```bash
docker exec spinforge-builder git config --global credential.helper store
```

### Domain Not Working

**Symptoms:**
- "No application configured for this domain"
- DNS resolution works but app doesn't load

**Solutions:**

1. **Verify Route:**
```bash
# Check if route exists
docker exec spinforge-keydb keydb-cli -a $REDIS_PASSWORD get spinforge:routes:yourdomain.com

# List all routes
docker exec spinforge-keydb keydb-cli -a $REDIS_PASSWORD keys spinforge:routes:*
```

2. **Check Domain Mapping:**
```bash
# View domain to spinlet mapping
docker exec spinforge-keydb keydb-cli -a $REDIS_PASSWORD get spinforge:domain:yourdomain.com
```

3. **DNS Configuration:**
```bash
# Verify DNS resolution
dig yourdomain.com
nslookup yourdomain.com

# Test with curl
curl -H "Host: yourdomain.com" http://your-server-ip:9006
```

## Runtime Errors

### Application Crashes on Start

**Symptoms:**
- Application starts then immediately stops
- Exit code 1
- "Module not found" errors

**Solutions:**

1. **Check Application Logs:**
```bash
# Get spinlet ID
docker exec spinforge-keydb keydb-cli -a $REDIS_PASSWORD keys spinforge:spinlets:*

# View application output
docker exec spinforge-hub pm2 logs spin-app-123
```

2. **Verify Entry Point:**
```bash
# Check package.json main field
docker exec spinforge-hub cat /spinforge/apps/your-app/package.json | grep main

# Verify file exists
docker exec spinforge-hub ls -la /spinforge/apps/your-app/
```

3. **Test Locally:**
```bash
# Clone your app
git clone your-repo
cd your-app
npm install
npm start
```

### Memory Limit Exceeded

**Symptoms:**
- Application killed with OOM
- Performance degradation
- Random crashes

**Solutions:**

1. **Increase Memory Limit:**
```yaml
# deploy.yaml
resources:
  memory: 1GB  # Increase from 512MB
```

2. **Optimize Application:**
```javascript
// Use streams for large files
const stream = fs.createReadStream('large-file.txt');
stream.pipe(response);

// Clear unused variables
let largeData = null; // Clear reference
global.gc(); // Force garbage collection if --expose-gc
```

3. **Monitor Memory Usage:**
```bash
# Real-time memory monitoring
docker exec spinforge-hub pm2 monit

# Check memory limits
docker stats spinforge-hub
```

### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

1. **Let SpinForge Assign Port:**
```javascript
// Use PORT environment variable
const port = process.env.PORT || 3000;
app.listen(port);
```

2. **Check Port Allocation:**
```bash
# View allocated ports
docker exec spinforge-keydb keydb-cli -a $REDIS_PASSWORD smembers spinforge:ports:allocated
```

## Performance Issues

### Slow Response Times

**Symptoms:**
- High latency
- Timeouts
- Poor user experience

**Diagnosis:**

1. **Check Metrics:**
```bash
# View response time metrics
curl http://localhost:9008/metrics | grep response_time

# Check application logs for slow queries
docker logs spinforge-hub | grep -E "slow|timeout"
```

2. **Enable Debug Logging:**
```javascript
// Add request timing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.log(`Slow request: ${req.method} ${req.url} took ${duration}ms`);
    }
  });
  next();
});
```

**Solutions:**

1. **Enable Caching:**
```javascript
// Redis caching
const cache = require('./cache');
app.get('/api/data', async (req, res) => {
  const cached = await cache.get('data');
  if (cached) return res.json(cached);
  
  const data = await fetchData();
  await cache.set('data', data, 300); // 5 min TTL
  res.json(data);
});
```

2. **Optimize Database Queries:**
```javascript
// Use indexes
db.collection.createIndex({ userId: 1, createdAt: -1 });

// Limit results
const results = await db.find().limit(20);
```

### High CPU Usage

**Symptoms:**
- CPU constantly at 100%
- Application becomes unresponsive
- Other apps affected

**Solutions:**

1. **Identify CPU-Intensive Code:**
```javascript
// Profile your app
const profiler = require('v8-profiler-next');
profiler.startProfiling('CPU profile');
setTimeout(() => {
  const profile = profiler.stopProfiling();
  profile.export((err, result) => {
    fs.writeFileSync('cpu-profile.cpuprofile', result);
  });
}, 10000);
```

2. **Use Worker Threads:**
```javascript
const { Worker } = require('worker_threads');

// Offload CPU-intensive work
app.post('/process', (req, res) => {
  const worker = new Worker('./heavy-task.js', {
    workerData: req.body
  });
  
  worker.on('message', (result) => {
    res.json(result);
  });
});
```

### Memory Leaks

**Symptoms:**
- Memory usage grows over time
- Application becomes slower
- Eventually crashes with OOM

**Detection:**

1. **Monitor Memory Growth:**
```bash
# Track memory over time
while true; do
  docker exec spinforge-hub ps aux | grep node
  sleep 60
done
```

2. **Heap Snapshots:**
```javascript
// Take heap snapshots
const v8 = require('v8');
const fs = require('fs');

setInterval(() => {
  const snapshot = v8.writeHeapSnapshot();
  console.log(`Heap snapshot written to ${snapshot}`);
}, 3600000); // Every hour
```

**Common Causes & Fixes:**

1. **Event Listener Leaks:**
```javascript
// Bad: Creates new listener each request
app.get('/events', (req, res) => {
  emitter.on('data', (data) => res.write(data));
});

// Good: Clean up listeners
app.get('/events', (req, res) => {
  const handler = (data) => res.write(data);
  emitter.on('data', handler);
  
  req.on('close', () => {
    emitter.removeListener('data', handler);
  });
});
```

2. **Global Variable Accumulation:**
```javascript
// Bad: Keeps growing
const cache = [];
app.post('/data', (req, res) => {
  cache.push(req.body);
});

// Good: Limit size
const LRU = require('lru-cache');
const cache = new LRU({ max: 1000 });
```

## Network Problems

### SSL Certificate Issues

**Error:**
```
SSL_ERROR_NO_CYPHER_OVERLAP
NET::ERR_CERT_AUTHORITY_INVALID
```

**Solutions:**

1. **Generate Self-Signed Cert (Development):**
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /spinforge/data/ssl/privkey.pem \
  -out /spinforge/data/ssl/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=*.localhost"
```

2. **Use Let's Encrypt (Production):**
```bash
# Install certbot
docker exec spinforge-nginx apk add certbot certbot-nginx

# Generate certificate
docker exec spinforge-nginx certbot --nginx \
  -d yourdomain.com \
  -d *.yourdomain.com \
  --non-interactive \
  --agree-tos \
  --email admin@yourdomain.com
```

### WebSocket Connection Failures

**Error:**
```
WebSocket connection to 'wss://...' failed
Error during WebSocket handshake
```

**Solutions:**

1. **Update NGINX Config:**
```nginx
location / {
    proxy_pass http://spinhub;
    
    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 86400;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

2. **Handle in Application:**
```javascript
// Proper WebSocket handling
const WebSocket = require('ws');
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: false
});

wss.on('connection', (ws) => {
  // Send ping every 30s to keep alive
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);
  
  ws.on('close', () => clearInterval(interval));
});
```

### CORS Issues

**Error:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Solutions:**

1. **Configure CORS in Application:**
```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

2. **NGINX CORS Headers:**
```nginx
add_header Access-Control-Allow-Origin $http_origin always;
add_header Access-Control-Allow-Credentials true always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;

if ($request_method = 'OPTIONS') {
    return 204;
}
```

## Database Issues

### Connection Pool Exhausted

**Error:**
```
Error: Connection pool exhausted
TimeoutError: ResourceRequest timed out
```

**Solutions:**

1. **Increase Pool Size:**
```javascript
// PostgreSQL
const pool = new Pool({
  max: 20, // Increase from default 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// MongoDB
mongoose.connect(uri, {
  maxPoolSize: 20,
  serverSelectionTimeoutMS: 5000,
});
```

2. **Ensure Connections Are Released:**
```javascript
// Bad: Connection leak
app.get('/users', async (req, res) => {
  const client = await pool.connect();
  const result = await client.query('SELECT * FROM users');
  res.json(result.rows);
  // Missing: client.release()
});

// Good: Always release
app.get('/users', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users');
    res.json(result.rows);
  } finally {
    client.release();
  }
});
```

### Slow Queries

**Diagnosis:**

1. **Enable Query Logging:**
```javascript
// PostgreSQL
const query = 'SELECT * FROM large_table WHERE status = $1';
console.time(query);
const result = await pool.query(query, ['active']);
console.timeEnd(query);

// MongoDB
mongoose.set('debug', true);
```

2. **Use EXPLAIN:**
```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

**Solutions:**

1. **Add Indexes:**
```sql
-- PostgreSQL
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);

-- MongoDB
db.users.createIndex({ email: 1 });
db.orders.createIndex({ userId: 1, createdAt: -1 });
```

2. **Optimize Queries:**
```javascript
// Bad: N+1 problem
const users = await getUsers();
for (const user of users) {
  user.orders = await getOrdersByUserId(user.id);
}

// Good: Single query with join
const users = await db.query(`
  SELECT u.*, array_agg(o.*) as orders
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  GROUP BY u.id
`);
```

## Debug Techniques

### Enable Debug Mode

1. **Application Debug:**
```bash
# Set in deploy.yaml
env:
  DEBUG: "app:*"
  LOG_LEVEL: debug
```

2. **SpinForge Debug:**
```bash
# Update .env
DEBUG=spinforge:*
LOG_LEVEL=debug

# Restart services
docker-compose restart
```

### Remote Debugging

1. **Node.js Inspector:**
```yaml
# deploy.yaml
debug:
  enabled: true
  port: 9229
```

```bash
# Connect Chrome DevTools
chrome://inspect

# Or use VS Code
{
  "type": "node",
  "request": "attach",
  "name": "Attach to SpinForge App",
  "address": "localhost",
  "port": 9229,
  "remoteRoot": "/spinforge/apps/your-app",
  "localRoot": "${workspaceFolder}"
}
```

### Container Debugging

1. **Enter Container:**
```bash
# Execute bash in container
docker exec -it spinforge-hub bash

# Run commands inside
cd /spinforge/apps/your-app
npm list
cat package.json
node --version
```

2. **Copy Files for Analysis:**
```bash
# Copy app files
docker cp spinforge-hub:/spinforge/apps/your-app ./debug-app

# Copy logs
docker cp spinforge-hub:/spinforge/logs ./debug-logs
```

## Log Analysis

### Centralized Logging

1. **View All Logs:**
```bash
# Follow all SpinForge logs
docker-compose logs -f

# Specific service
docker-compose logs -f spinhub builder

# Save to file
docker-compose logs > spinforge.log
```

2. **Search Logs:**
```bash
# Find errors
docker-compose logs | grep -i error

# Find by request ID
docker-compose logs | grep "req-abc123"

# Find by time range
docker-compose logs --since "2025-01-19T10:00:00" --until "2025-01-19T11:00:00"
```

### Log Aggregation

1. **JSON Logging:**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

// Structured logging
logger.info('Request processed', {
  requestId: req.id,
  userId: req.user.id,
  duration: Date.now() - start,
  status: res.statusCode
});
```

2. **Log Shipping (Future):**
```yaml
# docker-compose.yml addition
fluentd:
  image: fluent/fluentd
  volumes:
    - ./fluent.conf:/fluentd/etc/fluent.conf
    - /var/lib/docker/containers:/var/lib/docker/containers:ro
```

## Recovery Procedures

### Disaster Recovery

1. **Full System Recovery:**
```bash
# Stop all services
docker-compose down

# Restore from backup
tar -xzf backup-20250119.tar.gz

# Copy data
cp -r backup/redis-data/* /var/lib/docker/volumes/spinforge_redis-data/_data/
cp -r backup/apps/* /var/lib/docker/volumes/spinforge_apps/_data/

# Start services
docker-compose up -d
```

2. **Partial Recovery:**
```bash
# Recover specific app
docker cp backup/apps/my-app spinforge-hub:/spinforge/apps/

# Restore Redis data
docker cp backup/dump.rdb spinforge-keydb:/data/
docker restart spinforge-keydb
```

### Emergency Procedures

1. **Stop All Applications:**
```bash
# Emergency stop script
cat > emergency-stop.sh << 'EOF'
#!/bin/bash
echo "Emergency shutdown initiated..."

# Stop all spinlets
docker exec spinforge-hub pm2 stop all

# Clear active spinlets
docker exec spinforge-keydb keydb-cli -a $REDIS_PASSWORD del spinforge:active

# Restart hub
docker restart spinforge-hub
EOF

chmod +x emergency-stop.sh
./emergency-stop.sh
```

2. **Clear All Caches:**
```bash
# Clear Redis cache
docker exec spinforge-keydb keydb-cli -a $REDIS_PASSWORD FLUSHDB

# Clear build cache
docker exec spinforge-builder rm -rf /cache/*

# Clear nginx cache
docker exec spinforge-nginx rm -rf /var/cache/nginx/*
```

### Health Verification

1. **System Health Check:**
```bash
#!/bin/bash
# health-check.sh

echo "=== SpinForge Health Check ==="

# Check containers
echo -n "Containers: "
if [ $(docker ps | grep spinforge | wc -l) -eq 7 ]; then
  echo "✓ All running"
else
  echo "✗ Some containers down"
  docker ps -a | grep spinforge
fi

# Check Redis
echo -n "Redis: "
if docker exec spinforge-keydb keydb-cli -a $REDIS_PASSWORD ping > /dev/null 2>&1; then
  echo "✓ Connected"
else
  echo "✗ Not responding"
fi

# Check SpinHub
echo -n "SpinHub: "
if curl -s http://localhost:9004/health | grep -q "ok"; then
  echo "✓ Healthy"
else
  echo "✗ Not healthy"
fi

# Check NGINX
echo -n "NGINX: "
if docker exec spinforge-nginx nginx -t > /dev/null 2>&1; then
  echo "✓ Config valid"
else
  echo "✗ Config error"
fi
```

## Getting Help

### Collect Diagnostic Info

```bash
#!/bin/bash
# collect-diagnostics.sh

DIAG_DIR="spinforge-diagnostics-$(date +%Y%m%d-%H%M%S)"
mkdir -p $DIAG_DIR

# System info
echo "=== System Info ===" > $DIAG_DIR/system.txt
uname -a >> $DIAG_DIR/system.txt
docker version >> $DIAG_DIR/system.txt
docker-compose version >> $DIAG_DIR/system.txt

# Container status
docker ps -a > $DIAG_DIR/containers.txt
docker stats --no-stream > $DIAG_DIR/stats.txt

# Logs (last 1000 lines)
docker-compose logs --tail 1000 > $DIAG_DIR/logs.txt

# Configuration (sanitized)
cp .env $DIAG_DIR/env.txt
sed -i 's/PASSWORD=.*/PASSWORD=REDACTED/g' $DIAG_DIR/env.txt

# Redis info
docker exec spinforge-keydb keydb-cli -a $REDIS_PASSWORD INFO > $DIAG_DIR/redis-info.txt

# Create archive
tar -czf $DIAG_DIR.tar.gz $DIAG_DIR
rm -rf $DIAG_DIR

echo "Diagnostics collected: $DIAG_DIR.tar.gz"
```

### Community Support

1. **GitHub Issues**: Include diagnostic info
2. **Discord/Slack**: Real-time help
3. **Stack Overflow**: Tag with `spinforge`
4. **Documentation**: Check docs first

### Emergency Contacts

- Critical Issues: security@spinforge.io
- Enterprise Support: support@spinforge.io