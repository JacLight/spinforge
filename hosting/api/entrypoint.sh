#!/bin/sh
# SpinForge API Entrypoint
# Initializes routes and starts the API server

echo "Starting SpinForge API..."

# Run route initialization
if [ -f /app/scripts/init-routes.sh ]; then
  echo "Initializing internal routes..."
  /app/scripts/init-routes.sh
else
  echo "Warning: init-routes.sh not found, skipping route initialization"
fi

# Start the API server
echo "Starting API server..."
exec node server-openresty.js