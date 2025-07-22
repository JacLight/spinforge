#!/bin/bash

# Test ZIP deployment for all frameworks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$TEST_DIR/results/zip-deployment-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$RESULTS_DIR"

echo "🚀 Testing ZIP Deployment Method"
echo "================================"

# Function to create ZIP for pre-built app
create_zip() {
    local framework=$1
    local app_dir=$2
    local output_zip=$3
    
    echo "📦 Creating ZIP for $framework..."
    
    # Build the app first
    cd "$app_dir"
    
    case $framework in
        react)
            npm install
            npm run build
            cd build
            zip -r "$output_zip" .
            ;;
        nextjs)
            npm install
            npm run build
            # For Next.js, we need to include .next and other files
            zip -r "$output_zip" .next package.json next.config.js public
            ;;
        node)
            npm install --production
            zip -r "$output_zip" . -x "*.git*" "node_modules/.cache/*"
            ;;
        deno)
            # Deno doesn't need build, just zip source
            zip -r "$output_zip" .
            ;;
        *)
            echo "Unknown framework: $framework"
            return 1
            ;;
    esac
    
    echo "✅ ZIP created: $output_zip"
}

# Function to deploy ZIP to SpinForge
deploy_zip() {
    local zip_file=$1
    local app_name=$2
    local domain=$3
    
    echo "🚀 Deploying $app_name to SpinForge..."
    
    # Copy to deployments folder
    DEPLOY_DIR="/Users/imzee/projects/spinforge/deployments/$app_name"
    mkdir -p "$DEPLOY_DIR"
    
    # Extract ZIP
    unzip -o "$zip_file" -d "$DEPLOY_DIR"
    
    # Create deploy.json
    cat > "$DEPLOY_DIR/deploy.json" <<EOF
{
    "name": "$app_name",
    "domain": "$domain",
    "framework": "static",
    "buildCommand": "",
    "startCommand": "./start.sh"
}
EOF
    
    echo "✅ Deployed to $DEPLOY_DIR"
}

# Function to test deployment
test_deployment() {
    local domain=$1
    local result_file=$2
    
    echo "🧪 Testing deployment at $domain..."
    
    # Wait for deployment to be ready
    sleep 5
    
    # Test the deployment
    response=$(curl -s -w "\n%{http_code}" "http://$domain" -H "Host: $domain" http://localhost:9004/)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    echo "HTTP Code: $http_code" > "$result_file"
    echo "Response Body:" >> "$result_file"
    echo "$body" >> "$result_file"
    
    if [ "$http_code" = "200" ]; then
        echo "✅ Deployment test passed"
        return 0
    else
        echo "❌ Deployment test failed (HTTP $http_code)"
        return 1
    fi
}

# Test each framework
frameworks=("react" "nextjs" "node" "deno")

for framework in "${frameworks[@]}"; do
    echo ""
    echo "Testing $framework..."
    echo "-------------------"
    
    APP_DIR="$TEST_DIR/frameworks/$framework"
    ZIP_FILE="$RESULTS_DIR/${framework}-app.zip"
    APP_NAME="test-${framework}-zip"
    DOMAIN="${APP_NAME}.local"
    
    # Create ZIP
    if create_zip "$framework" "$APP_DIR" "$ZIP_FILE"; then
        # Deploy ZIP
        if deploy_zip "$ZIP_FILE" "$APP_NAME" "$DOMAIN"; then
            # Test deployment
            test_deployment "$DOMAIN" "$RESULTS_DIR/${framework}-test-result.txt"
        fi
    fi
done

echo ""
echo "📊 Test Results Summary"
echo "======================"
echo "Results saved to: $RESULTS_DIR"
ls -la "$RESULTS_DIR"