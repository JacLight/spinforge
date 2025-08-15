# SpinForge Static IP Assignments

## Docker Network Configuration
- **Network**: spinforge
- **Subnet**: 172.18.0.0/16
- **Gateway**: 172.18.0.1

## Service IP Assignments

| Service | Container Name | Static IP | Port |
|---------|---------------|-----------|------|
| KeyDB (Redis) | spinforge-keydb | 172.18.0.10 | 16378 |
| OpenResty (Nginx) | spinforge-openresty | 172.18.0.11 | 80/443/8081 |
| API | spinforge-api | 172.18.0.12 | 8080 |
| Certbot | spinforge-certbot | 172.18.0.13 | - |
| Admin UI | spinforge-admin-ui | 172.18.0.14 | 80 |
| Website | spinforge-website | 172.18.0.15 | 3000 |

## Usage in Nginx Configuration

When configuring proxy_pass in nginx, use these static IPs:

```nginx
# Admin UI
proxy_pass http://172.18.0.14:80;

# API
proxy_pass http://172.18.0.12:8080;

# Website
proxy_pass http://172.18.0.15:3000;
```

## Notes
- These IPs are configured in `docker-compose.yml`
- The network must be created with the specified subnet
- Services will always get the same IP when restarted