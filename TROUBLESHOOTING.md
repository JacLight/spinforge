# SpinForge Troubleshooting Guide

## Common Issues

### 1. Large Deployment Upload Failures (>50MB)

**Problem**: When using `spinforge watch` or deploying applications larger than 50MB, you may encounter upload failures with HTTP 500 errors.

**Cause**: The default request size limit in SpinHub is set to 50MB.

**Solution**: Increase the `MAX_REQUEST_SIZE` environment variable:

#### For Docker Deployment:
```bash
# In docker-compose.yml, add to spinhub service:
environment:
  - MAX_REQUEST_SIZE=100mb  # or higher as needed
```

#### For Local Development:
```bash
# Set environment variable before starting SpinHub
export MAX_REQUEST_SIZE=100mb
npm run dev
```

#### For Production:
```bash
# In your .env file
MAX_REQUEST_SIZE=100mb
```

**Note**: Also ensure your nginx configuration has a matching or higher `client_max_body_size`:
```nginx
client_max_body_size 100m;  # Should match or exceed MAX_REQUEST_SIZE
```

### 2. Authentication Issues

**Problem**: Getting 401 Unauthorized errors when making API calls.

**Solution**: 
- For admin endpoints: Use the `X-Admin-Token` header
- For customer endpoints: Use both `X-Customer-ID` and `Authorization: Bearer <token>` headers

### 3. Deployment Status Stuck in "Building"

**Problem**: Deployment status remains in "building" state indefinitely.

**Possible Causes**:
1. Build process crashed
2. Insufficient resources
3. Network issues pulling dependencies

**Solution**:
1. Check SpinHub logs: `docker logs spinforge-hub`
2. Check builder logs: `docker logs spinforge-builder`
3. Retry deployment: Use the admin UI or API to retry

### 4. File Sync Not Working in Watch Mode

**Problem**: File changes not being reflected when using `spinforge watch`.

**Solution**:
1. Check debounce interval (default 10s)
2. Ensure deployment exists and is in "success" state
3. Check file ignore patterns in watch command
4. Verify network connectivity to SpinHub

### 5. Memory/Resource Limits

**Problem**: Applications crash or fail to start due to resource constraints.

**Solution**:
```bash
# Increase memory limit when deploying
spinforge watch --memory 1024MB --cpu 1.0
```

Or update deployment configuration:
```yaml
resources:
  memory: "1024MB"
  cpu: 1.0
```

## Debug Commands

### Check SpinHub Health
```bash
curl http://localhost:9004/_health
```

### View Deployment Logs
```bash
# Via API
curl -H "X-Admin-Token: your-token" \
  http://localhost:9004/_admin/deployments/your-app/logs

# Via Docker
docker logs spinforge-hub
```

### Monitor Redis
```bash
docker exec -it spinforge-keydb keydb-cli -a spinforge123
> MONITOR
```

### Check Nginx Access Logs
```bash
docker logs spinforge-nginx
```

## Performance Tuning

### For Large Deployments
1. Increase `MAX_REQUEST_SIZE` (default: 50mb)
2. Increase `REQUEST_TIMEOUT` (default: 120000ms)
3. Ensure sufficient disk space for builds
4. Consider excluding unnecessary files from deployment

### For High Traffic
1. Adjust rate limits in nginx.conf
2. Increase worker connections
3. Scale horizontally with multiple SpinHub instances

## Getting Help

1. Check logs first - most issues are visible in logs
2. Enable debug logging: `LOG_LEVEL=debug`
3. File issues at: https://github.com/spinforge/spinforge/issues