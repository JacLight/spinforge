#!/bin/bash

# Test a specific framework across all deployment methods

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(dirname "$SCRIPT_DIR")"

if [ $# -eq 0 ]; then
    echo "Usage: $0 <framework>"
    echo "Available frameworks: react, nextjs, remix, nestjs, node, deno, flutter"
    exit 1
fi

FRAMEWORK=$1
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_DIR="$TEST_DIR/results/framework-test-${FRAMEWORK}-$TIMESTAMP"

mkdir -p "$RESULTS_DIR"

echo "🚀 Testing $FRAMEWORK across all deployment methods"
echo "================================================="

# Validate framework
case $FRAMEWORK in
    react|nextjs|remix|nestjs|node|deno|flutter)
        echo "Framework: $FRAMEWORK"
        ;;
    *)
        echo "❌ Unknown framework: $FRAMEWORK"
        exit 1
        ;;
esac

# Function to test deployment method
test_deployment_method() {
    local method=$1
    local framework=$2
    local app_dir="$TEST_DIR/frameworks/$framework"
    
    echo ""
    echo "Testing $method deployment..."
    echo "----------------------------"
    
    case $method in
        zip)
            # Create and deploy ZIP
            cd "$app_dir"
            if [ "$framework" = "react" ] || [ "$framework" = "nextjs" ]; then
                npm install && npm run build
            fi
            
            zip -r "$RESULTS_DIR/${framework}.zip" .
            echo "✅ ZIP created: $RESULTS_DIR/${framework}.zip"
            ;;
            
        api)
            # Test API compilation
            tar -czf "$RESULTS_DIR/${framework}-source.tar.gz" -C "$app_dir" .
            echo "✅ Source tarball created for API compilation"
            ;;
            
        utility)
            # Test build utility
            if [ -f "/Users/imzee/projects/spinforge/packages/build-utility/dist/cli.js" ]; then
                node /Users/imzee/projects/spinforge/packages/build-utility/dist/cli.js build \
                    "$app_dir" \
                    --output "$RESULTS_DIR/${framework}-built" \
                    --framework "$framework"
                echo "✅ Built with utility"
            else
                echo "❌ Build utility not found"
            fi
            ;;
            
        git)
            # Test git deployment
            REPO_DIR="$RESULTS_DIR/${framework}-git-repo"
            cp -r "$app_dir" "$REPO_DIR"
            cd "$REPO_DIR"
            git init
            git add .
            git commit -m "Test commit"
            echo "✅ Git repository created"
            ;;
    esac
}

# Test all deployment methods
methods=("zip" "api" "utility" "git")

echo "Method | Status | Output" > "$RESULTS_DIR/test-results.txt"
echo "-------|--------|--------" >> "$RESULTS_DIR/test-results.txt"

for method in "${methods[@]}"; do
    if test_deployment_method "$method" "$FRAMEWORK"; then
        echo "$method | ✅ | See $RESULTS_DIR" >> "$RESULTS_DIR/test-results.txt"
    else
        echo "$method | ❌ | Failed" >> "$RESULTS_DIR/test-results.txt"
    fi
done

# Create deployment test manifest
cat > "$RESULTS_DIR/deployment-manifest.json" <<EOF
{
    "framework": "$FRAMEWORK",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "deployments": [
        {
            "method": "zip",
            "file": "${framework}.zip",
            "ready": true
        },
        {
            "method": "api",
            "file": "${framework}-source.tar.gz",
            "ready": true
        },
        {
            "method": "utility",
            "directory": "${framework}-built",
            "ready": true
        },
        {
            "method": "git",
            "directory": "${framework}-git-repo",
            "ready": true
        }
    ]
}
EOF

echo ""
echo "📊 Test Results for $FRAMEWORK"
echo "============================"
cat "$RESULTS_DIR/test-results.txt"
echo ""
echo "📁 Test artifacts saved to: $RESULTS_DIR"
echo "📄 Deployment manifest: $RESULTS_DIR/deployment-manifest.json"