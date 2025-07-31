#!/bin/bash

# Test API endpoints for deployed applications

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(dirname "$SCRIPT_DIR")"

echo "🧪 Testing API Endpoints"
echo "======================="

# Function to test endpoint
test_endpoint() {
    local app_name=$1
    local domain=$2
    local endpoint=$3
    local expected_status=${4:-200}
    
    echo -n "Testing $domain$endpoint... "
    
    response=$(curl -s -w "\n%{http_code}" \
        -H "Host: $domain" \
        "http://localhost:9004$endpoint" 2>/dev/null || echo "Failed")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo "✅ OK ($http_code)"
        return 0
    else
        echo "❌ Failed (Expected $expected_status, got $http_code)"
        echo "Response: $body"
        return 1
    fi
}

# Function to test all endpoints for an app
test_app_endpoints() {
    local app_name=$1
    local domain=$2
    local framework=$3
    
    echo ""
    echo "Testing $framework app: $domain"
    echo "--------------------------------"
    
    # Common endpoints
    test_endpoint "$app_name" "$domain" "/" 200
    test_endpoint "$app_name" "$domain" "/health" 200
    
    # Framework-specific endpoints
    case $framework in
        nextjs|node|nestjs|deno)
            test_endpoint "$app_name" "$domain" "/api/test" 200
            test_endpoint "$app_name" "$domain" "/api/info" 200
            test_endpoint "$app_name" "$domain" "/api/echo?message=test" 200
            ;;
        react|static|flutter)
            # These don't have backend APIs by default
            echo "Skipping API tests for $framework (static hosting)"
            ;;
    esac
    
    # Test 404
    test_endpoint "$app_name" "$domain" "/nonexistent" 404
}

# If specific app is provided as argument
if [ $# -gt 0 ]; then
    APP_NAME=$1
    DOMAIN="${APP_NAME}.localhost"
    FRAMEWORK=${2:-unknown}
    
    test_app_endpoints "$APP_NAME" "$DOMAIN" "$FRAMEWORK"
else
    # Test all deployed apps
    echo "Testing all deployed applications..."
    
    # Add your deployed apps here
    test_app_endpoints "test-nextjs" "test-nextjs.localhost" "nextjs"
    test_app_endpoints "test-node" "test-node.localhost" "node"
    test_app_endpoints "test-deno" "test-deno.localhost" "deno"
    test_app_endpoints "test-react" "test-react.localhost" "react"
    test_app_endpoints "test-static" "test-static.localhost" "static"
fi

echo ""
echo "✅ Endpoint testing complete"