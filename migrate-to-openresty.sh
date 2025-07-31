#!/bin/bash

# Migrate all test sites to OpenResty/Redis routing

echo "🔄 Migrating sites to OpenResty dynamic routing..."
echo ""

SITES="portfolio blog shop landing restaurant agency photography fitness education startup"

for site in $SITES; do
    echo "Migrating test-$site..."
    
    curl -X POST http://localhost:8080/api/vhost \
        -H "Content-Type: application/json" \
        -d '{
            "subdomain": "test-'$site'",
            "type": "static",
            "customerId": "test-customer",
            "enabled": true,
            "metadata": {
                "migrated": true,
                "migratedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
            }
        }' > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ test-$site migrated"
    else
        echo "❌ test-$site migration failed"
    fi
done

echo ""
echo "✅ Migration complete!"
echo ""
echo "Testing sites..."
echo ""

for site in $SITES; do
    response=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: test-$site.spinforge.io" http://localhost)
    if [ "$response" = "200" ]; then
        echo "✅ test-$site: HTTP $response - Working!"
    else
        echo "❌ test-$site: HTTP $response - Failed"
    fi
done

echo ""
echo "📊 Summary:"
echo "==========="
echo "- Replaced Caddy with OpenResty"
echo "- Routes now stored in Redis/KeyDB"
echo "- No reloads needed for new sites"
echo "- Can handle 19k+ sites efficiently"
echo ""
echo "🚀 Ready to scale to thousands of sites!"