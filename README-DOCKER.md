# SpinForge Docker Deployment Guide 🐳

Deploy SpinForge using Docker Compose - the micro hosting platform that scales to millions without reloads!

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   OpenResty     │────▶│     KeyDB       │     │  Static Files   │
│  (Nginx + Lua)  │     │  (Redis Fork)   │     │   /var/www/     │
│   Port 80/443   │     │   Port 16378    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       ▲
         │                       │
         ▼                       │
┌─────────────────┐              │
│   API Server    │──────────────┘
│   (Node.js)     │
│    Port 8080    │
└─────────────────┘
```

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB+ RAM available
- Ports 80, 443, and 8080 available

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/spinforge.git
cd spinforge
```

### 2. Environment Setup (Optional)
```bash
# Create .env file for production
cat > .env << EOF
REDIS_PASSWORD=your-secure-password
REDIS_DB=1
EOF
```

### 3. Start All Services
```bash
docker compose up -d

# Check status
docker compose ps
```

### 4. Deploy Your First Site
```bash
# Create a site
curl -X POST http://localhost:8080/api/vhost \
  -H "Content-Type: application/json" \
  -d '{"subdomain": "hello", "type": "static"}'

# Deploy files
echo "<h1>Hello SpinForge!</h1>" > index.html
docker cp index.html spinforge-openresty:/var/www/static/hello/

# Test (add to /etc/hosts: 127.0.0.1 hello.spinforge.io)
curl http://hello.spinforge.io
```

## Service Details

### Core Services

| Service | Container Name | Port | Description |
|---------|---------------|------|-------------|
| **OpenResty** | spinforge-openresty | 80, 443 | Web server with Lua routing |
| **KeyDB** | spinforge-keydb | 16378 | Redis-compatible data store |
| **API** | spinforge-api | 8080 | Management REST API |

### Service URLs

- **API Health**: http://localhost:8080/health
- **OpenResty Health**: http://localhost:8082/health
- **API Documentation**: http://localhost:8080/api/docs

## Docker Compose Configuration

### Default docker-compose.yml

```yaml
services:
  keydb:
    image: eqalpha/keydb:latest
    container_name: spinforge-keydb
    command: keydb-server --appendonly yes --port 16378
    volumes:
      - keydb-data:/data
    healthcheck:
      test: ["CMD", "keydb-cli", "-p", "16378", "ping"]
      interval: 10s

  openresty:
    build: ./hosting/openresty
    container_name: spinforge-openresty
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./hosting/data/static:/var/www/static
      - openresty-logs:/var/log/nginx
    depends_on:
      keydb:
        condition: service_healthy

  api:
    build: ./hosting/api
    container_name: spinforge-api
    ports:
      - "8080:8080"
    environment:
      - REDIS_HOST=keydb
      - REDIS_PORT=16378
    depends_on:
      - keydb
      - openresty

volumes:
  keydb-data:
  openresty-logs:
```

## Data Management

### Volume Locations

| Volume | Purpose | Container Path |
|--------|---------|----------------|
| `keydb-data` | Route storage | `/data` |
| `openresty-logs` | Access/error logs | `/var/log/nginx` |
| `./hosting/data/static` | Website files | `/var/www/static` |

### Backup KeyDB Data

```bash
# Create backup
docker exec spinforge-keydb redis-cli -p 16378 --rdb /tmp/backup.rdb
docker cp spinforge-keydb:/tmp/backup.rdb ./backup-$(date +%Y%m%d-%H%M%S).rdb

# Restore backup
docker cp backup.rdb spinforge-keydb:/data/dump.rdb
docker restart spinforge-keydb
```

### Backup Static Files

```bash
# Backup all sites
tar -czf sites-backup-$(date +%Y%m%d).tar.gz hosting/data/static/

# Restore sites
tar -xzf sites-backup.tar.gz
```

## Production Deployment

### 1. Use Environment Variables

```bash
# Production .env file
cat > .env.prod << EOF
# Redis Security
REDIS_PASSWORD=strong-password-here
REDIS_DB=1

# API Configuration
API_PORT=8080
NODE_ENV=production

# Domain Configuration
PRIMARY_DOMAIN=yourdomain.com
EOF

# Start with production config
docker compose --env-file .env.prod up -d
```

