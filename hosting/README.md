# SpinForge Hosting Component

Dynamic virtual hosting system using Caddy with automatic HTTPS and KeyDB for configuration storage.

## Features

- **Automatic HTTPS**: Let's Encrypt certificates obtained automatically
- **Dynamic Configuration**: Add/remove hosts without restarts
- **Cookie-Based Routing**: Route requests based on cookies
- **Multiple Backend Types**:
  - Proxy: Reverse proxy to any URL
  - Static: Serve static files
  - Container: Route to Docker containers
  - Load Balancer: Distribute across multiple backends
- **Rate Limiting**: Per-host request limits
- **Custom Headers**: Add any HTTP headers
- **Zero Downtime**: Configuration reloads without dropping connections

## Quick Start

1. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env if needed
   ```

2. **Start services**:
   ```bash
   docker-compose up -d
   ```

3. **Create your first virtual host**:
   ```bash
   ./scripts/manage.sh create myapp
   ```

## Usage Examples

### Simple Proxy
```bash
./scripts/manage.sh create api
# Select: 1) Proxy
# Upstream URL: http://localhost:3000
```

### Static Files
```bash
./scripts/manage.sh create docs
# Select: 2) Static
# Upload files to: ./data/static/docs/
```

### Cookie-Based Routing
```bash
./scripts/manage.sh create app
# Select: 1) Proxy
# Enable cookie-based routing? y
# Cookie pattern: version=v1
# Route name: v1
# Backend URL: http://app-v1:8080
# Cookie pattern: version=v2
# Route name: v2
# Backend URL: http://app-v2:8080
```

### Load Balancer
```bash
./scripts/manage.sh create api
# Select: 4) Load Balancer
# Backend URL: http://api-1:8080
# Backend URL: http://api-2:8080
# Backend URL: http://api-3:8080
```

## Management Commands

```bash
# List all virtual hosts
./scripts/manage.sh list

# Get details
./scripts/manage.sh get myapp

# Update configuration
./scripts/manage.sh update myapp

# Enable/disable
./scripts/manage.sh disable myapp
./scripts/manage.sh enable myapp

# Delete
./scripts/manage.sh delete myapp
```

## API Reference

### Create Virtual Host
```bash
curl -X POST http://localhost:8080/api/vhost \
  -H "Content-Type: application/json" \
  -d '{
    "subdomain": "api",
    "type": "proxy",
    "upstream": "http://backend:8080",
    "cookieRouting": [
      {
        "name": "beta",
        "cookie": "version=beta",
        "backend": "http://beta-backend:8080"
      }
    ],
    "rateLimit": {
      "requests": 100
    },
    "headers": {
      "X-Custom": "value"
    },
    "enabled": true
  }'
```

### Update Virtual Host
```bash
curl -X PUT http://localhost:8080/api/vhost/api \
  -H "Content-Type: application/json" \
  -d '{
    "upstream": "http://new-backend:8080"
  }'
```

### Delete Virtual Host
```bash
curl -X DELETE http://localhost:8080/api/vhost/api
```

## Cookie-Based Routing

Route requests to different backends based on cookies:

```json
{
  "cookieRouting": [
    {
      "name": "premium",
      "cookie": "user_type=premium",
      "backend": "http://premium-service:8080"
    },
    {
      "name": "free",
      "cookie": "user_type=free",
      "backend": "http://free-service:8080"
    }
  ]
}
```

Requests with `Cookie: user_type=premium` go to premium-service, others to the default upstream.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│    Caddy    │────▶│   Backend   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │   API/Node  │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │    KeyDB    │
                    └─────────────┘
```

## File Structure

```
hosting/
├── config/
│   └── Caddyfile         # Main Caddy configuration
├── api/
│   ├── server.js         # Management API
│   ├── package.json      # Node dependencies
│   └── Dockerfile        # API container
├── scripts/
│   └── manage.sh         # CLI management tool
├── data/
│   └── static/           # Static files directory
├── docker-compose.yml    # Service orchestration
└── README.md            # This file
```

## Monitoring

- Caddy Admin: http://localhost:2019
- Metrics: http://localhost:9180/metrics
- API Health: http://localhost:8080/health

## Troubleshooting

### View logs
```bash
docker-compose logs -f caddy
docker-compose logs -f api
```

### Check configuration
```bash
docker-compose exec caddy caddy list-modules
docker-compose exec caddy caddy validate --config /etc/caddy/Caddyfile
```

### Manual reload
```bash
docker-compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

## Security

- Automatic HTTPS with strong TLS defaults
- Security headers on all responses
- Rate limiting available per host
- Domain verification for certificate generation

## License

Part of the SpinForge platform.