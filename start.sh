#!/bin/bash
# SpinForge Quick Start Script

set -e

echo "🚀 Starting SpinForge..."

# Check if containers exist
if [ "$(docker ps -aq -f name=spinforge-)" ]; then
    echo "📦 Starting existing containers..."
    docker compose start
else
    echo "🏗️  Building and starting containers..."
    docker compose up -d --build
fi

# Show status
echo ""
docker compose ps

echo ""
echo "✨ SpinForge is running!"
echo ""
echo "Access points:"
echo "  🌐 Admin UI: http://localhost:8083"
echo "  🔧 API: http://localhost:8080"
echo "  📄 Website: http://localhost:3001"