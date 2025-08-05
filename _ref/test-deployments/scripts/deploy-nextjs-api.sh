#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# Deploy Next.js app using SpinForge API

set -e

echo "🚀 SpinForge Next.js API Deployment"
echo "===================================="
echo ""

# Configuration
APP_NAME="nextjs-api-test-$(date +%s)"
SOURCE_DIR="/Users/imzee/projects/spinforge/test-deployments/nextjs-api-test"
API_URL="http://localhost:9010/_admin"

# Create a zip file of the Next.js app
echo "📦 Creating deployment package..."
cd "$SOURCE_DIR"
zip -r "/tmp/${APP_NAME}.zip" . -x "*.git*" -x "*node_modules*" -x "*.next*"

echo "✅ Package created: /tmp/${APP_NAME}.zip"

# Check if API is accessible
echo ""
echo "🔍 Checking API availability..."
if curl -s -f "${API_URL}/deployments" > /dev/null; then
    echo "✅ API is accessible"
else
    echo "❌ API is not accessible at ${API_URL}"
    exit 1
fi

# Upload and deploy using the API
echo ""
echo "📤 Deploying via API..."

# First, we need to copy the zip to the deployments folder
DEPLOY_DIR="/Users/imzee/projects/spinforge/deployments/${APP_NAME}"
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"
unzip -q "/tmp/${APP_NAME}.zip"

# Update the deploy.json with the new app name
jq --arg name "$APP_NAME" --arg domain "${APP_NAME}.localhost" \
  '.name = $name | .domain = $domain' deploy.json > deploy.json.tmp && mv deploy.json.tmp deploy.json

echo "✅ Deployment package extracted to: $DEPLOY_DIR"

# Trigger deployment scan via API
echo ""
echo "🔄 Triggering deployment scan..."
SCAN_RESPONSE=$(curl -s -X POST "${API_URL}/deployments/scan")
echo "Response: $SCAN_RESPONSE"

# Wait for deployment to process
echo ""
echo "⏳ Waiting for deployment to complete..."
sleep 10

# Check deployment status via API
echo ""
echo "📊 Checking deployment status..."
DEPLOYMENT_STATUS=$(curl -s "${API_URL}/deployments" | jq --arg name "$APP_NAME" '.[] | select(.name == $name)')

if [ -z "$DEPLOYMENT_STATUS" ]; then
    echo "❌ Deployment not found in API"
    exit 1
fi

echo "Deployment Status:"
echo "$DEPLOYMENT_STATUS" | jq '.'

STATUS=$(echo "$DEPLOYMENT_STATUS" | jq -r '.status')

if [ "$STATUS" = "success" ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "🌐 Your Next.js app is available at:"
    echo "   http://${APP_NAME}.localhost:9004/"
    echo "   API endpoint: http://${APP_NAME}.localhost:9004/api/hello"
    echo ""
    echo "🧪 Testing the deployment..."
    echo ""
    
    # Test the main page
    echo "Testing main page..."
    MAIN_RESPONSE=$(curl -s -w "\n%{http_code}" -H "Host: ${APP_NAME}.localhost" http://localhost:9004/)
    HTTP_CODE=$(echo "$MAIN_RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Main page is working (HTTP 200)"
    else
        echo "❌ Main page returned HTTP $HTTP_CODE"
    fi
    
    # Test the API endpoint
    echo ""
    echo "Testing API endpoint..."
    API_RESPONSE=$(curl -s -H "Host: ${APP_NAME}.localhost" http://localhost:9004/api/hello)
    echo "API Response: $API_RESPONSE"
    
elif [ "$STATUS" = "failed" ]; then
    echo ""
    echo "❌ Deployment failed!"
    ERROR=$(echo "$DEPLOYMENT_STATUS" | jq -r '.error // "Unknown error"')
    echo "Error: $ERROR"
    
    # Check logs
    echo ""
    echo "📋 Deployment logs:"
    curl -s "${API_URL}/deployments/${APP_NAME}/logs" | jq -r '.logs // "No logs available"'
else
    echo ""
    echo "⏳ Deployment status: $STATUS"
    echo "The deployment may still be in progress. Check again in a few moments."
fi

# Cleanup
rm -f "/tmp/${APP_NAME}.zip"

echo ""
echo "📁 Deployment location: $DEPLOY_DIR"
echo ""
echo "🔧 Useful commands:"
echo "   - Check status: curl -s ${API_URL}/deployments | jq '.[] | select(.name == \"$APP_NAME\")'"
echo "   - View logs: curl -s ${API_URL}/deployments/${APP_NAME}/logs | jq '.logs'"
echo "   - Remove deployment: curl -X DELETE ${API_URL}/deployments/${APP_NAME}"