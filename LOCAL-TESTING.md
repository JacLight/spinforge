# Local Domain Testing Guide for SpinForge

When testing SpinForge applications locally, you need to simulate domain names since the platform routes traffic based on the Host header. Here are several methods:

## Method 1: Edit /etc/hosts (Recommended)

Add entries to your `/etc/hosts` file to map domains to localhost:

```bash
# Add these lines to /etc/hosts
127.0.0.1   app1.local
127.0.0.1   app2.local
127.0.0.1   myapp.test
127.0.0.1   customer1.dev
```

Then deploy your apps with these domains:
```bash
curl -X POST http://localhost:9004/_admin/routes \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your-token" \
  -d '{
    "domain": "app1.local",
    "customerId": "customer-123",
    "spinletId": "spin-001",
    "buildPath": "/path/to/app1",
    "framework": "express"
  }'
```

Access your app at: http://app1.local:9006 (through Nginx)

## Method 2: Use curl with Host Header

Test without modifying /etc/hosts:

```bash
# Direct to SpinHub (port 9004)
curl -H "Host: app1.local" http://localhost:9004

# Through Nginx (port 9006)
curl -H "Host: app1.local" http://localhost:9006
```

## Method 3: Use .localhost Domain (No Config Needed)

Most modern browsers automatically resolve `*.localhost` to 127.0.0.1:

```bash
# Deploy with .localhost domain
curl -X POST http://localhost:9004/_admin/routes \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your-token" \
  -d '{
    "domain": "myapp.localhost",
    "customerId": "customer-123",
    "spinletId": "spin-002",
    "buildPath": "/path/to/app",
    "framework": "express"
  }'
```

Access at: http://myapp.localhost:9006

## Method 4: Use a Local DNS Tool

### dnsmasq (macOS/Linux)
```bash
# Install dnsmasq
brew install dnsmasq  # macOS
sudo apt-get install dnsmasq  # Ubuntu

# Configure to resolve *.test to localhost
echo "address=/.test/127.0.0.1" >> /usr/local/etc/dnsmasq.conf

# Start dnsmasq
sudo brew services start dnsmasq  # macOS
```

### Caddy Server (Alternative)
Use Caddy as a local reverse proxy with automatic local domains:

```caddyfile
# Caddyfile
app1.local:80 {
    reverse_proxy localhost:9006 {
        header_up Host {host}
    }
}

app2.local:80 {
    reverse_proxy localhost:9006 {
        header_up Host {host}
    }
}
```

## Method 5: Browser Extensions

Use browser extensions like "ModHeader" to modify the Host header:
1. Install ModHeader extension
2. Add Request header: `Host: app1.local`
3. Visit http://localhost:9006

## Testing Multiple Apps

Create a test script to deploy multiple apps:

```bash
#!/bin/bash
# deploy-test-apps.sh

# Deploy App 1
curl -X POST http://localhost:9004/_admin/routes \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: test-token" \
  -d '{
    "domain": "todo.localhost",
    "customerId": "test-customer",
    "spinletId": "spin-todo",
    "buildPath": "/path/to/todo-app",
    "framework": "express",
    "config": {
      "memory": "256MB",
      "cpu": "0.5",
      "env": {
        "NODE_ENV": "development",
        "PORT": "3000"
      }
    }
  }'

# Deploy App 2
curl -X POST http://localhost:9004/_admin/routes \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: test-token" \
  -d '{
    "domain": "blog.localhost",
    "customerId": "test-customer",
    "spinletId": "spin-blog",
    "buildPath": "/path/to/blog-app",
    "framework": "nextjs",
    "config": {
      "memory": "512MB",
      "cpu": "1.0"
    }
  }'

echo "Apps deployed!"
echo "Access at:"
echo "- http://todo.localhost:9006"
echo "- http://blog.localhost:9006"
```

## Port Mapping Reference

- **9000**: KeyDB
- **9004**: SpinHub API
- **9006**: Nginx HTTP (main entry point for apps)
- **9007**: Nginx HTTPS
- **9008**: Prometheus
- **9009**: Grafana
- **9010**: Admin UI

## Quick Test Commands

```bash
# Check if routing works
curl -H "Host: myapp.localhost" http://localhost:9006

# View all routes
curl http://localhost:9004/_admin/routes

# Check specific route details
curl http://localhost:9004/_admin/routes/myapp.localhost/details

# View logs for a domain
curl http://localhost:9004/_admin/routes/myapp.localhost/logs
```

## Troubleshooting

1. **"No application configured for this domain"**
   - Ensure the domain is registered in routes
   - Check exact domain spelling (case-sensitive)
   - Verify with: `curl http://localhost:9004/_admin/routes`

2. **Connection refused**
   - Check if SpinHub is running: `docker ps | grep spinhub`
   - Verify Nginx is running: `docker ps | grep nginx`
   - Check logs: `docker logs spinforge-hub-1`

3. **Wrong app loading**
   - Clear browser cache
   - Check Host header is being sent correctly
   - Verify route configuration

## Development Tips

1. Use consistent naming: `[appname].localhost` or `[appname].local`
2. Document domains in your project README
3. Create a `.env` file with test domains:
   ```env
   TEST_DOMAIN_APP1=todo.localhost
   TEST_DOMAIN_APP2=blog.localhost
   ```
4. Use the route details API to debug routing issues