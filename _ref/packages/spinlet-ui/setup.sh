#!/bin/bash

echo "🚀 Setting up SpinForge Management UI..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building the project..."
npm run build

echo "✅ Setup complete!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "The UI will be available at:"
echo "  Development: http://localhost:3001"
echo "  Production: http://localhost:9010"