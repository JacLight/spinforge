#!/bin/bash
# SpinForge Setup Script
# Sets up and starts SpinForge from source

set -e

echo "🚀 SpinForge Setup"
echo "=================="

# Check if running in correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Run this script from the SpinForge root directory"
    exit 1
fi

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Error: Docker Compose is not installed"
    exit 1
fi

# Configure data root - always use local path by default
# The actual storage backend (local, Ceph, NFS, etc) is handled by volume mounts
DATA_ROOT="${SPINFORGE_DATA_ROOT:-./hosting/data}"
echo "📁 Data directory: $DATA_ROOT"

# Create required directories
echo "📁 Creating directories..."
# Create data directories at configured root
mkdir -p "$DATA_ROOT"/{static/errors,certs/live/default,certbot-webroot,certbot-logs}
mkdir -p "$DATA_ROOT"/{deployments,uploads,certs/archive}
# Create local directories for code
mkdir -p hosting/openresty/lua
mkdir -p hosting/api/{routes,services,utils}
mkdir -p hosting/scripts
mkdir -p apps/{admin-ui,website}
mkdir -p monitoring/{prometheus,loki,grafana/dashboards}

# Generate SSL certificates (required for OpenResty)
if [ ! -f "$DATA_ROOT/certs/live/default/fullchain.pem" ]; then
    echo "🔐 Generating SSL certificates..."
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$DATA_ROOT/certs/live/default/privkey.pem" \
        -out "$DATA_ROOT/certs/live/default/fullchain.pem" \
        -subj "/CN=localhost" -batch 2>/dev/null
    
    # Fix permissions for Docker access (readable by root)
    chmod 644 "$DATA_ROOT/certs/live/default/fullchain.pem"
    chmod 644 "$DATA_ROOT/certs/live/default/privkey.pem"
    
    # Ensure certificate directories have proper permissions
    chmod -R 755 "$DATA_ROOT/certs/live"
    chmod -R 755 "$DATA_ROOT/certs/archive"
    
    echo "✅ SSL certificates created"
else
    echo "✅ SSL certificates exist"
fi

# Copy static files
echo "📄 Setting up static files..."
if [ -f 404.html ]; then
    cp 404.html "$DATA_ROOT/static/errors/404.html"
    cp 404.html "$DATA_ROOT/static/index.html"
fi
if [ -f 50x.html ]; then
    cp 50x.html "$DATA_ROOT/static/errors/500.html"
    cp 50x.html "$DATA_ROOT/static/errors/502.html"
    cp 50x.html "$DATA_ROOT/static/errors/503.html"
fi
echo "✅ Static files configured"

# Install MCP server dependencies if needed
if [ -d "mcp-server" ] && [ ! -d "mcp-server/node_modules" ]; then
    echo "📦 Installing MCP server dependencies..."
    cd mcp-server
    npm install
    cd ..
    echo "✅ MCP server dependencies installed"
fi

# Create Docker network if it doesn't exist
echo "🔗 Setting up Docker network..."
docker network create spinforge 2>/dev/null || echo "✅ Network already exists"

# Check for .env file
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "⚠️  No .env file found. Copying from .env.example..."
        cp .env.example .env
        echo "📝 Please edit .env file with your configuration:"
        echo "   - Set DOMAIN to your domain"
        echo "   - Set JWT_SECRET to a secure random string"
        echo "   - Set REDIS_PASSWORD for security"
        echo "   - Set SSL_CERT_EMAIL for Let's Encrypt"
        echo ""
        echo "Press Enter to continue with defaults or Ctrl+C to edit .env first..."
        read -r
    else
        echo "📝 Creating .env file with defaults..."
        cat > .env << 'EOF'
# SpinForge Configuration
DOMAIN=localhost
API_DOMAIN=api.localhost
MCP_DOMAIN=mcp.localhost

# Security
JWT_SECRET=change-this-to-secure-random-string
REDIS_PASSWORD=

# Redis Configuration
REDIS_HOST=keydb
REDIS_PORT=16378
REDIS_DB=1

# API Configuration
API_URL=http://api:8080
SPINFORGE_API_URL=http://api:8080/api

# Data root configuration
# Inside containers, data is always at /data
# On host, it can be local ./hosting/data
DATA_ROOT=/data

# Relative paths from DATA_ROOT
# These are used internally by containers
STATIC_SUBDIR=static
CERTS_SUBDIR=certs
UPLOADS_SUBDIR=uploads
DEPLOYMENTS_SUBDIR=deployments

# SSL Configuration
SSL_CERT_EMAIL=admin@localhost

# Docker Network
DOCKER_NETWORK=spinforge

# Development Settings
NODE_ENV=development
DEBUG=false
EOF
    fi
fi

# Build from source
echo "🏗️  Building containers..."
$DOCKER_COMPOSE build

# Start services
echo "🚀 Starting services..."
$DOCKER_COMPOSE up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 5

# Show status
echo ""
$DOCKER_COMPOSE ps

echo ""
echo "✨ SpinForge is ready!"
echo "====================="
echo ""
echo "Access points:"
echo "  🌐 Admin UI: http://localhost:8083"
echo "  🔧 API: http://localhost:8080"
echo "  📄 Website: http://localhost:3001"
echo ""
echo "Default login:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Commands:"
echo "  View logs:    $DOCKER_COMPOSE logs -f [service]"
echo "  Stop:         $DOCKER_COMPOSE down"
echo "  Restart:      $DOCKER_COMPOSE restart"
echo "  Status:       $DOCKER_COMPOSE ps"
echo ""
echo "Optional: Start with monitoring"
echo "  ./start-with-monitoring.sh"
echo ""