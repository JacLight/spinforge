#!/bin/bash

# Build script for AppMint VS Code Authentication Extension

echo "🚀 Building AppMint VS Code Extension..."

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if vsce is installed globally
if ! command -v vsce &> /dev/null; then
    echo "📦 Installing vsce (Visual Studio Code Extension manager)..."
    npm install -g vsce
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf out/
rm -f *.vsix

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run compile

# Package the extension
echo "📦 Packaging extension..."
vsce package

# Find the generated .vsix file
VSIX_FILE=$(ls *.vsix 2>/dev/null | head -n 1)

if [ -f "$VSIX_FILE" ]; then
    echo "✅ Build successful!"
    echo "📦 Extension package created: $VSIX_FILE"
    echo ""
    echo "To install the extension:"
    echo "  1. Open VS Code"
    echo "  2. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)"
    echo "  3. Type 'Extensions: Install from VSIX...'"
    echo "  4. Select the file: $VSIX_FILE"
else
    echo "❌ Build failed! No .vsix file was generated."
    exit 1
fi