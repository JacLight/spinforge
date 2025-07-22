#!/bin/bash

# Quick deployment test for SpinForge

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 SpinForge Quick Deploy Test"
echo "=============================="
echo ""
echo "This will quickly test if deployment is working"
echo ""

# Check if SpinHub is running
if ! curl -s http://localhost:9004/health > /dev/null 2>&1; then
    echo "❌ SpinHub is not running on port 9004"
    echo "   Please ensure SpinForge is running: docker-compose up -d"
    exit 1
fi

echo "✅ SpinHub is running"

# Deploy a simple test app
TEST_APP="quick-test-$(date +%s)"
DEPLOY_DIR="/Users/imzee/projects/spinforge/deployments/$TEST_APP"

echo "📦 Creating test deployment: $TEST_APP"

mkdir -p "$DEPLOY_DIR"

# Create a simple HTML app
cat > "$DEPLOY_DIR/index.html" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>SpinForge Quick Test</title>
</head>
<body>
    <h1>SpinForge Deployment Test</h1>
    <p>If you can see this, deployment is working!</p>
    <p>App: $TEST_APP</p>
    <p>Time: $(date)</p>
</body>
</html>
EOF

# Create deploy.json with proper configuration
cat > "$DEPLOY_DIR/deploy.json" <<EOF
{
    "name": "$TEST_APP",
    "domain": "$TEST_APP.localhost",
    "framework": "static",
    "customerId": "test-customer",
    "buildPath": "/spinforge/deployments/$TEST_APP"
}
EOF

echo "✅ Test app created"

# Since volumes are mounted, we should work directly in the mounted directory
# The ./deployments directory on host is mounted as /spinforge/deployments in container
HOST_DEPLOY_DIR="./deployments/$TEST_APP"

echo "📤 Creating deployment in mounted directory..."
rm -rf "$HOST_DEPLOY_DIR" 2>/dev/null || true
mkdir -p "$HOST_DEPLOY_DIR"

# Copy files to the mounted directory
cp -r "$DEPLOY_DIR"/* "$HOST_DEPLOY_DIR/"

echo "✅ Deployment created in mounted directory"

# Wait a moment for the file watcher to detect changes
sleep 2

# Test the deployment
echo "🧪 Testing deployment..."
sleep 2

response=$(curl -s -w "\n%{http_code}" \
    -H "Host: $TEST_APP.localhost" \
    http://localhost:9004/ 2>/dev/null || echo "Failed")

if [[ "$response" == *"200"* ]] || [[ "$response" == *"SpinForge Deployment Test"* ]]; then
    echo "✅ Deployment test PASSED!"
    echo "   App is accessible at: http://$TEST_APP.localhost:9004/"
else
    echo "❌ Deployment test FAILED"
    echo "   Response: $response"
fi

echo ""
echo "📁 Deployment directory: $DEPLOY_DIR"
echo ""
echo "To clean up: rm -rf $DEPLOY_DIR"