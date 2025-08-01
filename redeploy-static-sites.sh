#!/bin/bash

# Redeploy static sites with new domain structure

API_URL="http://localhost:8080"
STATIC_DIR="/Users/imzee/projects/spinforge/hosting/data/static"

echo "Redeploying static sites..."

# Array of sites to redeploy
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
)

for site in "${sites[@]}"; do
  echo -e "\n📦 Processing $site..."
  
  # Check if directory exists
  if [ ! -d "$STATIC_DIR/$site" ]; then
    echo "⚠️  Directory not found: $STATIC_DIR/$site"
    continue
  fi
  
  # Update deploy.json to use new domain format
  deploy_json="$STATIC_DIR/$site/deploy.json"
  if [ -f "$deploy_json" ]; then
    # Create new domain without .spinforge suffix
    new_domain="$site.localhost"
    
    # Update the deploy.json file
    jq --arg domain "$new_domain" '.domain = $domain' "$deploy_json" > "$deploy_json.tmp" && mv "$deploy_json.tmp" "$deploy_json"
    echo "✅ Updated deploy.json with domain: $new_domain"
  fi
  
  # Register the site in the new system
  echo "📝 Registering $site.localhost..."
  response=$(curl -s -X POST $API_URL/api/sites \
    -H "Content-Type: application/json" \
    -d "{
      \"domain\": \"$site.localhost\",
      \"type\": \"static\",
      \"static_path\": \"/var/www/static/$site\",
      \"enabled\": true,
      \"customerId\": \"demo\"
    }")
  
  if echo "$response" | grep -q "Site created"; then
    echo "✅ Site registered successfully"
  else
    echo "❌ Failed to register site: $response"
  fi
done

echo -e "\n\n🎉 All sites redeployed!"
echo -e "\nYou can now access:"
for site in "${sites[@]}"; do
  echo "  http://$site.localhost"
done