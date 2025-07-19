#!/bin/bash

echo "=== Testing SpinForge Route: test.example.com ==="
echo ""

# Method 1: Using curl with Host header
echo "Method 1: Using curl with Host header"
echo "Command: curl -H 'Host: test.example.com' http://localhost:9006"
curl -H "Host: test.example.com" http://localhost:9006
echo -e "\n"

# Method 2: Add to /etc/hosts
echo "Method 2: Add to /etc/hosts"
echo "Add this line to /etc/hosts:"
echo "127.0.0.1   test.example.com"
echo "Then access: http://test.example.com:9006"
echo ""

# Method 3: Deploy with .localhost domain
echo "Method 3: Use .localhost domain (works in browsers automatically)"
echo "Let's create a new route with .localhost:"
curl -X POST http://localhost:9004/_admin/routes \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: test-token" \
  -d '{
    "domain": "test.localhost",
    "customerId": "cust-1",
    "spinletId": "spin-test-local",
    "buildPath": "/test",
    "framework": "express"
  }'

echo -e "\n\nNow you can access: http://test.localhost:9006"
echo ""

# Show all routes
echo "=== All configured routes ==="
curl -s http://localhost:9004/_admin/routes | jq '.'