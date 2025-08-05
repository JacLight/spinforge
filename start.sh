#!/usr/bin/env bash
# SpinForge Quick Start Script

set -euo pipefail

echo "🚀 Starting SpinForge..."

# Detect docker compose command (v1 vs v2)
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Check if running in correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Run this script from the SpinForge root directory"
    exit 1
fi

# Check if containers exist
if [ -n "$($DOCKER_COMPOSE ps -aq 2>/dev/null)" ]; then
    echo "📦 Starting existing containers..."
    $DOCKER_COMPOSE start || { echo "❌ Error: Failed to start containers"; exit 1; }
else
    echo "🏗️  Building and starting containers..."
    $DOCKER_COMPOSE up -d --build || { echo "❌ Error: Failed to build and start containers"; exit 1; }
fi

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Show status
echo ""
$DOCKER_COMPOSE ps

echo ""
echo "✨ SpinForge is running!"
echo ""
echo "Access points:"
echo "  🌐 Admin UI: http://localhost:8083"
echo "  🔧 API: http://localhost:8080"
echo "  📄 Website: http://localhost:3001"
echo ""
echo "Commands:"
echo "  View logs:    $DOCKER_COMPOSE logs -f [service]"
echo "  Stop:         ./stop.sh"
echo "  Status:       $DOCKER_COMPOSE ps"