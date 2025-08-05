#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# Simple Next.js deployment test

set -e

echo "🚀 Simple Next.js Deployment Test"
echo "================================="
echo ""

# Configuration
APP_NAME="nextjs-simple-$(date +%s)"
DEPLOY_DIR="/Users/imzee/projects/spinforge/deployments/$APP_NAME"

# Create deployment directory
echo "📦 Creating Next.js deployment: $APP_NAME"
mkdir -p "$DEPLOY_DIR"

# Create a minimal Next.js app directly in deployment folder
cd "$DEPLOY_DIR"

# Create package.json
cat > package.json <<'EOF'
{
  "name": "nextjs-simple",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p $PORT"
  },
  "dependencies": {
    "next": "14.0.4",
    "react": "^18",
    "react-dom": "^18"
  }
}
EOF

# Create pages directory (using pages router for simplicity)
mkdir -p pages/api

# Create index page
cat > pages/index.js <<'EOF'
export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#0070f3' }}>🚀 Next.js on SpinForge!</h1>
      <p>Deployed via API - Simple Setup</p>
      <p>Time: {new Date().toISOString()}</p>
      <br />
      <a href="/api/hello" style={{ color: '#0070f3' }}>Test API →</a>
    </div>
  )
}

export async function getServerSideProps() {
  return {
    props: {
      timestamp: new Date().toISOString()
    }
  }
}
EOF

# Create API route
cat > pages/api/hello.js <<'EOF'
export default function handler(req, res) {
  res.status(200).json({
    message: 'Hello from Next.js API on SpinForge!',
    timestamp: new Date().toISOString(),
    method: req.method
  })
}
EOF

# Create deploy.json
cat > deploy.json <<EOF
{
  "name": "$APP_NAME",
  "domain": "$APP_NAME.localhost",
  "customerId": "test-customer",
  "framework": "nextjs",
  "build": {
    "command": "npm install && npm run build",
    "outputDir": "."
  },
  "env": {
    "NODE_ENV": "production"
  },
  "resources": {
    "memory": "512MB",
    "cpu": 1
  }
}
EOF

echo "✅ Next.js app created"

# Trigger deployment via API
echo ""
echo "🔄 Triggering deployment scan..."
curl -X POST http://localhost:9010/_admin/deployments/scan

# Wait for deployment
echo ""
echo "⏳ Waiting for deployment to complete..."
sleep 30

# Check deployment status
echo ""
echo "📊 Checking deployment status..."
STATUS=$(curl -s http://localhost:9010/_admin/deployments | jq --arg name "$APP_NAME" '.[] | select(.name == $name)')

if [ -z "$STATUS" ]; then
    echo "❌ Deployment not found"
    exit 1
fi

echo "$STATUS" | jq '.'

DEPLOY_STATUS=$(echo "$STATUS" | jq -r '.status')

if [ "$DEPLOY_STATUS" = "success" ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "🧪 Testing the deployment..."
    
    # Test main page
    echo ""
    echo "Testing main page..."
    curl -s -H "Host: $APP_NAME.localhost" http://localhost:9004/ | grep -o "Next.js on SpinForge" && echo "✅ Main page works!" || echo "❌ Main page failed"
    
    # Test API
    echo ""
    echo "Testing API endpoint..."
    curl -s -H "Host: $APP_NAME.localhost" http://localhost:9004/api/hello | jq '.'
    
    echo ""
    echo "🌐 Access your app at: http://$APP_NAME.localhost:9004/"
elif [ "$DEPLOY_STATUS" = "building" ]; then
    echo ""
    echo "⏳ Still building... Check again in a moment"
    echo "   curl -s http://localhost:9010/_admin/deployments | jq '.[] | select(.name == \"$APP_NAME\")'"
else
    echo ""
    echo "❌ Deployment status: $DEPLOY_STATUS"
    ERROR=$(echo "$STATUS" | jq -r '.error // "Unknown error"')
    echo "Error: $ERROR"
fi

echo ""
echo "📁 Deployment location: $DEPLOY_DIR"