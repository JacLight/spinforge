#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License

# Deploy multiple static test sites

NUM_SITES=${1:-10}

echo "🚀 Deploying $NUM_SITES static test sites..."
echo ""

for i in $(seq 1 $NUM_SITES); do
    echo "📦 Deploying site $i..."
    ./deploy-static.sh $i
    echo ""
done

echo "✅ All $NUM_SITES sites deployed!"
echo ""
echo "📊 Summary:"
echo "   - Sites deployed: $NUM_SITES"
echo "   - Customer: test-customer"
echo "   - Domains: test-1.localhost to test-$NUM_SITES.localhost"
echo ""
echo "⏳ Waiting for hot deployment watcher to process..."
echo "   Check logs: docker logs -f spinforge-hub"