#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# Deploy Express.js API via SpinForge

set -e

echo "🚀 Express.js API Deployment"
echo "============================"
echo ""

# Configuration
APP_NAME="express-api-$(date +%s)"
DEPLOY_DIR="/Users/imzee/projects/spinforge/deployments/$APP_NAME"

# Create deployment
echo "📦 Creating Express API deployment: $APP_NAME"
mkdir -p "$DEPLOY_DIR"

cd "$DEPLOY_DIR"

# Create package.json
cat > package.json <<'EOF'
{
  "name": "express-api",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

# Create Express server
cat > server.js <<'EOF'
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Express API on SpinForge!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    pid: process.pid
  });
});

app.post('/echo', (req, res) => {
  res.json({
    message: 'Echo response',
    receivedData: req.body,
    headers: req.headers
  });
});

app.get('/env', (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    CUSTOM_VAR: process.env.CUSTOM_VAR,
    API_VERSION: process.env.API_VERSION,
    PORT: process.env.PORT
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create deploy.json
cat > deploy.json <<EOF
{
  "name": "$APP_NAME",
  "domain": "$APP_NAME.localhost",
  "customerId": "test-customer",
  "framework": "node",
  "env": {
    "NODE_ENV": "production",
    "CUSTOM_VAR": "Express rocks on SpinForge!",
    "API_VERSION": "1.0.0"
  },
  "resources": {
    "memory": "256MB",
    "cpu": 0.5
  }
}
EOF

echo "✅ Express API created"

# Trigger deployment
echo ""
echo "🔄 Triggering deployment..."
curl -X POST http://localhost:9010/_admin/deployments/scan

# Wait for deployment
echo ""
echo "⏳ Waiting for deployment..."
sleep 10

# Check status
echo ""
echo "📊 Checking deployment status..."
STATUS=$(curl -s http://localhost:9010/_admin/deployments | jq --arg name "$APP_NAME" '.[] | select(.name == $name)')

if [ -z "$STATUS" ]; then
    echo "❌ Deployment not found"
    exit 1
fi

echo "$STATUS" | jq '.'

DEPLOY_STATUS=$(echo "$STATUS" | jq -r '.status')

if [ "$DEPLOY_STATUS" = "success" ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "🧪 Testing API endpoints..."
    
    # Test root endpoint
    echo ""
    echo "1. Testing GET /:"
    curl -s -H "Host: $APP_NAME.localhost" http://localhost:9004/ | jq '.'
    
    # Test health endpoint
    echo ""
    echo "2. Testing GET /health:"
    curl -s -H "Host: $APP_NAME.localhost" http://localhost:9004/health | jq '.'
    
    # Test environment endpoint
    echo ""
    echo "3. Testing GET /env:"
    curl -s -H "Host: $APP_NAME.localhost" http://localhost:9004/env | jq '.'
    
    # Test POST endpoint
    echo ""
    echo "4. Testing POST /echo:"
    curl -s -X POST \
      -H "Host: $APP_NAME.localhost" \
      -H "Content-Type: application/json" \
      -d '{"test": "data", "number": 42}' \
      http://localhost:9004/echo | jq '.'
    
    echo ""
    echo "🌐 API available at: http://$APP_NAME.localhost:9004/"
    echo ""
    echo "📚 Available endpoints:"
    echo "   GET  /        - Welcome message"
    echo "   GET  /health  - Health check"
    echo "   GET  /env     - Environment variables"
    echo "   POST /echo    - Echo back request data"
else
    echo ""
    echo "❌ Deployment status: $DEPLOY_STATUS"
    ERROR=$(echo "$STATUS" | jq -r '.error // "Unknown"')
    echo "Error: $ERROR"
fi

echo ""
echo "📁 Deployment location: $DEPLOY_DIR"