#!/bin/bash

# Test health check for deployment folder verification

set -e

echo "🏥 SpinForge Health Check Test"
echo "==============================="
echo ""

# Configuration
TEST_APP="health-check-test-$(date +%s)"
DOMAIN="${TEST_APP}.localhost"
CUSTOMER_ID="test-customer"

# Create deployment
DEPLOY_DIR="/Users/imzee/projects/spinforge/deployments/$TEST_APP"
echo "📦 Creating test deployment: $TEST_APP"

mkdir -p "$DEPLOY_DIR"

# Create deploy.json
cat > "$DEPLOY_DIR/deploy.json" <<EOF
{
    "name": "$TEST_APP",
    "domain": "$DOMAIN",
    "customerId": "$CUSTOMER_ID",
    "framework": "static"
}
EOF

# Create static content
cat > "$DEPLOY_DIR/index.html" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Health Check Test</title>
</head>
<body>
    <h1>Health Check Test Deployment</h1>
    <p>This deployment will be removed to test health checks</p>
</body>
</html>
EOF

echo "✅ Deployment created"

# Wait for deployment
echo "⏳ Waiting for deployment to complete..."
sleep 5

# Check deployment status
echo ""
echo "📋 Checking deployment status..."
curl -s http://localhost:9010/_admin/deployments | jq --arg name "$TEST_APP" '.[] | select(.name == $name)'

# Wait a bit
echo ""
echo "⏳ Waiting 10 seconds before removing deployment folder..."
sleep 10

# Remove deployment folder
echo ""
echo "🗑️  Removing deployment folder..."
rm -rf "$DEPLOY_DIR"

echo "✅ Deployment folder removed"

# Trigger health check
echo ""
echo "🏥 Triggering health check..."
curl -X POST http://localhost:9010/_admin/deployments/health-check

# Wait for health check to complete
echo ""
echo "⏳ Waiting for health check to complete..."
sleep 3

# Check logs
echo ""
echo "📋 Checking recent logs for health check activity..."
docker logs spinforge-hub --tail 50 2>&1 | grep -E "(health|Health|missing|removed|$TEST_APP)" | tail -20 || echo "No relevant logs found"

# Check if deployment still exists in API
echo ""
echo "🔍 Checking if deployment was removed from API..."
result=$(curl -s http://localhost:9010/_admin/deployments | jq --arg name "$TEST_APP" '.[] | select(.name == $name)')
if [ -z "$result" ]; then
    echo "✅ Deployment successfully removed by health check"
else
    echo "❌ Deployment still exists in API:"
    echo "$result"
fi

echo ""
echo "🏁 Health check test complete"