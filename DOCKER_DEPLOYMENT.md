# SpinForge Docker Deployment Guide

**SpinForge** - AI-Native Zero Configuration Hosting & Application Infrastructure

## Quick Start

1. **Pull the Docker images**:
   ```bash
   docker pull jaclight/spinforge-admin-ui:latest
   docker pull jaclight/spinforge-api:latest
   docker pull jaclight/spinforge-openresty:latest
   ```

2. **Create data directories**:
   ```bash
   mkdir -p hosting/data/{static,certs,certbot-webroot}
   mkdir -p hosting/data/certs/live/default
   ```

3. **Generate default SSL certificates**:
   ```bash
   # Generate self-signed certificates for initial setup
   cd hosting/data/certs/live/default
   openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
     -keyout privkey.pem \
     -out fullchain.pem \
     -subj "/C=US/ST=State/L=City/O=SpinForge/CN=localhost" \
     -batch
   cd -
   ```
   
   **Note**: These self-signed certificates are only for the default server configuration. 
   Real SSL certificates for hosted domains will be automatically generated via Let's Encrypt.

4. **Set environment variables**:
   ```bash
   # Create a .env file
   echo "JWT_SECRET=$(openssl rand -base64 32)" > .env
   ```

5. **Start SpinForge**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Access Points

- **Admin UI**: http://localhost:3001
- **API**: http://localhost:8080
- **Main Router**: http://localhost (port 80/443)

## Default Admin Credentials

- Username: `admin`
- Password: `admin123`

**Important**: Change the default password immediately after first login!

## SSL/HTTPS Configuration

SpinForge includes automatic SSL certificate management via Let's Encrypt:

1. Ensure your domain points to your server's public IP
2. Port 80 must be accessible from the internet
3. Use the Admin UI to generate certificates for your domains

## Production Checklist

- [ ] Change default admin password
- [ ] Update JWT_SECRET in .env file
- [ ] Configure firewall rules
- [ ] Set up regular backups of the `keydb-data` volume
- [ ] Configure monitoring/alerting
- [ ] Update VITE_API_BASE_URL in docker-compose.prod.yml to your actual domain

## Backup and Restore

### Backup
```bash
# Backup KeyDB data
docker exec spinforge-keydb redis-cli BGSAVE
docker cp spinforge-keydb:/data/dump.rdb ./backup/

# Backup static files and certificates
tar -czf spinforge-backup.tar.gz hosting/data/
```

### Restore
```bash
# Restore data
tar -xzf spinforge-backup.tar.gz
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### View logs
```bash
docker-compose -f docker-compose.prod.yml logs -f [service-name]
```

### Restart services
```bash
docker-compose -f docker-compose.prod.yml restart [service-name]
```

### Health check
```bash
curl http://localhost:8080/health
```

## License

MIT License - Copyright (c) 2025 Jacob Ajiboye