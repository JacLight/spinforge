#!/bin/bash

# SpinForge Docker Deployment Script
# Deploy SpinForge using Docker Compose

set -euo pipefail

# Configuration
SPINFORGE_VERSION=${SPINFORGE_VERSION:-latest}
DOMAIN=${DOMAIN:-}
EMAIL=${EMAIL:-}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.prod.yml}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

check_requirements() {
    log "Checking requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        if ! docker compose version &> /dev/null; then
            error "Docker Compose is not installed. Please install Docker Compose first."
        else
            # Use docker compose command
            DOCKER_COMPOSE="docker compose"
        fi
    else
        DOCKER_COMPOSE="docker-compose"
    fi
    
    # Check if running as root or with sudo
    if [[ $EUID -eq 0 ]]; then
        warning "Running as root. Consider using a non-root user with docker permissions."
    fi
}

create_directories() {
    log "Creating directories..."
    
    mkdir -p data/{keydb,builds,logs,ssl}
    mkdir -p config
    
    # Set permissions
    chmod 755 data
    chmod 755 data/{keydb,builds,logs,ssl}
}

generate_config() {
    log "Generating configuration..."
    
    # Generate random passwords
    KEYDB_PASSWORD=$(openssl rand -base64 32)
    ADMIN_TOKEN=$(openssl rand -base64 32)
    
    # Create .env file
    cat > .env <<EOF
# SpinForge Production Configuration
SPINFORGE_VERSION=$SPINFORGE_VERSION
NODE_ENV=production

# KeyDB
REDIS_HOST=keydb
REDIS_PORT=6379
REDIS_PASSWORD=$KEYDB_PASSWORD

# SpinHub
SPINHUB_PORT=8080
SPINHUB_HOST=0.0.0.0
RATE_LIMIT_GLOBAL=10000
RATE_LIMIT_CUSTOMER=1000

# Security
ADMIN_TOKEN=$ADMIN_TOKEN
TRUST_PROXY=true

# Resources
PORT_START=30000
PORT_END=40000
DEFAULT_MEMORY_LIMIT=512MB
DEFAULT_CPU_LIMIT=0.5

# Telemetry
TELEMETRY_ENABLED=true
LOG_LEVEL=info

# SSL (if domain provided)
DOMAIN=$DOMAIN
EMAIL=$EMAIL
EOF
    
    log "Configuration saved to .env"
    warning "Please keep the ADMIN_TOKEN safe: $ADMIN_TOKEN"
}

