#!/bin/bash
# SpinForge Management Script

set -e

COMMAND=$1

case "$COMMAND" in
    start)
        echo "🚀 Starting SpinForge..."
        docker compose up -d
        docker compose ps
        ;;
    
    stop)
        echo "🛑 Stopping SpinForge..."
        docker compose stop
        ;;
    
    restart)
        echo "🔄 Restarting SpinForge..."
        docker compose restart
        docker compose ps
        ;;
    
    down)
        echo "📦 Stopping and removing containers..."
        docker compose down
        ;;
    
    logs)
        SERVICE=$2
        if [ -z "$SERVICE" ]; then
            docker compose logs -f
        else
            docker compose logs -f "$SERVICE"
        fi
        ;;
    
    status)
        docker compose ps
        ;;
    
    build)
        echo "🏗️  Building containers..."
        docker compose build
        ;;
    
    rebuild)
        echo "🏗️  Rebuilding containers..."
        docker compose down
        docker compose build --no-cache
        docker compose up -d
        docker compose ps
        ;;
    
    shell)
        SERVICE=${2:-api}
        echo "🐚 Opening shell in $SERVICE container..."
        docker compose exec "$SERVICE" /bin/sh
        ;;
    
    clean)
        echo "🧹 Cleaning up..."
        docker compose down -v
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