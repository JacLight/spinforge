# SpinForge Port Mappings

All SpinForge services now use a continuous block of host ports (9000-9010) while maintaining their standard internal container ports.

## Port Mapping Table

| Host Port | Container Port | Service | Description |
|-----------|---------------|---------|-------------|
| 9000 | 6379 | KeyDB/KeyDB-1 | Main KeyDB instance (cluster: node 1) |
| 9001 | 6379 | KeyDB-2 | KeyDB cluster node 2 (cluster mode only) |
| 9002 | 6379 | KeyDB-3 | KeyDB cluster node 3 (cluster mode only) |
| 9003 | 6379 | KeyDB-LB | HAProxy load balancer for KeyDB cluster |
| 9004 | 8080 | SpinHub/Dev | Main application service |
| 9005 | 8081 | Dev Secondary | Secondary dev port (simple mode only) |
| 9006 | 80 | Nginx HTTP | HTTP reverse proxy |
| 9007 | 443 | Nginx HTTPS | HTTPS/SSL reverse proxy |
| 9008 | 9090 | Prometheus | Metrics collection |
| 9009 | 3000 | Grafana | Metrics visualization dashboard |
| 9010 | 80 | Management UI | Web-based SpinForge management interface |

## Usage Examples

### Access Services

```bash
# KeyDB CLI
redis-cli -h localhost -p 9000 -a ${REDIS_PASSWORD}

# SpinHub API
curl http://localhost:9004/_health

# Prometheus
http://localhost:9008

# Grafana Dashboard
http://localhost:9009

# Management UI
http://localhost:9010
```

### Environment Variables

Update your `.env` file or environment variables:

```bash
# Old format
REDIS_HOST=localhost:6380
SPINHUB_URL=http://localhost:8080

# New format
REDIS_HOST=localhost:9000
SPINHUB_URL=http://localhost:9004
```

## Benefits

1. **Organized**: All ports in a continuous 9000-9010 block
2. **No Conflicts**: Avoids common port conflicts (80, 443, 3000, 6379, 8080)
3. **Easy to Remember**: Sequential numbering for related services
4. **Firewall Friendly**: Simple firewall rules for the entire block