create_compose_file() {
    log "Creating Docker Compose file..."
    
    cat > $COMPOSE_FILE <<'EOF'
version: '3.8'

services:
  keydb:
    image: eqalpha/keydb:latest
    container_name: spinforge-keydb
    restart: unless-stopped
    command: keydb-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - ./data/keydb:/data
    networks:
      - spinforge-net
    healthcheck:
      test: ["CMD", "keydb-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  spinhub:
    image: spinforge/spinhub:${SPINFORGE_VERSION}
    container_name: spinforge-hub
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=keydb
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - PORT=8080
      - HOST=0.0.0.0
      - ADMIN_TOKEN=${ADMIN_TOKEN}
      - TRUST_PROXY=${TRUST_PROXY}
      - RATE_LIMIT_GLOBAL=${RATE_LIMIT_GLOBAL}
      - RATE_LIMIT_CUSTOMER=${RATE_LIMIT_CUSTOMER}
      - PORT_START=${PORT_START}
      - PORT_END=${PORT_END}
      - DEFAULT_MEMORY_LIMIT=${DEFAULT_MEMORY_LIMIT}
      - DEFAULT_CPU_LIMIT=${DEFAULT_CPU_LIMIT}
      - LOG_LEVEL=${LOG_LEVEL}
    volumes:
      - ./data/builds:/spinforge/builds
      - ./data/logs:/spinforge/logs
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      keydb:
        condition: service_healthy
    networks:
      - spinforge-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/_health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: spinforge-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./data/ssl:/etc/nginx/ssl:ro
      - ./data/logs/nginx:/var/log/nginx
    depends_on:
      - spinhub
    networks:
      - spinforge-net

networks:
  spinforge-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  keydb-data:
  builds-data:
  logs-data:
EOF
}

create_nginx_config() {
    log "Creating Nginx configuration..."
    
    # Basic config without SSL
    cat > config/nginx.conf <<'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=admin:10m rate=1r/s;

    upstream spinhub {
        server spinhub:8080;
    }

    server {
        listen 80;
        server_name _;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Admin routes - add authentication!
        location /_admin {
            limit_req zone=admin burst=5 nodelay;
            
            # Add IP restrictions
            # allow 10.0.0.0/8;
            # deny all;
            
            proxy_pass http://spinhub;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health and metrics - public access
        location ~ ^/_(health|metrics)$ {
            proxy_pass http://spinhub;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Main application
        location / {
            limit_req zone=general burst=20 nodelay;
            
            proxy_pass http://spinhub;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 300s;
            proxy_read_timeout 300s;
        }
    }
}
EOF
}

setup_ssl() {
    if [[ -n "$DOMAIN" ]] && [[ -n "$EMAIL" ]]; then
        log "Setting up SSL for $DOMAIN..."
        
        # Add Certbot service to docker-compose
        cat >> $COMPOSE_FILE <<EOF

  certbot:
    image: certbot/certbot
    container_name: spinforge-certbot
    volumes:
      - ./data/ssl:/etc/letsencrypt
      - ./data/ssl/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait \$\${!}; done;'"
EOF
        
        warning "SSL setup requires additional manual steps:"
        echo "  1. Update DNS to point $DOMAIN to this server"
        echo "  2. Run: docker-compose run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN -m $EMAIL --agree-tos"
        echo "  3. Update nginx.conf to use SSL certificates"
        echo "  4. Restart services: docker-compose restart nginx"
    fi
}

deploy() {
    log "Deploying SpinForge..."
    
    # Pull latest images
    $DOCKER_COMPOSE -f $COMPOSE_FILE pull
    
    # Start services
    $DOCKER_COMPOSE -f $COMPOSE_FILE up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 10
    
    # Check health
    if curl -f http://localhost:8080/_health > /dev/null 2>&1; then
        log "SpinForge is running!"
    else
        error "SpinForge failed to start. Check logs with: docker-compose logs"
    fi
}

print_info() {
    echo
    echo "======================================"
    echo "SpinForge deployed successfully!"
    echo "======================================"
    echo
    echo "Access Points:"
    echo "  - SpinHub: http://localhost:8080"
    echo "  - Health: http://localhost:8080/_health"
    echo "  - Metrics: http://localhost:8080/_metrics"
    echo
    echo "Admin Token: $(grep ADMIN_TOKEN .env | cut -d= -f2)"
    echo
    echo "Useful Commands:"
    echo "  - View logs: $DOCKER_COMPOSE logs -f"
    echo "  - Stop services: $DOCKER_COMPOSE down"
    echo "  - Update SpinForge: $DOCKER_COMPOSE pull && $DOCKER_COMPOSE up -d"
    echo "  - Backup data: tar -czf backup.tar.gz data/"
    echo
    if [[ -n "$DOMAIN" ]]; then
        echo "Domain Configuration:"
        echo "  - Domain: $DOMAIN"
        echo "  - Don't forget to set up SSL!"
    fi
    echo
}

# Main deployment flow
main() {
    log "Starting SpinForge Docker deployment..."
    
    check_requirements
    create_directories
    
    # Only generate config if .env doesn't exist
    if [[ ! -f .env ]]; then
        generate_config
    else
        warning "Using existing .env file"
    fi
    
    create_compose_file
    create_nginx_config
    setup_ssl
    deploy
    print_info
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -d, --domain DOMAIN    Set domain for SSL setup"
    echo "  -e, --email EMAIL      Set email for Let's Encrypt"
    echo "  -v, --version VERSION  Set SpinForge version (default: latest)"
    echo "  -h, --help            Show this help message"
    echo
    echo "Example:"
    echo "  $0 --domain spinforge.example.com --email admin@example.com"
    echo
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -e|--email)
            EMAIL="$2"
            shift 2
            ;;
        -v|--version)
            SPINFORGE_VERSION="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Run main function
main "$@"