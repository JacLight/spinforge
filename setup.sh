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

# Create required directories
echo "📁 Creating directories..."
# Create hosting directory first if it doesn't exist
mkdir -p hosting
# Create all subdirectories
mkdir -p hosting/data/{static/errors,certs/live/default,certbot-webroot,certbot-logs}
mkdir -p hosting/data/{deployments,uploads,certs/archive}
mkdir -p hosting/openresty/lua
mkdir -p hosting/api/{routes,services,utils}
mkdir -p hosting/scripts
mkdir -p apps/{admin-ui,website}
mkdir -p monitoring/{prometheus,loki,grafana/dashboards}

# Generate SSL certificates (required for OpenResty)
if [ ! -f hosting/data/certs/live/default/fullchain.pem ]; then
    echo "🔐 Generating SSL certificates..."
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout hosting/data/certs/live/default/privkey.pem \
        -out hosting/data/certs/live/default/fullchain.pem \
        -subj "/CN=localhost" -batch 2>/dev/null
    
    # Fix permissions for Docker access (readable by root)
    chmod 644 hosting/data/certs/live/default/fullchain.pem
    chmod 644 hosting/data/certs/live/default/privkey.pem
    
    # Ensure certificate directories have proper permissions
    chmod -R 755 hosting/data/certs/live
    chmod -R 755 hosting/data/certs/archive
    
    echo "✅ SSL certificates created"
else
    echo "✅ SSL certificates exist"
fi

# Copy static files
echo "📄 Setting up static files..."
cp 404.html hosting/data/static/errors/404.html
cp 50x.html hosting/data/static/errors/500.html
cp 50x.html hosting/data/static/errors/502.html
cp 50x.html hosting/data/static/errors/503.html
cp 404.html hosting/data/static/index.html
echo "✅ Static files configured"

# Create Docker network if it doesn't exist
echo "🔗 Setting up Docker network..."
docker network create spinforge 2>/dev/null || echo "✅ Network already exists"

# Optional: Create .env file
if [ ! -f .env ] && [ "$1" != "--no-env" ]; then
    echo "📝 Creating .env file with defaults..."
    cat > .env << 'EOF'
# SpinForge Configuration
BASE_DOMAIN=localhost
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Redis Configuration
REDIS_HOST=keydb
REDIS_PORT=16378
REDIS_DB=1

# Static file paths
STATIC_ROOT=/data/static
UPLOAD_TEMP_DIR=/data/uploads

# Certificate paths
CERTS_PATH=/data/certs
CERTBOT_WEBROOT=/data/certbot-webroot
EOF
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