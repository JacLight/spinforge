#!/bin/bash
set -e

echo "Building SpinForge packages..."

# Build shared package first
echo "Building @spinforge/shared..."
cd packages/shared
npm install --no-save
npx tsc || true
cd ../..

# Build spinlet-core
echo "Building @spinforge/spinlet-core..."
cd packages/spinlet-core
npm install --no-save
npx tsc || true
cd ../..

# Build spinlet-hub
echo "Building @spinforge/spinlet-hub..."
cd packages/spinlet-hub
npm install --no-save
npx tsc || true
cd ../..

# Build spinlet-builder
echo "Building @spinforge/spinlet-builder..."
cd packages/spinlet-builder
npm install --no-save
npx tsc || true
cd ../..

echo "Build complete!"

# Start SpinHub
echo "Starting SpinHub..."
cd packages/spinlet-hub
node dist/server.js