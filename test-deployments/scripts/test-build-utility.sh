#!/bin/bash

# Test build utility deployment for all frameworks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_UTIL_DIR="/Users/imzee/projects/spinforge/packages/build-utility"
RESULTS_DIR="$TEST_DIR/results/build-utility-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$RESULTS_DIR"

echo "🚀 Testing Build Utility Deployment Method"
echo "========================================"

# First, build the build utility if needed
if [ ! -f "$BUILD_UTIL_DIR/dist/cli.js" ]; then
    echo "Building build utility..."
    cd "$BUILD_UTIL_DIR"
    npm install
    npm run build
fi

# Function to build app using build utility
build_with_utility() {
    local framework=$1
    local source_dir=$2
    local output_dir=$3
    
    echo "🔨 Building $framework app with build utility..."
    
    cd "$BUILD_UTIL_DIR"
    node dist/cli.js build "$source_dir" \
        --output "$output_dir" \
        --framework "$framework" \
        --verbose > "$RESULTS_DIR/${framework}-build.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Build completed successfully"
        return 0
    else
        echo "❌ Build failed"
        cat "$RESULTS_DIR/${framework}-build.log"
        return 1
    fi
}

# Function to deploy built app
deploy_built_app() {
    local built_dir=$1
    local app_name=$2
    local domain=$3
    local framework=$4
    
    echo "🚀 Deploying built app: $app_name"
    
    DEPLOY_DIR="/Users/imzee/projects/spinforge/deployments/$app_name"
    mkdir -p "$DEPLOY_DIR"
    
    # Copy built files
    cp -r "$built_dir"/* "$DEPLOY_DIR/"
    
    # Ensure deploy.json exists
    if [ ! -f "$DEPLOY_DIR/deploy.json" ]; then
        cat > "$DEPLOY_DIR/deploy.json" <<EOF
{
    "name": "$app_name",
    "domain": "$domain",
    "framework": "$framework",
    "builtWith": "spinforge-build-utility",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    fi
    
    echo "✅ Deployed to $DEPLOY_DIR"
}

# Function to test deployment health
test_health() {
    local domain=$1
    local result_file=$2
    
    echo "🧪 Testing deployment health..."
    
    # Test via curl
    response=$(curl -s -w "\n%{http_code}" \
        -H "Host: $domain" \
        http://localhost:9004/health 2>/dev/null || echo "Connection failed")
    
    echo "$response" > "$result_file"
    
    if [[ "$response" == *"200"* ]] || [[ "$response" == *"healthy"* ]]; then
        echo "✅ Health check passed"
        return 0
    else
        echo "❌ Health check failed"
        return 1
    fi
}

# Test each framework
frameworks=("react" "nextjs" "node" "deno")

echo "Framework | Build Status | Deploy Status | Health Check" > "$RESULTS_DIR/summary.txt"
echo "---------|--------------|---------------|-------------" >> "$RESULTS_DIR/summary.txt"

for framework in "${frameworks[@]}"; do
    echo ""
    echo "Testing $framework..."
    echo "-------------------"
    
    APP_DIR="$TEST_DIR/frameworks/$framework"
    BUILD_OUTPUT="$RESULTS_DIR/${framework}-build"
    APP_NAME="test-${framework}-utility"
    DOMAIN="${APP_NAME}.local"
    
    build_status="❌"
    deploy_status="❌"
    health_status="❌"
    
    # Build with utility
    if build_with_utility "$framework" "$APP_DIR" "$BUILD_OUTPUT"; then
        build_status="✅"
        
        # Deploy built app
        if deploy_built_app "$BUILD_OUTPUT" "$APP_NAME" "$DOMAIN" "$framework"; then
            deploy_status="✅"
            
            # Test health
            if test_health "$DOMAIN" "$RESULTS_DIR/${framework}-health.txt"; then
                health_status="✅"
            fi
        fi
    fi
    
    echo "$framework | $build_status | $deploy_status | $health_status" >> "$RESULTS_DIR/summary.txt"
done

echo ""
echo "📊 Build Utility Test Summary"
echo "============================"
cat "$RESULTS_DIR/summary.txt"
echo ""
echo "Detailed results saved to: $RESULTS_DIR"