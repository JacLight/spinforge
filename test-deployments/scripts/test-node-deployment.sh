#!/bin/bash

# Test deployment with a Node.js Express app (supported framework)

set -e

echo "🚀 SpinForge Node.js Deployment Test"
echo "===================================="

# Configuration
TEST_APP="test-express-$(date +%s)"
DOMAIN="${TEST_APP}.local"
CUSTOMER_ID="test-customer"

# Check if SpinHub is running
if ! docker ps | grep -q spinforge-hub; then
    echo "❌ SpinHub container is not running"
    exit 1
fi

echo "✅ SpinHub container is running"

# Create deployment directory
DEPLOY_DIR="./deployments/$TEST_APP"
echo "📦 Creating Express app deployment: $TEST_APP"

rm -rf "$DEPLOY_DIR" 2>/dev/null || true
mkdir -p "$DEPLOY_DIR"

# Create a simple Express server
cat > "$DEPLOY_DIR/server.js" <<'EOF'
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>SpinForge Express Test</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .success { color: green; font-size: 24px; }
            </style>
        </head>
        <body>
            <h1 class="success">✅ SpinForge Express Deployment Working!</h1>
            <p>This is an Express.js app deployed via SpinForge</p>
            <p>App: ${TEST_APP}</p>
            <p>Port: ${PORT}</p>
            <p>Time: ${new Date().toISOString()}</p>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', app: '${TEST_APP}' });
});

app.listen(PORT, () => {
    console.log(\`Express server running on port \${PORT}\`);
});
EOF

# Create package.json
cat > "$DEPLOY_DIR/package.json" <<EOF
{
  "name": "$TEST_APP",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

# Install dependencies
echo "📦 Installing dependencies..."
cd "$DEPLOY_DIR"
npm install --production
cd - > /dev/null

# Create deploy.json with express framework
cat > "$DEPLOY_DIR/deploy.json" <<EOF
{
    "name": "$TEST_APP",
    "version": "1.0.0",
    "description": "SpinForge Express deployment test",
    "domain": "$DOMAIN",
    "customerId": "$CUSTOMER_ID",
    "framework": "express",
    "runtime": "node",
    "start": {
        "command": "node server.js",
        "port": 3000
    },
    "resources": {
        "memory": "256MB",
        "cpu": 0.5
    },
    "networking": {
        "cors": true
    }
}
EOF

echo "✅ Express app created with dependencies installed"

# Show structure
echo ""
echo "📁 Deployment structure:"
ls -la "$DEPLOY_DIR"

# Trigger deployment by touching deploy.json
touch "$DEPLOY_DIR/deploy.json"

# Wait for deployment
echo ""
echo "⏳ Waiting for deployment..."
sleep 5

# Check logs
echo ""
echo "📋 Recent deployment logs:"
docker logs spinforge-hub --tail 30 2>&1 | grep -E "(deployment|$TEST_APP|express)" | tail -20 || echo "No logs yet"

# Test the deployment
echo ""
echo "🧪 Testing deployment..."
echo "   Domain: $DOMAIN"

# Try multiple times as deployment might take a moment
for i in {1..10}; do
    response=$(curl -s -w "\n%{http_code}" \
        -H "Host: $DOMAIN" \
        http://localhost:9004/ 2>/dev/null || echo "Failed")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" == "200" ]]; then
        echo "✅ Deployment test PASSED! (HTTP $http_code)"
        echo "   App is running at: http://$DOMAIN:9004/"
        
        # Test health endpoint
        echo ""
        echo "🏥 Testing health endpoint..."
        health=$(curl -s -H "Host: $DOMAIN" http://localhost:9004/health)
        echo "   Health response: $health"
        
        break
    else
        echo "   Attempt $i/10: HTTP $http_code (waiting...)"
        sleep 2
    fi
done

echo ""
echo "📁 Deployment location: $DEPLOY_DIR"