# SpinForge Docker Deployment Guide

This guide walks you through deploying SpinForge using Docker Compose, including all components and monitoring stack.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available for containers
- 10GB+ disk space

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/spinforge.git
   cd spinforge
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build and start all services**
   ```bash
   docker-compose up -d
   ```

4. **Verify services are running**
   ```bash
   docker-compose ps
   ```

## Service Overview

| Service | Port | Description |
|---------|------|-------------|
| nginx | 80, 443 | Reverse proxy and load balancer |
| spinhub | 8080 | Main routing and orchestration service |
| builder-service | 3001 | Application build service |
| keydb | 6379 | Primary data store |
| prometheus | 9090 | Metrics collection |
| grafana | 3000 | Monitoring dashboards |
| backup | - | Automated backup service |

## Accessing Services

### SpinForge Web Interface
- URL: http://localhost
- Admin API: http://localhost/_admin/spinlets

### Monitoring
- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090

### Health Checks
```bash
# Check SpinHub health
curl http://localhost/_health

# Check metrics
curl http://localhost/_metrics
```

## Deploying Applications

### Using the CLI
```bash
# Build and run the CLI
docker-compose run --rm cli spinforge deploy \
  --source ./my-app \
  --domain myapp.local.spinforge.io \
  --framework auto
```

### Using the API
```bash
# Deploy a Next.js app
curl -X POST http://localhost/_admin/spinlets \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "myapp.local.spinforge.io",
    "config": {
      "framework": "nextjs",
      "sourceUrl": "https://github.com/user/nextjs-app.git"
    }
  }'
```

## Configuration

### Environment Variables

Key environment variables in `.env`:

```bash
# KeyDB Configuration
KEYDB_PASSWORD=your-secure-password
KEYDB_MAX_MEMORY=2gb

# Resource Limits
SPINLET_MAX_MEMORY=512m
SPINLET_MAX_CPU=0.5
SPINLET_IDLE_TIMEOUT=300

# Monitoring
GRAFANA_ADMIN_PASSWORD=your-admin-password

# Domains
PRIMARY_DOMAIN=spinforge.local
WILDCARD_DOMAIN=*.apps.spinforge.local
```

### Nginx Custom Domains

Add custom domain configurations in `nginx/conf.d/`:

```nginx
# nginx/conf.d/myapp.conf
server {
    listen 80;
    server_name myapp.example.com;
    
    location / {
        proxy_pass http://spinhub;
        include /etc/nginx/proxy_params.conf;
    }
}
```

### Resource Limits

Adjust container resources in `docker-compose.yml`:

```yaml
services:
  spinhub:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Data Management

### Backup

Backups run automatically every 4 hours. Manual backup:

```bash
docker-compose exec backup /scripts/backup.sh
```

### Restore

```bash
# Stop KeyDB
docker-compose stop keydb

# Restore from backup
docker run --rm -v spinforge_keydb-data:/data \
  -v ./backups:/backup alpine \
  tar xzf /backup/keydb-backup-TIMESTAMP.tar.gz -C /

# Start KeyDB
docker-compose start keydb
```

### Data Volumes

- `keydb-data`: Persistent KeyDB storage
- `prometheus-data`: Metrics history
- `grafana-data`: Dashboard configurations
- `spinlet-builds`: Built application artifacts

## Monitoring

### Grafana Dashboards

1. Access Grafana at http://localhost:3000
2. Default credentials: admin/admin
3. Pre-configured dashboards:
   - SpinForge Overview
   - Spinlet Performance
   - Resource Usage
   - Request Analytics

### Prometheus Queries

Useful queries:

```promql
# Active Spinlets
spinforge_active_spinlets

# Request rate
rate(spinforge_requests_total[5m])

# P95 latency
histogram_quantile(0.95, rate(spinforge_request_duration_seconds_bucket[5m]))

# CPU usage by Spinlet
spinforge_spinlet_cpu_usage{spinlet_id="myapp"}
```

## Troubleshooting

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f spinhub

# Last 100 lines
docker-compose logs --tail=100 spinhub
```

### Common Issues

1. **Port conflicts**
   ```bash
   # Check port usage
   lsof -i :80
   lsof -i :6379
   
   # Change ports in docker-compose.yml if needed
   ```

2. **KeyDB connection errors**
   ```bash
   # Check KeyDB is running
   docker-compose exec keydb redis-cli ping
   
   # Check password is set correctly
   docker-compose exec keydb redis-cli -a $KEYDB_PASSWORD ping
   ```

3. **Spinlet not starting**
   ```bash
   # Check SpinHub logs
   docker-compose logs spinhub | grep ERROR
   
   # Check Spinlet process
   docker-compose exec spinhub ps aux | grep node
   ```

4. **Build failures**
   ```bash
   # Check builder logs
   docker-compose logs builder-service
   
   # Manually trigger build
   docker-compose exec builder-service npm run build:test
   ```

## Production Deployment

### SSL/TLS Setup

1. **Using Let's Encrypt**
   ```bash
   # Add certbot service to docker-compose.yml
   # Uncomment SSL configuration in nginx.conf
   ```

2. **Using custom certificates**
   ```bash
   # Place certificates in nginx/ssl/
   mkdir -p nginx/ssl
   cp /path/to/cert.pem nginx/ssl/
   cp /path/to/key.pem nginx/ssl/
   ```

### Security Hardening

1. **Enable admin authentication**
   ```nginx
   # In nginx.conf, uncomment auth sections
   htpasswd -c nginx/.htpasswd admin
   ```

2. **Restrict admin API access**
   ```nginx
   location /_admin {
       allow 10.0.0.0/8;
       deny all;
       # ... rest of config
   }
   ```

3. **Set strong passwords**
   ```bash
   # Generate secure passwords
   openssl rand -base64 32
   ```

### Scaling

1. **Horizontal scaling**
   ```bash
   # Scale SpinHub instances
   docker-compose up -d --scale spinhub=3
   ```

2. **KeyDB clustering**
   ```yaml
   # Use KeyDB cluster mode in production
   # See docker-compose-cluster.yml example
   ```

## Maintenance

### Updates

```bash
# Pull latest images
docker-compose pull

# Recreate containers
docker-compose up -d --force-recreate
```

### Cleanup

```bash
# Remove stopped Spinlets
docker-compose exec spinhub spinforge cleanup

# Prune old builds
docker volume prune -f

# Clean logs
docker-compose logs --tail=0 -f > /dev/null
```

## Development

### Local Development

```bash
# Run with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Run specific service
docker-compose run --rm spinhub npm run dev
```

### Running Tests

```bash
# All tests
docker-compose run --rm spinhub npm test

# Integration tests
docker-compose run --rm spinhub npm run test:integration
```

## Support

- Documentation: https://spinforge.io/docs
- Issues: https://github.com/yourusername/spinforge/issues
- Community: https://discord.gg/spinforge

## License

MIT License - see LICENSE file for details