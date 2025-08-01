#!/bin/bash

# Update static sites to use filesystem-friendly paths

API_URL="http://localhost:8080"

echo "Updating static site configurations..."

sites=(
  "test-agency"
  "test-blog"
  "test-education"
  "test-fitness"
  "test-landing"
  "test-photography"
  "test-portfolio"
  "test-restaurant"
  "test-shop"
  "test-startup"
  "static"
)

for site in "${sites[@]}"; do
  domain="$site.localhost"
  echo "Updating $domain..."
  
  # Update the site without specifying static_path
  # This will let the system auto-generate the filesystem-friendly path
  curl -s -X PUT "$API_URL/api/sites/$domain" \
    -H "Content-Type: application/json" \
    -d '{
      "static_path": null
    }' > /dev/null
    
  echo "✅ Updated $domain"
done

echo -e "\n🎉 All static sites updated!"
echo "Sites will now use filesystem-friendly folder names automatically."