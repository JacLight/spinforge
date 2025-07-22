#!/bin/bash

# Deploy Next.js as static export

set -e

echo "🚀 Next.js Static Export Deployment"
echo "==================================="
echo ""

# Configuration
APP_NAME="nextjs-static-$(date +%s)"
DEPLOY_DIR="/Users/imzee/projects/spinforge/deployments/$APP_NAME"

# Create deployment directory
echo "📦 Creating Next.js static deployment: $APP_NAME"
mkdir -p "$DEPLOY_DIR"

cd "$DEPLOY_DIR"

# Create package.json
cat > package.json <<'EOF'
{
  "name": "nextjs-static",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "export": "next export"
  },
  "dependencies": {
    "next": "14.0.4",
    "react": "^18",
    "react-dom": "^18"
  }
}
EOF

# Create next.config.js for static export
cat > next.config.js <<'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
EOF

# Create app directory
mkdir -p app

# Create layout
cat > app/layout.js <<'EOF'
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
EOF

# Create page
cat > app/page.js <<'EOF'
export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#0070f3' }}>🚀 Next.js Static Export on SpinForge!</h1>
      <p>This is a statically exported Next.js site deployed via API</p>
      <div style={{ marginTop: '2rem' }}>
        <h2>Benefits of Static Export:</h2>
        <ul>
          <li>✅ Fast page loads</li>
          <li>✅ No server required</li>
          <li>✅ Easy deployment</li>
          <li>✅ SEO friendly</li>
        </ul>
      </div>
    </div>
  )
}
EOF

# Create deploy.json for static framework
cat > deploy.json <<EOF
{
  "name": "$APP_NAME",
  "domain": "$APP_NAME.localhost",
  "customerId": "test-customer",
  "framework": "static",
  "build": {
    "command": "npm install && npm run build",
    "outputDir": "out"
  },
  "resources": {
    "memory": "128MB",
    "cpu": 0.5
  }
}
EOF

echo "✅ Next.js static app created"

# Trigger deployment
echo ""
echo "🔄 Triggering deployment scan..."
curl -X POST http://localhost:9010/_admin/deployments/scan

# Wait for deployment
echo ""
echo "⏳ Waiting for deployment..."
sleep 20

# Check status
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
    
    curl -s -H "Host: $APP_NAME.localhost" http://localhost:9004/ | grep -q "Next.js Static Export" && echo "✅ Site is working!" || echo "❌ Site test failed"
    
    echo ""
    echo "🌐 Access your site at: http://$APP_NAME.localhost:9004/"
else
    echo ""
    echo "❌ Deployment status: $DEPLOY_STATUS"
    ERROR=$(echo "$STATUS" | jq -r '.error // "Unknown"')
    echo "Error: $ERROR"
fi

echo ""
echo "📁 Deployment location: $DEPLOY_DIR"