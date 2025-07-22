#!/bin/bash

# Test script for local domain routing

echo "=== SpinForge Local Testing Script ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if SpinHub is accessible
echo "Checking SpinHub health..."
if curl -s http://localhost:9004/_health > /dev/null; then
    echo -e "${GREEN}✓ SpinHub is running${NC}"
else
    echo -e "${RED}✗ SpinHub is not accessible on port 9004${NC}"
    exit 1
fi

# Deploy a test app
echo ""
echo "Deploying test application..."
RESPONSE=$(curl -s -X POST http://localhost:9004/_admin/routes \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: test-token" \
  -d '{
    "domain": "testapp.localhost",
    "customerId": "test-customer",
    "spinletId": "spin-test-'$(date +%s)'",
    "buildPath": "/tmp/test-app",
    "framework": "static",
    "config": {
      "memory": "128MB",
      "cpu": "0.25"
    }
  }')

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Test app deployed${NC}"
else
    echo -e "${RED}✗ Failed to deploy test app${NC}"
    exit 1
fi

echo ""
echo "=== Testing Methods ==="
echo ""
echo -e "${YELLOW}Method 1: Using .localhost domain (works in most browsers)${NC}"
echo "Open in browser: http://testapp.localhost:9006"
echo ""

echo -e "${YELLOW}Method 2: Using curl with Host header${NC}"
echo "Command: curl -H \"Host: testapp.localhost\" http://localhost:9006"
echo "Testing..."
curl -s -H "Host: testapp.localhost" http://localhost:9006 | head -n 5
echo ""

echo -e "${YELLOW}Method 3: Add to /etc/hosts${NC}"
echo "Add this line to /etc/hosts:"
echo "127.0.0.1   testapp.localhost"
echo "Then access: http://testapp.local:9006"
echo ""

echo "=== Checking Route Configuration ==="
echo ""
curl -s http://localhost:9004/_admin/routes/testapp.localhost/details | jq '.'

echo ""
echo "=== Available Commands ==="
echo ""
echo "View all routes:"
echo "  curl http://localhost:9004/_admin/routes | jq '.'"
echo ""
echo "Check route health:"
echo "  curl http://localhost:9004/_admin/routes/testapp.localhost/health | jq '.'"
echo ""
echo "View route logs:"
echo "  curl http://localhost:9004/_admin/routes/testapp.localhost/logs"
echo ""
echo "Delete test route:"
echo "  curl -X DELETE -H \"X-Admin-Token: test-token\" http://localhost:9004/_admin/routes/testapp.localhost"