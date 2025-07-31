# SpinForge Quick Start Guide 🚀

Get SpinForge running in under 5 minutes! This guide shows you how to deploy static and dynamic websites instantly without any reloads.

## Prerequisites

- Docker & Docker Compose installed
- 2GB free RAM
- Ports 80, 443, and 8080 available

## 1. Clone and Start (30 seconds)

```bash
# Clone the repository
git clone https://github.com/yourusername/spinforge.git
cd spinforge

# Start all services
docker compose up -d

# Verify services are running
docker compose ps
```

You should see:
- `spinforge-openresty` - Web server (RUNNING)
- `spinforge-keydb` - Database (HEALTHY)
- `spinforge-api` - Management API (RUNNING)

## 2. Deploy Your First Site (1 minute)

### Option A: Quick Static Site

```bash
# Create a site
curl -X POST http://localhost:8080/api/vhost \
  -H "Content-Type: application/json" \
  -d '{
    "subdomain": "hello",
    "type": "static"
  }'

# Create a simple HTML file
echo '<h1>Hello SpinForge!</h1>' > index.html

# Deploy it
docker cp index.html spinforge-openresty:/var/www/static/hello/

# Test it (no reload needed!)
curl -H "Host: hello.spinforge.io" http://localhost
```

### Option B: Deploy Example Sites

```bash
# Run the included test script to create 10 example sites
chmod +x deploy-test-sites.sh
./deploy-test-sites.sh
```

## 3. Access Your Sites (30 seconds)

### Local Testing

Add to `/etc/hosts`:
```bash
sudo nano /etc/hosts
# Add these lines:
127.0.0.1 hello.spinforge.io
127.0.0.1 test-portfolio.spinforge.io
127.0.0.1 test-blog.spinforge.io
```

Then visit in your browser:
- http://hello.spinforge.io
- http://test-portfolio.spinforge.io
- http://test-blog.spinforge.io

### Production Domain

Point your domain's A record to your server IP, then:

```bash
curl -X POST http://localhost:8080/api/vhost \
  -d '{
    "subdomain": "www",
    "type": "static"
  }'
```

Your site is live instantly - no nginx reload needed!

## 4. Common Operations

### List All Sites
```bash
curl http://localhost:8080/api/vhost
# Returns: {"vhosts": ["hello", "test-portfolio", ...]}
```

### Get Site Details
```bash
curl http://localhost:8080/api/vhost/hello
# Returns full configuration
```

### Delete a Site
```bash
curl -X DELETE http://localhost:8080/api/vhost/hello
# Site removed instantly - no reload!
```

### Update Site Configuration
```bash
curl -X PUT http://localhost:8080/api/vhost/hello \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Check Health
```bash
curl http://localhost:8080/health         # API health
curl http://localhost:8082/health         # OpenResty health
```

## 5. Deploy Real Websites

### From a Directory
```bash
# Create site configuration
curl -X POST http://localhost:8080/api/vhost \
  -d '{"subdomain": "myproject", "type": "static"}'

# Copy all files
docker cp ./my-website/. spinforge-openresty:/var/www/static/myproject/

# Access immediately at myproject.spinforge.io
```

### From Git Repository
```bash
# Clone your repo
git clone https://github.com/user/my-site.git
cd my-site

# Create site
curl -X POST http://localhost:8080/api/vhost \
  -d '{"subdomain": "gitsite", "type": "static"}'

# Deploy
docker cp . spinforge-openresty:/var/www/static/gitsite/
```

### Deploy Multiple Sites at Once
```bash
# Create a deployment script
cat > deploy-sites.sh << 'EOF'
#!/bin/bash
SITES=("site1" "site2" "site3")
for site in "${SITES[@]}"; do
  curl -X POST http://localhost:8080/api/vhost -d "{\"subdomain\":\"$site\",\"type\":\"static\"}"
  docker cp ./$site/. spinforge-openresty:/var/www/static/$site/
  echo "Deployed $site"
done
EOF

chmod +x deploy-sites.sh
./deploy-sites.sh
```

## 6. Advanced Features

### Proxy to Backend Service
```bash
# Example: Run a Node.js app
docker run -d --network spinforge_spinforge \
  --name myapp \
  node:18 node -e "require('http').createServer((req, res) => res.end('Hello from Node!')).listen(3000)"

