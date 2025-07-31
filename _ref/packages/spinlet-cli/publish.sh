#!/bin/bash

echo "🚀 Preparing to publish SpinForge CLI to npm..."

# Check if logged in to npm
npm whoami &> /dev/null
if [ $? -ne 0 ]; then
    echo "❌ You need to login to npm first"
    echo "Run: npm login"
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Run tests if they exist
if [ -f "jest.config.js" ]; then
    echo "🧪 Running tests..."
    npm test
    if [ $? -ne 0 ]; then
        echo "❌ Tests failed"
        exit 1
    fi
fi

# Show what will be published
echo "📦 Files to be published:"
npm pack --dry-run

# Confirm publication
read -p "Ready to publish? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm publish --access public
    echo "✅ Published successfully!"
    echo "Install with: npm install -g spinforge"
else
    echo "❌ Publication cancelled"
fi