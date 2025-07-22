# SpinForge Quick Start Guide

This guide will help you get SpinForge running locally in under 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose installed
- Git installed

## 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/spinforge/spinforge.git
cd spinforge

# Install dependencies
npm install

# Build all packages
npm run build
```

## 2. Start SpinForge Services

```bash
# Start KeyDB and SpinHub using Docker Compose
docker-compose up -d

# Verify services are running
docker-compose ps

# Check SpinHub health
curl http://localhost:8080/_health
```

## 3. Install the CLI

```bash
# Build and link the CLI globally
cd packages/spinlet-cli
npm link

# Verify installation
spinforge --version
```

## 4. Deploy Your First App

### Option A: Deploy the Example Remix App

```bash
# Deploy the example app
spinforge deploy examples/remix-app \
  --domain myapp.local \
  --customer demo \
  --framework remix

# Check status
spinforge status

# Access your app (add to /etc/hosts: 127.0.0.1 myapp.local)
curl http://myapp.local:8080
```

### Option B: Deploy Your Own App

```bash
# For a Remix app
spinforge deploy /path/to/your/remix-app \
  --domain yourapp.local \
  --framework remix \
  --memory 1GB \
  --cpu 1.0

# For a Next.js app
spinforge deploy /path/to/your/nextjs-app \
  --domain yourapp.local \
  --framework nextjs
```

## 5. Manage Your Apps

### View All Routes

```bash
# List routes for a customer
spinforge routes -c demo
```

### Check Spinlet Status

```bash
# Get specific spinlet status
spinforge status spin-abc123

# Get overall system status
spinforge status
```

### View Logs

```bash
# View recent logs
spinforge logs spin-abc123

# Follow logs in real-time
spinforge logs spin-abc123 -f
```

### Stop a Spinlet

```bash
# Stop a specific spinlet
spinforge stop spin-abc123
```

## 6. Test Your Deployment

### Basic HTTP Request

```bash
# Test your app
curl -H "Host: myapp.localhost" http://localhost:8080
```

### Performance Test

```bash
# Install apache bench if needed
apt-get install apache2-utils  # Ubuntu/Debian
brew install ab                 # macOS

# Run performance test
ab -n 1000 -c 10 -H "Host: myapp.localhost" http://localhost:8080/
```

## 7. Admin API Examples

### Add a Route Programmatically

```bash
curl -X POST http://localhost:8080/_admin/routes \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api.example.com",
    "customerId": "cust-123",
    "spinletId": "spin-api-123",
    "buildPath": "/apps/my-api",
    "framework": "express"
  }'
```

### Get Metrics

```bash
curl http://localhost:8080/_metrics
```

## 8. Development Workflow

### Local Development Mode

```bash
# Set environment for local development
export SPINHUB_URL=http://localhost:8080
export NODE_ENV=development

# Deploy with auto-generated IDs
spinforge deploy ./my-app --framework remix
```

### Production Deployment

```bash
# Use production settings
export NODE_ENV=production
export REDIS_HOST=your-redis-host
export REDIS_PASSWORD=your-redis-password

# Deploy with specific configuration
spinforge deploy ./my-app \
  --domain app.yourdomain.com \
  --customer prod-customer \
  --memory 2GB \
  --cpu 1.5
```

## 9. Troubleshooting

### Check Service Logs

```bash
# SpinHub logs
docker-compose logs -f spinhub

# KeyDB logs
docker-compose logs -f keydb
```

### Reset Everything

```bash
# Stop all services
docker-compose down

# Remove all data (warning: deletes all routes and spinlets)
docker-compose down -v

# Restart fresh
docker-compose up -d
```

### Common Issues

1. **Port already in use**

   ```bash
   # Change the port in docker-compose.yml or use:
   PORT=8081 docker-compose up -d
   ```

2. **Spinlet won't start**

   ```bash
   # Check spinlet logs
   spinforge logs <spinlet-id> -n 50

   # Verify build path exists
   ls -la /path/to/your/app
   ```

3. **Domain not resolving**
   ```bash
   # Add to /etc/hosts
   echo "127.0.0.1 myapp.localhost" | sudo tee -a /etc/hosts
   ```

## 10. Next Steps

- Read the [Architecture Guide](ARCHITECTURE.md)
- Explore the [API Documentation](docs/api.md)
- Join our [Discord Community](https://discord.gg/spinforge)
- Contribute on [GitHub](https://github.com/spinforge/spinforge)

## Example Apps

Check out these example applications in the `examples/` directory:

- `remix-app` - Basic Remix application
- `nextjs-app` - Next.js with SSR (coming soon)
- `express-api` - REST API example (coming soon)

Happy Spinning! 🚀
