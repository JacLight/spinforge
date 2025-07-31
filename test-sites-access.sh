#!/bin/bash

echo "🧪 Testing SpinForge Deployed Sites"
echo "==================================="
echo ""

SITES="portfolio blog shop landing restaurant agency photography fitness education startup"

for site in $SITES; do
    echo "Testing test-$site.spinforge.local..."
    response=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: test-$site.spinforge.local" http://localhost:80)
    if [ "$response" = "200" ]; then
        echo "✅ test-$site: HTTP $response - OK"
    else
        echo "❌ test-$site: HTTP $response - Failed"
    fi
done

echo ""
echo "📝 To access these sites in your browser:"
echo "1. Add the following entries to your /etc/hosts file:"
echo ""
echo "127.0.0.1 test-portfolio.spinforge.local"
echo "127.0.0.1 test-blog.spinforge.local"
echo "127.0.0.1 test-shop.spinforge.local"
echo "127.0.0.1 test-landing.spinforge.local"
echo "127.0.0.1 test-restaurant.spinforge.local"
echo "127.0.0.1 test-agency.spinforge.local"
echo "127.0.0.1 test-photography.spinforge.local"
echo "127.0.0.1 test-fitness.spinforge.local"
echo "127.0.0.1 test-education.spinforge.local"
echo "127.0.0.1 test-startup.spinforge.local"
echo ""
echo "2. Then visit any of these URLs in your browser:"
echo "   - http://test-portfolio.spinforge.local"
echo "   - http://test-blog.spinforge.local"
echo "   - etc..."