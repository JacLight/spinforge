#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# Quick deployment test for SpinForge
# Deploys a few static sites quickly for testing

# Configuration
SPINHUB_URL="${SPINHUB_URL:-http://localhost:8080}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
NUM_SITES="${NUM_SITES:-10}"  # Default to 10 sites for quick test

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${RED}❌ Please set ADMIN_TOKEN${NC}"
    echo "First, get your admin token by logging in:"
    echo "  1. Open http://localhost:3030 in your browser"
    echo "  2. Login with your admin credentials"
    echo "  3. Open browser DevTools (F12)"
    echo "  4. Go to Application > Local Storage > localhost:3030"
    echo "  5. Copy the value of 'adminToken'"
    echo ""
    echo "Then run:"
    echo "  ADMIN_TOKEN=your-token-here ./quick-deploy-test.sh"
    exit 1
fi

echo -e "${BLUE}🚀 Quick Deploy Test - Creating $NUM_SITES static sites${NC}"

# Create a simple deployment function
deploy_static_site() {
    local num=$1
    local temp_dir=$(mktemp -d)
    
    # Create simple HTML site
    cat > "$temp_dir/index.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Test Site $num</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            color: white;
        }
        .content {
            text-align: center;
            padding: 2rem;
            background: rgba(0,0,0,0.3);
            border-radius: 10px;
        }
        h1 { font-size: 4rem; margin: 0; }
        p { font-size: 1.5rem; }
    </style>
</head>
<body>
    <div class="content">
        <h1>Site #$num</h1>
        <p>Test deployment $(date)</p>
        <p>🚀 SpinForge Test</p>
    </div>
</body>
</html>
EOF

    # Create deploy.json
    cat > "$temp_dir/deploy.json" << EOF
{
  "name": "quick-test-$num",
  "framework": "static",
  "customerId": "test-customer",
  "domain": "test-$num.localhost"
}
EOF

    # Create tar.gz
    cd "$temp_dir"
    tar -czf site.tar.gz *
    
    # Deploy
    echo -n "Deploying site #$num (test-$num.localhost)... "
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -F "file=@site.tar.gz" \
        "$SPINHUB_URL/_admin/deploy" 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo -e "${GREEN}✅ Success${NC}"
        DEPLOYED_SITES+=("http://test-$num.localhost")
    else
        echo -e "${RED}❌ Failed (HTTP $http_code)${NC}"
    fi
    
    # Cleanup
    cd - > /dev/null
    rm -rf "$temp_dir"
}

# Deploy sites
DEPLOYED_SITES=()
START_TIME=$(date +%s)

for i in $(seq 1 $NUM_SITES); do
    deploy_static_site $i
    # Small delay to avoid overwhelming the system
    sleep 0.5
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Summary
echo ""
echo "=================================="
echo -e "${BLUE}📊 Deployment Summary${NC}"
echo "=================================="
echo -e "Sites deployed: ${#DEPLOYED_SITES[@]}/$NUM_SITES"
echo -e "Duration: ${DURATION}s"
echo ""
echo -e "${GREEN}🌐 Access your sites:${NC}"
for site in "${DEPLOYED_SITES[@]}"; do
    echo "   $site"
done

echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo "- View all sites: http://localhost:3030/applications"
echo "- Check hosting status: http://localhost:3030/hosting"
echo "- Monitor resources: http://localhost:3030/admin"
echo ""
echo -e "${GREEN}✨ Test complete!${NC}"