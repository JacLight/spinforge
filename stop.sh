#!/bin/bash
# SpinForge Stop Script

set -e

echo "🛑 Stopping SpinForge..."

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

# Stop containers
$DOCKER_COMPOSE stop

echo ""
echo "✅ SpinForge stopped"
echo ""
echo "Commands:"
echo "  Start again:     ./start.sh"
echo "  Remove all:      $DOCKER_COMPOSE down"
echo "  Remove volumes:  $DOCKER_COMPOSE down -v"