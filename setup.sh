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

# Create required directories
echo "📁 Creating directories..."
# Create hosting directory first if it doesn't exist
mkdir -p hosting
# Create all subdirectories
mkdir -p hosting/data/{static/errors,certs/live/default,certbot-webroot,certbot-logs}
mkdir -p hosting/data/deployments
mkdir -p hosting/data/uploads  # For temporary ZIP file uploads
mkdir -p hosting/openresty/lua
mkdir -p hosting/api
mkdir -p apps/{admin-ui,website}

# Generate SSL certificates (required for OpenResty)
if [ ! -f hosting/data/certs/live/default/fullchain.pem ]; then
    echo "🔐 Generating SSL certificates..."
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout hosting/data/certs/live/default/privkey.pem \
        -out hosting/data/certs/live/default/fullchain.pem \
        -subj "/CN=localhost" -batch 2>/dev/null
    
    # Fix permissions for Docker access
    chmod 644 hosting/data/certs/live/default/fullchain.pem
    chmod 640 hosting/data/certs/live/default/privkey.pem
    
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

# Optional: Create .env file
if [ ! -f .env ] && [ "$1" != "--no-env" ]; then
    echo "📝 Creating .env file with defaults..."
    cat > .env << 'EOF'
# SpinForge Configuration
BASE_DOMAIN=localhost
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
EOF
fi

# Build from source
echo "🏗️  Building containers..."
docker compose build

# Start services
echo "🚀 Starting services..."
docker compose up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 5

# Show status
echo ""
docker compose ps

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
echo "  View logs:    docker compose logs -f [service]"
echo "  Stop:         docker compose down"
echo "  Restart:      docker compose restart"
echo "  Status:       docker compose ps"
echo ""