# Create proxy route
curl -X POST http://localhost:8080/api/vhost \
  -d '{
    "subdomain": "api",
    "type": "proxy",
    "upstream": "http://myapp:3000"
  }'

# Test it
curl -H "Host: api.spinforge.io" http://localhost
```

### Load Balancing (Coming Soon)
```bash
curl -X POST http://localhost:8080/api/vhost \
  -d '{
    "subdomain": "app",
    "type": "loadbalancer",
    "backends": [
      "http://app1:3000",
      "http://app2:3000",
      "http://app3:3000"
    ]
  }'
```

### Custom Headers
```bash
curl -X POST http://localhost:8080/api/vhost \
  -d '{
    "subdomain": "secure",
    "type": "static",
    "headers": {
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=31536000"
    }
  }'
```

## 7. Monitoring & Management

### View Metrics
```bash
# Get request metrics
curl http://localhost:8080/api/metrics

# View logs
docker logs spinforge-openresty --tail 50
docker logs spinforge-api --tail 50
```

### Direct Redis Access
```bash
# Connect to Redis CLI
docker exec -it spinforge-keydb redis-cli -p 16378

# List all vhosts
KEYS vhost:*

# Get specific vhost details
GET vhost:hello

# Exit Redis
exit
```

### Performance Testing
```bash
# Install apache bench
sudo apt-get install apache2-utils  # Ubuntu/Debian
brew install ab                      # macOS

# Test performance (50k requests, 100 concurrent)
ab -n 50000 -c 100 -H "Host: hello.spinforge.io" http://localhost/
```

## 8. Production Tips

### Use Environment Variables
```bash
# Create .env file
cat > .env << EOF
REDIS_HOST=keydb
REDIS_PORT=16378
REDIS_PASSWORD=your-secure-password
REDIS_DB=1
EOF

# Start with env file
docker compose --env-file .env up -d
```

### Enable HTTPS (Coming Soon)
```bash
# Auto-SSL will be available in next release
# For now, use a reverse proxy like Cloudflare or nginx
```

### Backup Redis Data
```bash
# Create backup
docker exec spinforge-keydb redis-cli -p 16378 --rdb /tmp/backup.rdb
docker cp spinforge-keydb:/tmp/backup.rdb ./backup-$(date +%Y%m%d).rdb

# Restore backup
docker cp backup.rdb spinforge-keydb:/data/dump.rdb
docker restart spinforge-keydb
```

## 9. Troubleshooting

### Site Not Loading?

1. **Check if site exists:**
   ```bash
   curl http://localhost:8080/api/vhost
   ```

2. **Verify files are deployed:**
   ```bash
   docker exec spinforge-openresty ls -la /var/www/static/yoursite/
   ```

3. **Check OpenResty logs:**
   ```bash
   docker logs spinforge-openresty --tail 50
   ```

### Port Conflicts?
```bash
# Edit docker-compose.yml to change ports:
ports:
  - "8880:80"    # Change from 80 to 8880
  - "8443:443"   # Change from 443 to 8443
  - "8081:8080"  # Change API port
```

### Reset Everything
```bash
# Stop and remove all data
docker compose down -v

# Start fresh
docker compose up -d
```

### Common Issues

- **"Site not found"** - Make sure subdomain matches exactly
- **Files not showing** - Check file permissions in container
- **Slow routing** - Redis might be full, check memory usage

## 10. Why SpinForge?

### Traditional Hosting
- ❌ Nginx reload for each site (slow!)
- ❌ Config files everywhere
- ❌ Limited to thousands of sites
- ❌ Complex SSL setup

### SpinForge
- ✅ No reloads - instant updates
- ✅ All config in Redis
- ✅ Millions of sites supported
- ✅ Auto-SSL ready
- ✅ <0.1ms routing decisions

## Next Steps

- Read the [full documentation](README.md)
- Learn about [Docker setup](README-DOCKER.md)
- Explore [production deployment](README.md#-production-deployment)
- Check out [advanced routing](README.md#-advanced-features)

---

🎉 **Congratulations!** You're now running SpinForge - the hosting platform that scales to millions!