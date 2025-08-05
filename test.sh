#!/bin/bash
# SpinForge System Test Script

set -e

echo "🔍 SpinForge System Test"
echo "========================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=$3
    
    echo -n "Testing $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_code, got $response)"
        return 1
    fi
}

# Check if services are running
echo "📦 Checking Docker containers..."
if ! docker compose ps | grep -q "Up"; then
    echo -e "${RED}No containers are running!${NC}"
    echo "Run ./setup.sh or ./start.sh first"
    exit 1
fi

echo ""
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🌐 Testing endpoints..."
echo ""

# Track failures
failed=0

# Test API (the root returns 404, which is expected)
# Skip API root test as it doesn't have a handler
test_endpoint "API Sites List" "http://localhost:8080/api/sites" "200" || ((failed++))

# Test Admin UI
test_endpoint "Admin UI" "http://localhost:8083" "200" || ((failed++))

# Test Website
test_endpoint "Website" "http://localhost:3001" "200" || ((failed++))

# Test OpenResty (should return 200 with our landing page)
test_endpoint "OpenResty Default" "http://localhost" "200" || ((failed++))

# Test metrics endpoint
test_endpoint "Metrics API" "http://localhost:8080/_metrics/global" "200" || ((failed++))

# Test OpenResty health
test_endpoint "OpenResty Health" "http://localhost:8082/health" "200" || ((failed++))

echo ""
echo "🔍 Testing error pages..."
echo ""

# Test if 404 page exists
if curl -s http://localhost/nonexistent-page-test-404 | grep -q "Deploy with.*Zero Configuration"; then
    echo -e "${GREEN}✓ Custom 404 page is working${NC}"
else
    echo -e "${YELLOW}⚠ Custom 404 page may not be configured${NC}"
fi

echo ""
echo "📊 System Status Summary"
echo "========================"

# KeyDB connectivity test
echo -n "KeyDB connectivity: "
if docker compose exec -T keydb keydb-cli -p 16378 ping 2>/dev/null | grep -q PONG; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
    ((failed++))
fi

# Check logs for errors
echo -n "Recent errors: "
error_count=$(docker compose logs --tail=100 2>&1 | grep -iE "error|failed|exception" | grep -v "error_page" | wc -l)
if [ "$error_count" -eq 0 ]; then
    echo -e "${GREEN}✓ None found${NC}"
else
    echo -e "${YELLOW}⚠ Found $error_count error(s) in logs${NC}"
    echo "  Run: docker compose logs -f"
fi

echo ""
if [ "$failed" -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "SpinForge is working correctly."
    echo ""
    echo "Next steps:"
    echo "  1. Access Admin UI at http://localhost:8083"
    echo "  2. Default login: admin / admin123"
    echo "  3. Create your first site via the UI"
else
    echo -e "${RED}❌ $failed test(s) failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  - Check logs: docker compose logs -f"
    echo "  - Restart services: ./manage.sh restart"
    echo "  - Rebuild if needed: ./manage.sh rebuild"
    exit 1
fi