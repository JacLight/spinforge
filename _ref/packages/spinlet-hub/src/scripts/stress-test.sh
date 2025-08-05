#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# Stress test deployment script for SpinForge
# Deploys multiple static sites for load testing

# Configuration
SPINHUB_URL="${SPINHUB_URL:-http://localhost:8080}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
NUM_SITES="${NUM_SITES:-100}"
BATCH_SIZE="${BATCH_SIZE:-10}"
CUSTOMER_ID="stress-test"
TEMP_DIR="/tmp/spinforge-stress-test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check requirements
if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${RED}❌ ADMIN_TOKEN environment variable is required${NC}"
    echo "Usage: ADMIN_TOKEN=your-token ./stress-test.sh"
    exit 1
fi

# Create temp directory
mkdir -p "$TEMP_DIR"
echo -e "${BLUE}🚀 Starting stress test deployment of ${NUM_SITES} static sites${NC}"
echo -e "${BLUE}📍 SpinHub URL: ${SPINHUB_URL}${NC}"
echo -e "${BLUE}👥 Customer ID: ${CUSTOMER_ID}${NC}"
echo -e "${BLUE}📦 Batch Size: ${BATCH_SIZE}${NC}"
echo ""

# Statistics
SUCCESSFUL=0
FAILED=0
START_TIME=$(date +%s)

# Function to create a static site
create_static_site() {
    local site_num=$1
    local site_dir="$TEMP_DIR/site-$site_num"
    
    mkdir -p "$site_dir"
    
    # Create index.html
    cat > "$site_dir/index.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Site $site_num</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        }
        h1 {
            font-size: 3rem;
            margin: 0 0 1rem 0;
        }
        .site-number {
            font-size: 5rem;
            font-weight: bold;
            margin: 1rem 0;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
        }
        .info {
            margin: 2rem 0;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 0.5rem;
        }
        .timestamp {
            font-size: 0.875rem;
            opacity: 0.8;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        .site-number {
            animation: pulse 2s infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Stress Test Site</h1>
        <div class="site-number">#$site_num</div>
        <div class="info">
            <p><strong>Domain:</strong> test-site-$site_num.localhost</p>
            <p><strong>Customer:</strong> $CUSTOMER_ID</p>
            <p><strong>Framework:</strong> Static HTML</p>
        </div>
        <div class="timestamp">Deployed at $(date -u +"%Y-%m-%dT%H:%M:%SZ")</div>
    </div>
</body>
</html>
EOF

    # Create style.css
    cat > "$site_dir/style.css" << EOF
/* Additional styles for test site $site_num */
body {
    margin: 0;
    padding: 0;
}
EOF

    # Create robots.txt
    cat > "$site_dir/robots.txt" << EOF
User-agent: *
Allow: /
Sitemap: http://test-site-$site_num.localhost/sitemap.xml
EOF

    # Create simple 404 page
    cat > "$site_dir/404.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>404 - Not Found</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; }
        h1 { color: #666; }
    </style>
</head>
<body>
    <h1>404 - Page Not Found</h1>
    <p>Test Site #$site_num</p>
    <a href="/">Go Home</a>
</body>
</html>
EOF

    # Create deploy.json
    cat > "$site_dir/deploy.json" << EOF
{
  "name": "test-site-$site_num",
  "framework": "static",
  "customerId": "$CUSTOMER_ID",
  "domain": "test-site-$site_num.localhost",
  "env": {
    "SITE_NUMBER": "$site_num",
    "DEPLOYED_AT": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  }
}
EOF

    # Create tar.gz
    cd "$site_dir"
    tar -czf "$TEMP_DIR/site-$site_num.tar.gz" .
    cd - > /dev/null
    
    echo "$TEMP_DIR/site-$site_num.tar.gz"
}

# Function to deploy a site
deploy_site() {
    local site_num=$1
    local tar_file="$TEMP_DIR/site-$site_num.tar.gz"
    
    # Deploy using curl
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -F "file=@$tar_file" \
        -F "config={\"name\":\"test-site-$site_num\",\"framework\":\"static\",\"customerId\":\"$CUSTOMER_ID\",\"domain\":\"test-site-$site_num.localhost\"}" \
        "$SPINHUB_URL/_admin/deploy" 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo -e "${GREEN}✅ Site $site_num deployed successfully${NC}"
        ((SUCCESSFUL++))
    else
        echo -e "${RED}❌ Site $site_num failed (HTTP $http_code): $body${NC}"
        ((FAILED++))
    fi
}

# Deploy in batches
TOTAL_BATCHES=$(( (NUM_SITES + BATCH_SIZE - 1) / BATCH_SIZE ))

for (( batch=0; batch<TOTAL_BATCHES; batch++ )); do
    START_IDX=$(( batch * BATCH_SIZE + 1 ))
    END_IDX=$(( START_IDX + BATCH_SIZE - 1 ))
    if [ $END_IDX -gt $NUM_SITES ]; then
        END_IDX=$NUM_SITES
    fi
    
    echo -e "\n${YELLOW}📦 Deploying batch $((batch + 1))/$TOTAL_BATCHES (sites $START_IDX-$END_IDX)${NC}"
    
    # Create sites for this batch
    echo "Creating deployment packages..."
    for (( i=START_IDX; i<=END_IDX; i++ )); do
        create_static_site $i > /dev/null
    done
    
    # Deploy sites in parallel (with controlled concurrency)
    for (( i=START_IDX; i<=END_IDX; i++ )); do
        deploy_site $i &
        
        # Limit parallel deployments
        if [ $(( i % 5 )) -eq 0 ]; then
            wait
        fi
    done
    wait
    
    # Small delay between batches
    if [ $batch -lt $((TOTAL_BATCHES - 1)) ]; then
        echo -e "${BLUE}⏸️  Waiting 2s before next batch...${NC}"
        sleep 2
    fi
done

# Calculate statistics
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
AVG_TIME=$(( (DURATION * 1000) / NUM_SITES ))
RATE=$(awk "BEGIN {printf \"%.2f\", $NUM_SITES / $DURATION}")

# Print final report
echo ""
echo "=================================================="
echo -e "${BLUE}📊 STRESS TEST COMPLETE${NC}"
echo "=================================================="
echo -e "${GREEN}✅ Successful deployments: $SUCCESSFUL${NC}"
echo -e "${RED}❌ Failed deployments: $FAILED${NC}"
echo -e "${YELLOW}⏱️  Total duration: ${DURATION}s${NC}"
echo -e "${YELLOW}📈 Average deployment time: ${AVG_TIME}ms per site${NC}"
echo -e "${YELLOW}🚀 Deployment rate: $RATE sites/second${NC}"

# List URLs
echo ""
echo -e "${BLUE}🌐 Deployed sites:${NC}"
for (( i=1; i<=SUCCESSFUL && i<=10; i++ )); do
    echo "   http://test-site-$i.localhost"
done
if [ $SUCCESSFUL -gt 10 ]; then
    echo "   ... and $((SUCCESSFUL - 10)) more"
fi

# Cleanup
echo ""
echo -e "${BLUE}🧹 Cleaning up temporary files...${NC}"
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✨ Done!${NC}"