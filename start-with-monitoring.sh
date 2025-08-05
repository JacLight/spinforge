#!/usr/bin/env bash
set -euo pipefail

# Detect docker compose command (v1 vs v2)
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo "Starting SpinForge with monitoring stack..."

# Check if monitoring compose file exists
if [ ! -f "docker-compose.monitoring.yml" ]; then
    echo "Error: docker-compose.monitoring.yml not found!"
    echo "Please run this script from the SpinForge root directory."
    exit 1
fi

# Start main SpinForge stack
echo "Starting main SpinForge services..."
$DOCKER_COMPOSE up -d || { echo "Error: Failed to start main services"; exit 1; }

# Wait for main services to be ready
echo "Waiting for main services to start..."
sleep 10

# Check if main services are running
if ! $DOCKER_COMPOSE ps --format json 2>/dev/null | grep -q '"State":"running"' && ! $DOCKER_COMPOSE ps 2>/dev/null | grep -qE "(Up|Running)"; then
    echo "Error: Main services failed to start. Check logs with: $DOCKER_COMPOSE logs"
    exit 1
fi

# Start monitoring stack
echo "Starting monitoring services..."
$DOCKER_COMPOSE -f docker-compose.monitoring.yml up -d || { echo "Error: Failed to start monitoring services"; exit 1; }

# Wait for monitoring services to be ready
echo "Waiting for monitoring services to start..."
sleep 10

# Show status
echo ""
echo "=== SpinForge Status ==="
$DOCKER_COMPOSE ps
echo ""
echo "=== Monitoring Status ==="
$DOCKER_COMPOSE -f docker-compose.monitoring.yml ps
echo ""
echo "=== Service URLs ==="
echo "SpinForge Admin UI: http://localhost:8083"
echo "SpinForge API: http://localhost:8080"
echo "Grafana: http://localhost:3000 (admin/admin)"
echo "Prometheus: http://localhost:9090"
echo ""
echo "To view logs:"
echo "  Main stack: $DOCKER_COMPOSE logs -f"
echo "  Monitoring: $DOCKER_COMPOSE -f docker-compose.monitoring.yml logs -f"
echo ""
echo "To check metrics endpoint: curl http://localhost:8080/metrics"