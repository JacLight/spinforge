#!/bin/bash

echo "Stopping SpinForge and monitoring stack..."

# Stop monitoring stack
echo "Stopping monitoring services..."
docker-compose -f docker-compose.monitoring.yml down

# Stop main SpinForge stack
echo "Stopping main SpinForge services..."
docker-compose down

echo "All services stopped."