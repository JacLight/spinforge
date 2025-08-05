#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# Comprehensive API deployment example

echo "🚀 SpinForge API Deployment Examples"
echo "===================================="
echo ""

API_URL="http://localhost:9010/_admin"

# 1. List all deployments
echo "📋 1. Listing all deployments:"
echo "   GET ${API_URL}/deployments"
echo ""
curl -s "${API_URL}/deployments" | jq '.[] | {name, status, framework, domains}'
echo ""

# 2. Create and deploy a new app
echo "🆕 2. Creating a new deployment:"
APP_NAME="api-demo-$(date +%s)"
DEPLOY_DIR="/Users/imzee/projects/spinforge/deployments/$APP_NAME"

mkdir -p "$DEPLOY_DIR"
cat > "$DEPLOY_DIR/index.html" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>API Demo</title>
</head>
<body>
    <h1>Deployed via SpinForge API</h1>
    <p>App: $APP_NAME</p>
</body>
</html>
EOF

cat > "$DEPLOY_DIR/deploy.json" <<EOF
{
    "name": "$APP_NAME",
    "domain": "$APP_NAME.localhost",
    "customerId": "api-demo-customer",
    "framework": "static"
}
EOF

echo "   Created deployment: $DEPLOY_DIR"
echo ""

# 3. Trigger deployment scan
echo "🔄 3. Triggering deployment scan:"
echo "   POST ${API_URL}/deployments/scan"
SCAN_RESULT=$(curl -s -X POST "${API_URL}/deployments/scan")
echo "   Result: $SCAN_RESULT"
echo ""

# 4. Check specific deployment status
sleep 5
echo "📊 4. Checking deployment status:"
echo "   GET ${API_URL}/deployments (filtered)"
DEPLOY_STATUS=$(curl -s "${API_URL}/deployments" | jq --arg name "$APP_NAME" '.[] | select(.name == $name)')
echo "$DEPLOY_STATUS" | jq '.'
echo ""

# 5. Get deployment logs (mock)
echo "📄 5. Getting deployment logs:"
echo "   GET ${API_URL}/deployments/$APP_NAME/logs"
curl -s "${API_URL}/deployments/$APP_NAME/logs" | jq '.logs' | head -10
echo ""

# 6. Test the deployed app
echo "🧪 6. Testing deployed app:"
echo "   GET http://$APP_NAME.localhost:9004/"
TEST_RESULT=$(curl -s -w "\nHTTP: %{http_code}" -H "Host: $APP_NAME.localhost" http://localhost:9004/)
echo "$TEST_RESULT" | tail -1
echo ""

# 7. Health check
echo "🏥 7. Triggering health check:"
echo "   POST ${API_URL}/deployments/health-check"
curl -s -X POST "${API_URL}/deployments/health-check" | jq '.'
echo ""

# 8. API deployment with environment variables
echo "🔧 8. Creating deployment with environment variables:"
ENV_APP="api-env-demo-$(date +%s)"
ENV_DIR="/Users/imzee/projects/spinforge/deployments/$ENV_APP"

mkdir -p "$ENV_DIR"
cat > "$ENV_DIR/server.js" <<'EOF'
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        message: 'Environment variables demo',
        env: {
            NODE_ENV: process.env.NODE_ENV,
            API_KEY: process.env.API_KEY,
            CUSTOM_VAR: process.env.CUSTOM_VAR
        },
        port: process.env.PORT
    }));
});
server.listen(process.env.PORT || 3000);
EOF

cat > "$ENV_DIR/deploy.json" <<EOF
{
    "name": "$ENV_APP",
    "domain": "$ENV_APP.localhost",
    "customerId": "api-demo-customer",
    "framework": "node",
    "env": {
        "NODE_ENV": "production",
        "API_KEY": "demo-key-12345",
        "CUSTOM_VAR": "SpinForge Rocks!"
    }
}
EOF

echo "   Created: $ENV_DIR"
curl -s -X POST "${API_URL}/deployments/scan" > /dev/null
echo ""

# 9. Remove deployment
echo "🗑️  9. Removing a deployment:"
echo "   DELETE ${API_URL}/deployments/$APP_NAME"
REMOVE_RESULT=$(curl -s -X DELETE "${API_URL}/deployments/$APP_NAME")
echo "   Result: $REMOVE_RESULT"
echo ""

# 10. Final deployment count
echo "📈 10. Final deployment count:"
TOTAL=$(curl -s "${API_URL}/deployments" | jq '. | length')
echo "   Total deployments: $TOTAL"
echo ""

echo "✅ API demonstration complete!"
echo ""
echo "📚 API Endpoints Summary:"
echo "   GET    /deployments              - List all deployments"
echo "   POST   /deployments/scan         - Scan for new deployments"
echo "   GET    /deployments/:name/logs   - Get deployment logs"
echo "   POST   /deployments/:name/retry  - Retry failed deployment"
echo "   DELETE /deployments/:name        - Remove deployment"
echo "   POST   /deployments/health-check - Run health check"