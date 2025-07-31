# SpinForge Admin & User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [User Interface Guide](#user-interface-guide)
3. [Application Deployment](#application-deployment)
4. [Domain Management](#domain-management)
5. [Resource Management](#resource-management)
6. [Monitoring & Metrics](#monitoring--metrics)
7. [Troubleshooting](#troubleshooting)
8. [System Administration](#system-administration)
9. [Security Management](#security-management)
10. [Backup & Recovery](#backup--recovery)

## Getting Started

### First Login

1. **Access the UI**
   ```
   http://localhost:9010  # Development
   https://spinforge.yourdomain.com  # Production
   ```

2. **Default Credentials**
   - Username: `admin`
   - Password: Set during installation
   - Token: From `.env` file

3. **Initial Setup Checklist**
   - [ ] Change default passwords
   - [ ] Configure domain DNS
   - [ ] Setup SSL certificates
   - [ ] Configure resource limits
   - [ ] Enable monitoring
   - [ ] Setup backup schedule

### User Roles (Planned)

| Role | Permissions |
|------|------------|
| Admin | Full system access |
| Developer | Deploy/manage own apps |
| Viewer | Read-only access |

## User Interface Guide

### Dashboard Overview

```
┌─────────────────────────────────────────────────────┐
│ SpinForge Dashboard                          [User] │
├─────────────────┬───────────────────────────────────┤
│                 │                                     │
│ Navigation      │  Main Content Area                 │
│                 │                                     │
│ - Dashboard     │  ┌─────────────┐ ┌─────────────┐ │
│ - Applications  │  │ Active Apps │ │ Resources   │ │
│ - Deployments   │  │      12     │ │  CPU: 45%   │ │
│ - Monitoring    │  └─────────────┘ └─────────────┘ │
│ - Settings      │                                     │
│                 │  Recent Deployments:               │
│                 │  - api.example.com (2m ago)        │
│                 │  - web.example.com (1h ago)        │
│                 │                                     │
└─────────────────┴───────────────────────────────────┘
```

### Navigation

1. **Dashboard**: System overview and stats
2. **Applications**: List and manage deployed apps
3. **Deployments**: Deploy new applications
4. **Monitoring**: Metrics and logs
5. **Settings**: System configuration

### Application List

Shows all deployed applications with:
- Domain name
- Status (Running, Stopped, Starting)
- Resource usage
- Last deployment time
- Actions (Stop, Restart, Delete)

### Quick Actions

- **Deploy New App**: One-click deployment
- **View Logs**: Real-time application logs
- **Restart App**: Graceful restart
- **Scale App**: Adjust resources

## Application Deployment

### Method 1: Web UI Deployment

1. **Navigate to Deployments**
   - Click "Deploy New Application"

2. **Fill Deployment Form**
   ```yaml
   Domain: myapp.example.com
   Customer Email: user@example.com
   Framework: [Express/Next.js/Remix/Static]
   Source: [Upload/Git URL/Build Path]
   ```

3. **Configure Resources** (Optional)
   ```yaml
   Memory: 512MB (default)
   CPU: 0.5 cores (default)
   Environment Variables: KEY=value
   ```

4. **Deploy**
   - Click "Deploy Application"
   - Monitor progress in real-time

### Method 2: Git Deployment

1. **Prepare Repository**
   ```json
   // package.json
   {
     "name": "my-app",
     "version": "1.0.0",
     "scripts": {
       "start": "node server.js",
       "build": "tsc"  // if using TypeScript
     },
     "dependencies": {
       "express": "^4.18.2"
     }
   }
   ```

2. **Deploy via UI**
   - Enter Git URL: `https://github.com/user/repo.git`
   - Select branch (optional)
   - Configure domain and resources
   - Deploy

3. **Deploy via API**
   ```bash
   curl -X POST https://spinforge.yourdomain.com/api/routes \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "domain": "myapp.example.com",
       "customerId": "customer-123",
       "gitUrl": "https://github.com/user/repo.git",
       "framework": "express",
       "config": {
         "memory": "1GB",
         "cpu": 1
       }
     }'
   ```

### Method 3: Hot Deployment

1. **Create Deployment Package**
   ```bash
   myapp/
   ├── deploy.yaml
   ├── package.json
   ├── server.js
   └── public/
   ```

2. **Create deploy.yaml**
   ```yaml
   name: myapp
   version: 1.0.0
   domain: 
     - myapp.example.com
     - www.myapp.example.com
   customerId: customer-123
   framework: express
   
   # Optional configurations
   build:
     command: npm run build
     outputDir: dist
   
   resources:
     memory: 1GB
     cpu: 1
   
   env:
     NODE_ENV: production
     API_KEY: ${SECRET_API_KEY}  # From environment
   
   scaling:
     min: 1
     max: 5
     targetCPU: 70
   
   healthCheck:
     path: /health
     interval: 30
     timeout: 5
   ```

3. **Deploy**
   ```bash
   # Copy to deployment folder
   cp -r myapp /spinforge/deployments/
   
   # Or use Docker volume
   docker cp myapp spinforge-hub:/spinforge/deployments/
   ```

4. **Check Status**
   - Look for `.deployed` file on success
   - Check `.failed` file for errors

### Method 4: ZIP/Archive Upload

1. **Create Archive**
   ```bash
   # Include all necessary files
   zip -r myapp.zip myapp/
   # or
   tar -czf myapp.tar.gz myapp/
   ```

2. **Upload via UI**
   - Click "Upload Application"
   - Select archive file
   - Configure deployment settings
   - Deploy

### Deployment Configuration Options

#### Framework Detection

SpinForge auto-detects frameworks:

| Framework | Detection | Entry Point |
|-----------|-----------|-------------|
| Express | `express` in package.json | server.js, app.js, index.js |
| Next.js | `next` in package.json | Auto-managed |
| Remix | `@remix-run` in package.json | Auto-managed |
| Static | No framework detected | index.html |

#### Build Configuration

```yaml
build:
  # Custom build command
  command: npm run build:prod
  
  # Output directory (where built files are)
  outputDir: dist
  
  # Environment variables for build only
  env:
    NODE_ENV: production
    API_URL: https://api.example.com
  
  # Install command (default: npm install)
  installCommand: yarn install
  
  # Node version (default: 20)
  nodeVersion: "20"
```

#### Resource Configuration

```yaml
resources:
  # Memory limit (formats: 128MB, 1GB)
  memory: 512MB
  
  # CPU limit (cores: 0.1 to 4)
  cpu: 0.5
  
  # Disk space (future feature)
  disk: 1GB
```

#### Environment Variables

Three ways to set environment variables:

1. **In deploy.yaml**
   ```yaml
   env:
     NODE_ENV: production
     PORT: 3000  # Overridden by SpinForge
   ```

2. **Via UI**
   - Add key-value pairs in deployment form

3. **From Secrets** (planned)
   ```yaml
   env:
     API_KEY: ${SECRET_API_KEY}
     DB_PASS: ${SECRET_DB_PASS}
   ```

## Domain Management

### Domain Configuration

1. **Single Domain**
   ```yaml
   domain: app.example.com
   ```

2. **Multiple Domains**
   ```yaml
   domain:
     - app.example.com
     - www.app.example.com
     - app-staging.example.com
   ```

3. **Wildcard Domains** (planned)
   ```yaml
   domain: "*.app.example.com"
   ```

### DNS Setup

1. **Create DNS Records**
   ```
   Type: A
   Name: *.spinforge
   Value: YOUR_SERVER_IP
   TTL: 300
   ```

2. **For Specific Apps**
   ```
   Type: CNAME
   Name: myapp
   Value: spinforge.yourdomain.com
   TTL: 300
   ```

3. **Verify DNS**
   ```bash
   # Check DNS resolution
   dig myapp.yourdomain.com
   
   # Test connection
   curl -I https://myapp.yourdomain.com
   ```

### SSL/TLS Management

#### Automatic SSL (Planned)
```yaml
ssl:
  enabled: true
  provider: letsencrypt
  email: admin@example.com
```

#### Manual SSL Setup

1. **Generate Certificate**
   ```bash
   # Let's Encrypt
   certbot certonly --webroot \
     -w /var/www/html \
     -d myapp.example.com
   ```

2. **Configure in NGINX**
   ```nginx
   ssl_certificate /path/to/fullchain.pem;
   ssl_certificate_key /path/to/privkey.pem;
   ```

## Resource Management

### Setting Resource Limits

#### Per-Application Limits
```yaml
resources:
  memory: 512MB     # Min: 128MB, Max: 8GB
  cpu: 0.5          # Min: 0.1, Max: 4
  maxRequests: 1000 # Requests per minute
  timeout: 30       # Request timeout in seconds
```

#### Global Defaults
```bash
# In .env file
DEFAULT_MEMORY_LIMIT=512MB
DEFAULT_CPU_LIMIT=0.5
DEFAULT_TIMEOUT=30
```

### Monitoring Resources

1. **Via UI Dashboard**
   - Real-time CPU/Memory graphs
   - Request rate metrics
   - Error rate tracking

2. **Via CLI**
   ```bash
   # Docker
   docker stats spinforge-hub
   
   # Process level
   docker exec spinforge-hub ps aux
   ```

3. **Via API**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://spinforge.yourdomain.com/api/metrics
   ```

### Resource Optimization

1. **Memory Optimization**
   ```javascript
   // Add to package.json scripts
   "start": "node --max-old-space-size=512 server.js"
   ```

2. **CPU Optimization**
   - Use worker threads for CPU-intensive tasks
   - Implement caching
   - Optimize database queries

3. **Auto-Scaling** (Planned)
   ```yaml
   scaling:
     min: 1
     max: 5
     targetCPU: 70
     targetMemory: 80
   ```

## Monitoring & Metrics

### Built-in Monitoring

#### Grafana Dashboards
Access at: `http://localhost:9009`

1. **System Overview**
   - Total applications
   - Active requests
   - System resources
   - Error rates

2. **Application Metrics**
   - Requests per second
   - Response times
   - Error rates
   - Resource usage

3. **Infrastructure Metrics**
   - CPU/Memory usage
   - Disk I/O
   - Network traffic
   - Container stats

#### Prometheus Metrics
Access at: `http://localhost:9008`

Available metrics:
```
# Application metrics
spinforge_requests_total
spinforge_request_duration_seconds
spinforge_errors_total
spinforge_active_connections

# System metrics
spinforge_cpu_usage_percent
spinforge_memory_usage_bytes
spinforge_spinlets_active
spinforge_deployments_total
```

### Log Management

#### View Logs via UI
1. Navigate to Applications
2. Click on app name
3. Select "View Logs"
4. Filter by:
   - Time range
   - Log level
   - Search text

#### View Logs via CLI

```bash
# All logs
docker logs spinforge-hub

# Follow logs
docker logs -f spinforge-hub

# Last 100 lines
docker logs --tail 100 spinforge-hub

# Specific app logs
docker exec spinforge-hub pm2 logs app-name
```

#### Log Levels

Configure in `.env`:
```bash
LOG_LEVEL=debug  # debug, info, warn, error
```

### Alerts (Planned)

```yaml
alerts:
  - name: high-cpu
    condition: cpu > 80
    duration: 5m
    action: email
    
  - name: app-down
    condition: status != running
    duration: 1m
    action: restart
```

## Troubleshooting

### Common Issues

#### Application Won't Start

1. **Check Logs**
   ```bash
   docker logs spinforge-hub | grep "spin-app-name"
   ```

2. **Common Causes**
   - Missing dependencies
   - Syntax errors
   - Port already in use
   - Missing environment variables

3. **Debug Steps**
   ```bash
   # Check if process is running
   docker exec spinforge-hub ps aux | grep node
   
   # Check Redis for app state
   docker exec spinforge-keydb keydb-cli get spinforge:spinlets:app-id
   ```

#### 502 Bad Gateway

1. **Check SpinHub**
   ```bash
   docker logs spinforge-hub
   docker restart spinforge-hub
   ```

2. **Check NGINX**
   ```bash
   docker logs spinforge-nginx
   nginx -t  # Test configuration
   ```

3. **Common Fixes**
   - Increase proxy timeout
   - Check domain configuration
   - Verify SSL certificates

#### High Memory Usage

1. **Identify Culprit**
   ```bash
   docker stats
   docker exec spinforge-hub pm2 monit
   ```

2. **Solutions**
   - Adjust memory limits
   - Enable swap memory
   - Optimize application code
   - Implement caching

#### Build Failures

1. **Check Build Logs**
   ```bash
   docker logs spinforge-builder
   ```

2. **Common Issues**
   - Missing build dependencies
   - TypeScript errors
   - Incompatible Node version
   - Network issues during npm install

3. **Debug Build**
   ```bash
   # Manual build test
   docker exec -it spinforge-builder bash
   cd /builds/your-app
   npm install
   npm run build
   ```

### Debug Mode

Enable debug logging:
```bash
# In .env
LOG_LEVEL=debug
DEBUG=spinforge:*

# Restart services
docker-compose restart
```

### Health Checks

#### System Health
```bash
# Check all services
curl http://localhost:9004/health

# Response
{
  "status": "healthy",
  "services": {
    "redis": "connected",
    "builder": "ready",
    "spinlets": 12
  }
}
```

#### Application Health
```bash
# Check specific app
curl http://myapp.localhost:9006/health

# Custom health endpoint
curl http://myapp.localhost:9006/api/health
```

## System Administration

### User Management (Planned)

#### Create User
```bash
docker exec spinforge-hub node scripts/create-user.js \
  --username developer \
  --email dev@example.com \
  --role developer
```

#### Manage Permissions
```yaml
roles:
  developer:
    - apps:create
    - apps:read
    - apps:update
    - apps:delete:own
  viewer:
    - apps:read
    - metrics:read
```

### Configuration Management

#### Update Configuration

1. **Edit .env file**
   ```bash
   nano .env
   ```

2. **Restart services**
   ```bash
   docker-compose restart
   ```

#### Configuration Options

```bash
# Performance
WORKER_PROCESSES=4
WORKER_CONNECTIONS=1024
CLIENT_MAX_BODY_SIZE=100M

# Security
ENABLE_RATE_LIMIT=true
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Timeouts
PROXY_TIMEOUT=60
BUILD_TIMEOUT=600
IDLE_TIMEOUT=300

# Limits
MAX_APPS_PER_CUSTOMER=50
MAX_DOMAINS_PER_APP=10
MAX_BUILD_SIZE=500MB
```

### Maintenance Mode

#### Enable Maintenance
```bash
# Create maintenance file
docker exec spinforge-hub touch /spinforge/MAINTENANCE

# Custom maintenance page
docker exec spinforge-hub cp maintenance.html /spinforge/public/
```

#### Disable Maintenance
```bash
docker exec spinforge-hub rm /spinforge/MAINTENANCE
```

### System Updates

#### Update SpinForge

1. **Backup First**
   ```bash
   ./scripts/backup.sh
   ```

2. **Pull Updates**
   ```bash
   git pull origin main
   ```

3. **Rebuild**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

4. **Run Migrations** (if any)
   ```bash
   docker exec spinforge-hub node scripts/migrate.js
   ```

#### Update Dependencies

```bash
# Update Node packages
docker exec spinforge-hub npm update

# Update system packages
docker exec spinforge-hub apk update && apk upgrade
```

## Security Management

### Access Control

#### API Authentication
```bash
# Generate new token
openssl rand -base64 32

# Update in .env
ADMIN_TOKEN=new_token_here

# Use in requests
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://spinforge.yourdomain.com/api/routes
```

#### IP Whitelisting

1. **NGINX Level**
   ```nginx
   location /api {
     allow 192.168.1.0/24;
     allow 10.0.0.0/8;
     deny all;
   }
   ```

2. **Application Level**
   ```yaml
   security:
     allowedIPs:
       - 192.168.1.0/24
       - 203.0.113.0/24
   ```

### Security Headers

Automatically applied:
```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

### Secrets Management

#### Environment Secrets
```bash
# Create secret
docker exec spinforge-hub node scripts/create-secret.js \
  --name API_KEY \
  --value "secret-value"

# Use in deployment
env:
  API_KEY: ${SECRET_API_KEY}
```

#### File Secrets
```yaml
secrets:
  - name: ssl-cert
    file: /path/to/cert.pem
  - name: api-key
    file: /path/to/api.key
```

### Audit Logging

#### Enable Audit Logs
```bash
# In .env
ENABLE_AUDIT_LOG=true
AUDIT_LOG_PATH=/spinforge/logs/audit.log
```

#### Audit Events
- User login/logout
- Application deployment
- Configuration changes
- Resource modifications
- Security events

## Backup & Recovery

### Automated Backups

#### Setup Backup Schedule

1. **Create Backup Script**
   ```bash
   #!/bin/bash
   # /spinforge/scripts/backup.sh
   
   BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
   mkdir -p $BACKUP_DIR
   
   # Backup Redis
   docker exec spinforge-keydb keydb-cli \
     -a $REDIS_PASSWORD \
     --rdb $BACKUP_DIR/dump.rdb
   
   # Backup deployments
   docker cp spinforge-hub:/spinforge/deployments \
     $BACKUP_DIR/deployments
   
   # Backup configurations
   cp .env $BACKUP_DIR/
   cp docker-compose.yml $BACKUP_DIR/
   
   # Create archive
   tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
   rm -rf $BACKUP_DIR
   
   # Upload to S3 (optional)
   aws s3 cp $BACKUP_DIR.tar.gz \
     s3://your-bucket/spinforge-backups/
   
   # Clean old backups (keep 30 days)
   find /backups -name "*.tar.gz" -mtime +30 -delete
   ```

2. **Schedule with Cron**
   ```bash
   # Add to crontab
   0 2 * * * /spinforge/scripts/backup.sh
   ```

### Manual Backup

```bash
# Full system backup
docker run --rm \
  -v spinforge_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/spinforge-backup.tar.gz /data

# Database only
docker exec spinforge-keydb keydb-cli \
  -a $REDIS_PASSWORD \
  SAVE

docker cp spinforge-keydb:/data/dump.rdb ./backups/
```

### Recovery Procedures

#### Full Recovery

1. **Stop Services**
   ```bash
   docker-compose down
   ```

2. **Restore Data**
   ```bash
   # Extract backup
   tar -xzf spinforge-backup.tar.gz
   
   # Restore volumes
   docker run --rm \
     -v spinforge_data:/data \
     -v $(pwd)/backup:/backup \
     alpine tar xzf /backup/data.tar.gz -C /
   ```

3. **Start Services**
   ```bash
   docker-compose up -d
   ```

#### Selective Recovery

```bash
# Restore specific app
docker cp backup/deployments/myapp \
  spinforge-hub:/spinforge/deployments/

# Restore Redis data
docker cp backup/dump.rdb spinforge-keydb:/data/
docker exec spinforge-keydb keydb-cli \
  -a $REDIS_PASSWORD \
  SHUTDOWN SAVE
docker restart spinforge-keydb
```

### Disaster Recovery Plan

1. **Regular Backups**
   - Daily automated backups
   - Weekly full system snapshots
   - Monthly offsite archives

2. **Recovery Testing**
   - Monthly recovery drills
   - Document recovery times
   - Update procedures

3. **High Availability** (Future)
   - Multi-region deployment
   - Real-time replication
   - Automatic failover

## Best Practices

### Deployment Best Practices

1. **Use Git for Source Control**
   - Tag releases
   - Use branches for environments
   - Implement CI/CD

2. **Environment Management**
   ```yaml
   # dev.yaml
   domain: dev.myapp.example.com
   env:
     NODE_ENV: development
     DEBUG: true
   
   # prod.yaml
   domain: myapp.example.com
   env:
     NODE_ENV: production
     DEBUG: false
   ```

3. **Health Checks**
   ```javascript
   app.get('/health', (req, res) => {
     res.json({
       status: 'healthy',
       uptime: process.uptime(),
       timestamp: Date.now()
     });
   });
   ```

### Security Best Practices

1. **Never Commit Secrets**
   ```bash
   # .gitignore
   .env
   *.key
   *.pem
   secrets/
   ```

2. **Use Strong Passwords**
   ```bash
   # Generate secure passwords
   openssl rand -base64 32
   ```

3. **Regular Updates**
   - Update SpinForge monthly
   - Update dependencies weekly
   - Apply security patches immediately

### Performance Best Practices

1. **Optimize Images**
   - Use WebP format
   - Implement lazy loading
   - CDN for static assets

2. **Enable Caching**
   ```javascript
   // Cache static assets
   app.use(express.static('public', {
     maxAge: '1d',
     etag: true
   }));
   ```

3. **Database Optimization**
   - Use connection pooling
   - Implement query caching
   - Regular maintenance

### Monitoring Best Practices

1. **Set Up Alerts**
   - CPU > 80% for 5 minutes
   - Memory > 90%
   - Error rate > 1%
   - Response time > 1s

2. **Regular Reviews**
   - Weekly metric reviews
   - Monthly capacity planning
   - Quarterly optimization

3. **Documentation**
   - Document all changes
   - Maintain runbooks
   - Update procedures

## Advanced Topics

### Custom Domains with CNAME

```bash
# Customer domain: app.customer.com
# CNAME to: myapp.spinforge.yourdomain.com

# In deploy.yaml
domain:
  - myapp.spinforge.yourdomain.com
  - app.customer.com
```

### Blue-Green Deployments (Planned)

```yaml
deployment:
  strategy: blue-green
  stages:
    - deploy: blue
    - test: blue
    - switch: blue
    - cleanup: green
```

### Canary Releases (Planned)

```yaml
deployment:
  strategy: canary
  stages:
    - traffic: 10%
      duration: 10m
    - traffic: 50%
      duration: 30m
    - traffic: 100%
```

### API Gateway Features (Planned)

```yaml
api:
  rateLimit:
    - path: /api/*
      limit: 100
      window: 60s
  
  transform:
    - path: /api/v1/*
      rewrite: /v1/*
  
  auth:
    - path: /api/private/*
      type: jwt
      secret: ${JWT_SECRET}
```

## Support

### Getting Help

1. **Documentation**: You're reading it!
2. **Logs**: Check application and system logs
3. **Community**: Discord/Slack channels
4. **Issues**: GitHub issue tracker
5. **Support**: support@spinforge.io

### Reporting Issues

Include:
- SpinForge version
- Error messages
- Steps to reproduce
- Log excerpts
- Environment details

### Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Code of conduct
- Development setup
- Pull request process
- Coding standards