### 2. Enable HTTPS (Manual Setup)

```nginx
# Add to hosting/openresty/nginx.conf
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # ... rest of config
}
```

### 3. Resource Limits

```yaml
# docker-compose.prod.yml
services:
  openresty:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### 4. Logging Configuration

```bash
# Configure log rotation
cat > /etc/logrotate.d/spinforge << EOF
/var/lib/docker/volumes/spinforge_openresty-logs/_data/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
EOF
```

## Monitoring

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f openresty --tail 50

# API logs
docker compose logs -f api --tail 100
```

### Metrics Endpoint

```bash
# Get request metrics
curl http://localhost:8080/api/metrics

# Example output:
{
  "totalRequests": 45678,
  "domains": {
    "test-portfolio": 1234,
    "test-blog": 890
  }
}
```

### Health Checks

```bash
# Create monitoring script
cat > check-health.sh << 'EOF'
#!/bin/bash
echo "Checking SpinForge Health..."

# Check API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
echo "API Status: $API_STATUS"

# Check OpenResty
NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/health)
echo "OpenResty Status: $NGINX_STATUS"

# Check Redis
REDIS_STATUS=$(docker exec spinforge-keydb redis-cli -p 16378 ping)
echo "KeyDB Status: $REDIS_STATUS"
EOF

chmod +x check-health.sh
./check-health.sh
```

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  openresty:
    deploy:
      replicas: 3
  
  api:
    deploy:
      replicas: 2
```

### Load Balancer Setup

```nginx
# Use HAProxy or nginx in front
upstream spinforge {
    server spinforge1.example.com;
    server spinforge2.example.com;
    server spinforge3.example.com;
}
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using port 80
sudo lsof -i :80

# Use different ports
sed -i 's/80:80/8880:80/g' docker-compose.yml
sed -i 's/443:443/8443:443/g' docker-compose.yml
```

#### 2. Site Not Loading
```bash
# Check if vhost exists
curl http://localhost:8080/api/vhost

# Check files exist
docker exec spinforge-openresty ls -la /var/www/static/yoursite/

# Check OpenResty error log
docker exec spinforge-openresty tail -50 /var/log/nginx/error.log
```

#### 3. Redis Connection Failed
```bash
# Check KeyDB is running
docker ps | grep keydb

# Test connection
docker exec -it spinforge-keydb redis-cli -p 16378 ping

# Check network
docker network ls
docker network inspect spinforge_spinforge
```

### Reset Everything

```bash
# Stop and remove all
docker compose down -v

# Remove all data
rm -rf hosting/data/static/*

# Start fresh
docker compose up -d
```

## Development Mode

### Hot Reload for API

```bash
# Mount source code
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# docker-compose.dev.yml
services:
  api:
    volumes:
      - ./hosting/api:/app
    command: npm run dev
```

### Testing Changes

```bash
# Rebuild specific service
docker compose build api
docker compose up -d api

# Watch logs
docker compose logs -f api
```

## Security Best Practices

1. **Always set Redis password in production**
2. **Use HTTPS for public deployments**
3. **Restrict API access with firewall rules**
4. **Regular backups of KeyDB and static files**
5. **Monitor logs for suspicious activity**

## Performance Tuning

### OpenResty Optimization

```nginx
# In nginx.conf
worker_processes auto;
worker_connections 4096;

# Lua shared memory
lua_shared_dict routes_cache 100m;  # Increase for more sites
```

### KeyDB Optimization

```bash
# Set max memory
docker exec spinforge-keydb redis-cli -p 16378 CONFIG SET maxmemory 2gb
docker exec spinforge-keydb redis-cli -p 16378 CONFIG SET maxmemory-policy allkeys-lru
```

## Support

- **Documentation**: [README.md](README.md)
- **Quick Start**: [QUICKSTART.md](QUICKSTART.md)
- **Issues**: GitHub Issues
- **Community**: Discord/Slack

---

🚀 **SpinForge** - Host millions of sites without a single reload!