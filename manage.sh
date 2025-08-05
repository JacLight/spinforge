#!/usr/bin/env bash
# SpinForge Management Script

set -euo pipefail

# Check if docker compose is available
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose version &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "Error: Docker Compose not found!"
    exit 1
fi

COMMAND=${1:-}

case "$COMMAND" in
    start)
        echo "🚀 Starting SpinForge..."
        $DOCKER_COMPOSE up -d || { echo "Error: Failed to start services"; exit 1; }
        $DOCKER_COMPOSE ps
        ;;
    
    stop)
        echo "🛑 Stopping SpinForge..."
        $DOCKER_COMPOSE stop || { echo "Error: Failed to stop services"; exit 1; }
        ;;
    
    restart)
        echo "🔄 Restarting SpinForge..."
        $DOCKER_COMPOSE restart || { echo "Error: Failed to restart services"; exit 1; }
        $DOCKER_COMPOSE ps
        ;;
    
    down)
        echo "📦 Stopping and removing containers..."
        $DOCKER_COMPOSE down || { echo "Error: Failed to bring down services"; exit 1; }
        ;;
    
    logs)
        SERVICE=${2:-}
        if [ -z "$SERVICE" ]; then
            $DOCKER_COMPOSE logs -f
        else
            $DOCKER_COMPOSE logs -f "$SERVICE"
        fi
        ;;
    
    status)
        $DOCKER_COMPOSE ps
        ;;
    
    build)
        echo "🏗️  Building containers..."
        $DOCKER_COMPOSE build || { echo "Error: Build failed"; exit 1; }
        ;;
    
    rebuild)
        echo "🏗️  Rebuilding containers..."
        $DOCKER_COMPOSE down || { echo "Error: Failed to bring down services"; exit 1; }
        $DOCKER_COMPOSE build --no-cache || { echo "Error: Build failed"; exit 1; }
        $DOCKER_COMPOSE up -d || { echo "Error: Failed to start services"; exit 1; }
        $DOCKER_COMPOSE ps
        ;;
    
    shell)
        SERVICE=${2:-api}
        echo "🐚 Opening shell in $SERVICE container..."
        exec $DOCKER_COMPOSE exec "$SERVICE" /bin/sh
        ;;
    
    clean)
        echo "🧹 Cleaning up..."
        $DOCKER_COMPOSE down -v || { echo "Error: Failed to clean up"; exit 1; }
        echo "⚠️  Removed all containers and volumes"
        ;;
    
    *)
        echo "SpinForge Management"
        echo "==================="
        echo ""
        echo "Usage: ./manage.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  start       Start all services"
        echo "  stop        Stop all services"
        echo "  restart     Restart all services"
        echo "  down        Stop and remove containers"
        echo "  logs        View logs (optional: service name)"
        echo "  status      Show container status"
        echo "  build       Build containers"
        echo "  rebuild     Rebuild containers from scratch"
        echo "  shell       Open shell in container (default: api)"
        echo "  clean       Remove all containers and volumes"
        echo ""
        echo "Examples:"
        echo "  ./manage.sh start"
        echo "  ./manage.sh logs api"
        echo "  ./manage.sh shell keydb"
        ;;
esac