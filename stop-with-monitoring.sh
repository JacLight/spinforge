#!/usr/bin/env bash
set -euo pipefail

# Detect docker compose command (v1 vs v2)
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo "Stopping SpinForge and monitoring stack..."

# Stop monitoring stack first
echo "Stopping monitoring services..."
if [ -f "docker-compose.monitoring.yml" ]; then
    $DOCKER_COMPOSE -f docker-compose.monitoring.yml down || { echo "Error: Failed to stop monitoring services"; exit 1; }
else
    echo "Warning: docker-compose.monitoring.yml not found, skipping monitoring stack"
fi

# Stop main SpinForge stack
echo "Stopping main SpinForge services..."
$DOCKER_COMPOSE down || { echo "Error: Failed to stop main services"; exit 1; }

# Optional: Remove volumes (commented out by default)
# echo "Removing volumes..."
# $DOCKER_COMPOSE down -v
# $DOCKER_COMPOSE -f docker-compose.monitoring.yml down -v

# Verify services are stopped
if $DOCKER_COMPOSE ps -q 2>/dev/null | grep -q .; then
    echo "Warning: Some main services may still be running"
fi

if [ -f "docker-compose.monitoring.yml" ] && $DOCKER_COMPOSE -f docker-compose.monitoring.yml ps -q 2>/dev/null | grep -q .; then
    echo "Warning: Some monitoring services may still be running"
fi

echo ""
echo "All services stopped."
echo ""
echo "To remove all data and volumes, run:"
echo "  $DOCKER_COMPOSE down -v"
echo "  $DOCKER_COMPOSE -f docker-compose.monitoring.yml down -v"