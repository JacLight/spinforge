# SpinForge Test Deployment Scripts

This directory contains scripts for stress testing SpinForge by deploying multiple static sites.

## Quick Start

### 1. Get Your Admin Token

First, you need to get your admin authentication token:

1. Open http://localhost:3030 in your browser
2. Login with your admin credentials
3. Open Browser DevTools (F12)
4. Go to Application → Local Storage → localhost:3030
5. Copy the value of `adminToken`

### 2. Run Test Deployment

#### Python Script (Recommended)
```bash
# Deploy 10 test sites (default)
ADMIN_TOKEN=your-token-here python3 test-deploy.py

# Deploy 50 sites with 5 parallel deployments
NUM_SITES=50 PARALLEL_DEPLOYS=5 ADMIN_TOKEN=your-token python3 test-deploy.py

# Deploy 100 sites for stress testing
NUM_SITES=100 ADMIN_TOKEN=your-token python3 test-deploy.py
```

#### Bash Script (Alternative)
```bash
# Quick test with 10 sites
ADMIN_TOKEN=your-token ./packages/spinlet-hub/src/scripts/quick-deploy-test.sh

# Stress test with 100 sites
NUM_SITES=100 ADMIN_TOKEN=your-token ./packages/spinlet-hub/src/scripts/stress-test.sh
```

## What Gets Deployed

Each test site includes:
- Responsive HTML page with gradient background
- Site number and deployment timestamp
- Basic CSS styling
- robots.txt file
- Deploy configuration

Sites are deployed with domains like:
- `test-1.localhost`
- `test-2.localhost`
- `test-3.localhost`
- etc.

## Monitoring the Test

After deployment, you can monitor the results:

1. **Applications Page**: http://localhost:3030/applications
   - See all deployed test sites
   - Check their status

2. **Hosting Management**: http://localhost:3030/hosting
   - View deployment folders vs web_root status
   - Check for any mismatches
   - See Redis route status

3. **Admin Dashboard**: http://localhost:3030/admin
   - Monitor system resources
   - Check Docker container stats
   - View deployment statistics

## Environment Variables

- `ADMIN_TOKEN` (required): Your admin authentication token
- `SPINHUB_URL`: SpinHub API URL (default: http://localhost:8080)
- `NUM_SITES`: Number of sites to deploy (default: 10)
- `PARALLEL_DEPLOYS`: Number of concurrent deployments (default: 3)

## Performance Expectations

On a typical development machine:
- **10 sites**: ~5-10 seconds
- **50 sites**: ~30-60 seconds  
- **100 sites**: ~2-3 minutes

The actual time depends on:
- System resources (CPU, disk I/O)
- Docker performance
- Number of parallel deployments

## Cleanup

To remove all test deployments:

```bash
# Remove from Redis (this will make them inaccessible)
redis-cli
> DEL spinforge:routes:test-1.localhost
> DEL spinforge:routes:test-2.localhost
# ... etc

# Or remove all test routes at once
> EVAL "return redis.call('del', unpack(redis.call('keys', 'spinforge:routes:test-*')))" 0

# Remove deployment folders
rm -rf /spinforge/deployments/test-customer/test-site-*

# Remove web_root folders (if any)
rm -rf /spinforge/web_root/test-customer/test-site-*
```

## Troubleshooting

### "502 Bad Gateway" errors
- Routes may take a moment to propagate to nginx
- Try refreshing after a few seconds

### Deployment failures
- Check if SpinHub is running: `docker ps | grep spinhub`
- Check available disk space: `df -h`
- View SpinHub logs: `docker logs spinforge-spinhub`

### Can't access sites
- Ensure nginx is running: `docker ps | grep nginx`
- Check if routes exist in Redis: `redis-cli hkeys spinforge:routes`
- Restart nginx if needed: `docker restart spinforge-nginx`

## Advanced Testing

For more complex scenarios, modify the scripts to:
- Deploy different types of sites (React, Next.js, etc.)
- Use different customer IDs
- Set custom environment variables
- Deploy to specific subdomains