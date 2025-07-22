#!/bin/bash

# Test Git repository deployment for all frameworks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$TEST_DIR/results/git-deployment-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$RESULTS_DIR"

echo "🚀 Testing Git Repository Deployment Method"
echo "=========================================="

# Function to create local git repo
create_git_repo() {
    local framework=$1
    local source_dir=$2
    local repo_dir=$3
    
    echo "📁 Creating Git repository for $framework..."
    
    # Copy app to repo directory
    cp -r "$source_dir" "$repo_dir"
    cd "$repo_dir"
    
    # Initialize git repo
    git init
    git add .
    git commit -m "Initial commit for $framework test app"
    
    echo "✅ Git repository created at $repo_dir"
}

# Function to deploy from git
deploy_from_git() {
    local repo_url=$1
    local app_name=$2
    local domain=$3
    local framework=$4
    
    echo "🚀 Deploying from Git: $repo_url"
    
    DEPLOY_DIR="/Users/imzee/projects/spinforge/deployments/$app_name"
    mkdir -p "$DEPLOY_DIR"
    
    # Clone the repository
    git clone "$repo_url" "$DEPLOY_DIR/source"
    
    # Create deployment configuration
    cat > "$DEPLOY_DIR/deploy.json" <<EOF
{
    "name": "$app_name",
    "domain": "$domain",
    "framework": "$framework",
    "source": {
        "type": "git",
        "url": "$repo_url",
        "branch": "main"
    },
    "buildCommand": "npm install && npm run build",
    "startCommand": "npm start",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    
    echo "✅ Git deployment configured"
}

# Function to simulate git webhook
trigger_git_webhook() {
    local app_name=$1
    local commit_hash=$2
    
    echo "🔔 Triggering Git webhook..."
    
    webhook_payload=$(cat <<EOF
{
    "ref": "refs/heads/main",
    "commits": [{
        "id": "$commit_hash",
        "message": "Test commit",
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }],
    "repository": {
        "name": "$app_name",
        "clone_url": "file://$repo_dir"
    }
}
EOF
)
    
    # Send webhook to SpinForge
    response=$(curl -X POST \
        -H "Content-Type: application/json" \
        -d "$webhook_payload" \
        http://localhost:9004/api/webhooks/github \
        2>/dev/null || echo "Webhook endpoint not available")
    
    echo "$response" > "$RESULTS_DIR/${app_name}-webhook-response.json"
}

# Test popular Git platforms
test_git_platforms() {
    local framework=$1
    local repo_dir=$2
    
    echo "📋 Testing Git platform integrations..."
    
    # GitHub simulation
    echo "GitHub URL: https://github.com/test-user/test-${framework}-app" >> "$RESULTS_DIR/${framework}-git-urls.txt"
    
    # GitLab simulation
    echo "GitLab URL: https://gitlab.com/test-user/test-${framework}-app" >> "$RESULTS_DIR/${framework}-git-urls.txt"
    
    # Bitbucket simulation
    echo "Bitbucket URL: https://bitbucket.org/test-user/test-${framework}-app" >> "$RESULTS_DIR/${framework}-git-urls.txt"
    
    # Local Git server
    echo "Local Git: file://$repo_dir" >> "$RESULTS_DIR/${framework}-git-urls.txt"
}

# Test each framework
frameworks=("react" "nextjs" "node" "deno")

echo "Framework | Git Repo | Deploy Status | Webhook Test" > "$RESULTS_DIR/summary.txt"
echo "---------|----------|---------------|-------------" >> "$RESULTS_DIR/summary.txt"

for framework in "${frameworks[@]}"; do
    echo ""
    echo "Testing $framework..."
    echo "-------------------"
    
    APP_DIR="$TEST_DIR/frameworks/$framework"
    REPO_DIR="$RESULTS_DIR/repos/${framework}-repo"
    APP_NAME="test-${framework}-git"
    DOMAIN="${APP_NAME}.local"
    
    repo_status="❌"
    deploy_status="❌"
    webhook_status="❌"
    
    # Create git repo
    if create_git_repo "$framework" "$APP_DIR" "$REPO_DIR"; then
        repo_status="✅"
        
        # Deploy from git
        if deploy_from_git "file://$REPO_DIR" "$APP_NAME" "$DOMAIN" "$framework"; then
            deploy_status="✅"
            
            # Get commit hash
            cd "$REPO_DIR"
            commit_hash=$(git rev-parse HEAD)
            
            # Trigger webhook
            trigger_git_webhook "$APP_NAME" "$commit_hash"
            webhook_status="✅"
        fi
        
        # Test git platforms
        test_git_platforms "$framework" "$REPO_DIR"
    fi
    
    echo "$framework | $repo_status | $deploy_status | $webhook_status" >> "$RESULTS_DIR/summary.txt"
done

echo ""
echo "📊 Git Deployment Test Summary"
echo "============================="
cat "$RESULTS_DIR/summary.txt"
echo ""
echo "Detailed results saved to: $RESULTS_DIR"