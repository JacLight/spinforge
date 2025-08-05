#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License

# Simple static site deployment script using hot deployment

set -e

SITE_NUM=${1:-1}
CUSTOMER_ID=${2:-test-customer}
DOMAIN=${3:-test-$SITE_NUM.localhost}

DEPLOY_DIR="/Users/imzee/projects/spinforge/deployments/$CUSTOMER_ID/test-site-$SITE_NUM"

echo "🚀 Deploying static test site $SITE_NUM"
echo "📁 Deploy path: $DEPLOY_DIR"
echo "🌐 Domain: $DOMAIN"

# Create deployment directory
mkdir -p "$DEPLOY_DIR"

# Create index.html
cat > "$DEPLOY_DIR/index.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Site $SITE_NUM</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 3rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
            max-width: 600px;
        }
        h1 {
            font-size: 4rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        .site-number {
            font-size: 6rem;
            font-weight: bold;
            margin: 2rem 0;
            animation: pulse 2s infinite;
        }
        .info {
            background: rgba(255, 255, 255, 0.1);
            padding: 1.5rem;
            border-radius: 10px;
            margin: 2rem 0;
        }
        .info p {
            margin: 0.5rem 0;
            font-size: 1.1rem;
        }
        .timestamp {
            opacity: 0.8;
            font-size: 0.9rem;
            margin-top: 2rem;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Deployment</h1>
        <div class="site-number">#$SITE_NUM</div>
        <div class="info">
            <p><strong>Domain:</strong> $DOMAIN</p>
            <p><strong>Type:</strong> Static Site</p>
            <p><strong>Status:</strong> <span style="color: #4ade80;">Active</span></p>
        </div>
        <div class="timestamp">
            Deployed at $(date '+%Y-%m-%d %H:%M:%S')
        </div>
    </div>
</body>
</html>
EOF

# Create about.html
cat > "$DEPLOY_DIR/about.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>About - Test Site $SITE_NUM</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #667eea; }
    </style>
</head>
<body>
    <h1>About Test Site $SITE_NUM</h1>
    <p>This is a test deployment created by SpinForge hot deployment.</p>
    <a href="/">Back to Home</a>
</body>
</html>
EOF

# Create style.css
cat > "$DEPLOY_DIR/style.css" << EOF
/* Additional styles */
.button {
    display: inline-block;
    padding: 10px 20px;
    background: #667eea;
    color: white;
    text-decoration: none;
    border-radius: 5px;
    transition: transform 0.2s;
}
.button:hover {
    transform: translateY(-2px);
}
EOF

# Create deploy.json to trigger hot deployment
cat > "$DEPLOY_DIR/deploy.json" << EOF
{
  "name": "test-site-$SITE_NUM",
  "framework": "static",
  "customerId": "$CUSTOMER_ID",
  "domain": "$DOMAIN"
}
EOF

echo "✅ Static site $SITE_NUM deployed!"
echo "📄 Created files:"
echo "   - index.html"
echo "   - about.html"
echo "   - style.css"
echo "   - deploy.json"
echo ""
echo "⏳ Hot deployment watcher will pick this up shortly..."
echo "🌐 Visit http://$DOMAIN once deployed"