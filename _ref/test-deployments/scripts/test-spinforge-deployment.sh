#!/bin/bash

# Comprehensive SpinForge deployment test

set -e

echo "🚀 SpinForge Deployment Test"
echo "============================"

# Configuration
TEST_APP="test-static-$(date +%s)"
DOMAIN="${TEST_APP}.localhost"
CUSTOMER_ID="test-customer"

# Check if SpinHub is running
if ! docker ps | grep -q spinforge-hub; then
    echo "❌ SpinHub container is not running"
    echo "   Please start SpinForge: docker-compose up -d"
    exit 1
fi

echo "✅ SpinHub container is running"

# Create deployment directory in the mounted volume
DEPLOY_DIR="./deployments/$TEST_APP"
echo "📦 Creating deployment: $TEST_APP"

# Clean up any existing deployment
rm -rf "$DEPLOY_DIR" 2>/dev/null || true
mkdir -p "$DEPLOY_DIR"

# Create a complete static site
cat > "$DEPLOY_DIR/index.html" <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>SpinForge Deployment Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            background-color: #f0f0f0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #333; }
        .success { color: #4CAF50; font-weight: bold; }
        .info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
        code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎉 SpinForge Deployment Test</h1>
        <p class="success">✅ If you can see this, the deployment is working!</p>
        
        <div class="info">
            <h3>Deployment Details</h3>
            <p><strong>App Name:</strong> <code>TEST_APP_NAME</code></p>
            <p><strong>Domain:</strong> <code>TEST_DOMAIN</code></p>
            <p><strong>Customer ID:</strong> <code>TEST_CUSTOMER_ID</code></p>
            <p><strong>Deployed At:</strong> <code>TEST_TIMESTAMP</code></p>
            <p><strong>Framework:</strong> Static HTML</p>
        </div>
        
        <h3>Features Tested</h3>
        <ul>
            <li>✓ Static file serving</li>
            <li>✓ Hot deployment</li>
            <li>✓ Domain routing</li>
            <li>✓ Customer isolation</li>
        </ul>
    </div>
</body>
</html>
EOF

# Replace placeholders
sed -i.bak "s/TEST_APP_NAME/$TEST_APP/g" "$DEPLOY_DIR/index.html"
sed -i.bak "s/TEST_DOMAIN/$DOMAIN/g" "$DEPLOY_DIR/index.html"
sed -i.bak "s/TEST_CUSTOMER_ID/$CUSTOMER_ID/g" "$DEPLOY_DIR/index.html"
sed -i.bak "s/TEST_TIMESTAMP/$(date)/g" "$DEPLOY_DIR/index.html"
rm -f "$DEPLOY_DIR/index.html.bak"

# Create proper deploy.json with all required fields
cat > "$DEPLOY_DIR/deploy.json" <<EOF
{
    "name": "$TEST_APP",
    "version": "1.0.0",
    "description": "SpinForge deployment test application",
    "domain": "$DOMAIN",
    "customerId": "$CUSTOMER_ID",
    "framework": "static",
    "runtime": "static",
    "resources": {
        "memory": "128MB",
        "cpu": 0.1
    },
    "networking": {
        "cors": true
    },
    "monitoring": {
        "logs": {
            "level": "info"
        }
    }
}
EOF

echo "✅ Deployment files created"

# Show what was created
echo ""
echo "📁 Deployment structure:"
ls -la "$DEPLOY_DIR"

# Wait for hot deployment watcher to process
echo ""
echo "⏳ Waiting for deployment to process..."
sleep 5

# Check deployment logs
echo ""
echo "📋 Recent deployment logs:"
docker logs spinforge-hub --tail 20 2>&1 | grep -E "(deployment|$TEST_APP)" || echo "No relevant logs found"

# Test the deployment
echo ""
echo "🧪 Testing deployment..."
echo "   Domain: $DOMAIN"
echo "   URL: http://localhost:9004/"

# Test with curl
response=$(curl -s -w "\n%{http_code}" \
    -H "Host: $DOMAIN" \
    http://localhost:9004/ 2>/dev/null || echo "Connection failed")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

echo ""
if [[ "$http_code" == "200" ]]; then
    echo "✅ Deployment test PASSED! (HTTP $http_code)"
    echo "   The app is accessible at: http://$DOMAIN:9004/"
    echo ""
    echo "📄 Response preview:"
    echo "$body" | head -5
    echo "   ..."
else
    echo "❌ Deployment test FAILED (HTTP $http_code)"
    echo ""
    echo "Response:"
    echo "$body"
    
    echo ""
    echo "🔍 Debugging information:"
    echo "1. Check if deployment was processed:"
    echo "   docker logs spinforge-hub --tail 50 | grep $TEST_APP"
    echo ""
    echo "2. Check running spinlets:"
    echo "   docker exec spinforge-hub ps aux | grep node"
    echo ""
    echo "3. Check Redis routes:"
    echo "   docker exec spinforge-keydb keydb-cli -a changeThisStrongPassword123 keys 'route:*'"
fi

echo ""
echo "📁 Deployment location: $DEPLOY_DIR"
echo ""
echo "🧹 To clean up: rm -rf $DEPLOY_DIR"