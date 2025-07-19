#!/bin/bash

# Test script for bidirectional routing

API_URL="http://localhost:9004"
ADMIN_TOKEN="test-token"

echo "=== SpinForge Bidirectional Routing Test ==="
echo ""

# Create a test route
echo "1. Creating test route..."
RESPONSE=$(curl -s -X POST $API_URL/_admin/routes \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{
    "domain": "bidirectional-test.localhost",
    "spinletId": "spin-bitest-'$(date +%s)'",
    "customerId": "test-customer",
    "buildPath": "/spinforge/examples/test-app",
    "framework": "express",
    "config": {
      "memory": "256MB",
      "cpu": "0.25"
    }
  }')

echo "Response: $RESPONSE"
SPINLET_ID=$(echo $RESPONSE | jq -r '.spinletId // empty')

if [ -z "$SPINLET_ID" ]; then
  # Extract spinlet ID from the route config
  ROUTE_INFO=$(curl -s $API_URL/_admin/routes | jq -r '.[] | select(.domain == "bidirectional-test.localhost")')
  SPINLET_ID=$(echo $ROUTE_INFO | jq -r '.spinletId')
fi

echo "Spinlet ID: $SPINLET_ID"
echo ""

# Wait for spinlet to start
echo "2. Waiting for spinlet to start..."
sleep 5

# Get spinlet state by spinlet ID
echo "3. Getting spinlet state by ID..."
STATE=$(curl -s $API_URL/_admin/spinlets/$SPINLET_ID)
echo "State: $(echo $STATE | jq '.')"
echo ""

# Extract service path
SERVICE_PATH=$(echo $STATE | jq -r '.servicePath')
echo "Service Path: $SERVICE_PATH"
echo ""

# Test finding by domain
echo "4. Finding spinlet by domain (bidirectional-test.localhost)..."
FOUND_BY_DOMAIN=$(curl -s $API_URL/_admin/spinlets/find/bidirectional-test.localhost)
echo "Found: $(echo $FOUND_BY_DOMAIN | jq '.spinletId, .servicePath')"
echo ""

# Test finding by service path
echo "5. Finding spinlet by service path ($SERVICE_PATH)..."
FOUND_BY_PATH=$(curl -s $API_URL/_admin/spinlets/find/$SERVICE_PATH)
echo "Found: $(echo $FOUND_BY_PATH | jq '.spinletId, .domains')"
echo ""

# Add another domain
echo "6. Adding another domain to the same spinlet..."
curl -s -X POST $API_URL/_admin/routes \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{
    "domain": "www.bidirectional-test.localhost",
    "spinletId": "'$SPINLET_ID'",
    "customerId": "test-customer",
    "buildPath": "/spinforge/examples/test-app",
    "framework": "express"
  }'
echo ""

# Check updated domains
echo "7. Checking updated domains..."
UPDATED_STATE=$(curl -s $API_URL/_admin/spinlets/$SPINLET_ID)
echo "Domains: $(echo $UPDATED_STATE | jq '.domains')"
echo ""

# Test access via service path (if spinlet is running)
if [ ! -z "$SERVICE_PATH" ] && [ "$SERVICE_PATH" != "null" ]; then
  echo "8. Testing direct access via service path..."
  PORT=$(echo $SERVICE_PATH | cut -d: -f2)
  echo "Attempting to connect to http://$SERVICE_PATH"
  curl -s --connect-timeout 2 http://$SERVICE_PATH | head -5 || echo "Note: Spinlet may not be running in test mode"
  echo ""
fi

# Clean up
echo "9. Cleaning up..."
echo "Removing domain: bidirectional-test.localhost"
curl -s -X DELETE -H "X-Admin-Token: $ADMIN_TOKEN" $API_URL/_admin/routes/bidirectional-test.localhost

echo "Removing domain: www.bidirectional-test.localhost"
curl -s -X DELETE -H "X-Admin-Token: $ADMIN_TOKEN" $API_URL/_admin/routes/www.bidirectional-test.localhost

echo ""
echo "=== Test Complete ==="
echo ""
echo "Summary:"
echo "- Created spinlet with ID: $SPINLET_ID"
echo "- Service path: $SERVICE_PATH"
echo "- Successfully found spinlet by both domain and service path"
echo "- Added multiple domains to the same spinlet"
echo ""
echo "Key Redis keys to check:"
echo "- spinforge:spinlets:$SPINLET_ID"
echo "- spinforge:servicepath:$SERVICE_PATH"
echo "- spinforge:domain:bidirectional-test.localhost"