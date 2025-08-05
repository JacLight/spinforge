#!/bin/bash

echo "Starting SpinForge with monitoring stack..."

# Start main SpinForge stack
echo "Starting main SpinForge services..."
docker-compose up -d

# Wait for main services to be ready
echo "Waiting for main services to start..."
sleep 10

# Start monitoring stack
echo "Starting monitoring services..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for monitoring services to be ready
echo "Waiting for monitoring services to start..."
sleep 10

# Show status
echo ""
echo "=== SpinForge Status ==="
docker-compose ps
echo ""
echo "=== Monitoring Status ==="
docker-compose -f docker-compose.monitoring.yml ps
echo ""
echo "=== Service URLs ==="
echo "SpinForge Admin UI: http://localhost:8083"
echo "SpinForge API: http://localhost:8080"
echo "Grafana: http://localhost:3000 (admin/admin)"
echo "Prometheus: http://localhost:9090"
echo ""
echo "To view logs:"
echo "  Main stack: docker-compose logs -f"
echo "  Monitoring: docker-compose -f docker-compose.monitoring.yml logs -f"