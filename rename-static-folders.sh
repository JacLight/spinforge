#!/bin/bash

# Rename static folders to match the new domain format

STATIC_DIR="/Users/imzee/projects/spinforge/hosting/data/static"

echo "Renaming static folders to match domain names..."

# Array of sites to rename
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
  old_path="$STATIC_DIR/$site"
  new_path="$STATIC_DIR/$site.localhost"
  
  if [ -d "$old_path" ]; then
    echo "Renaming $site → $site.localhost"
    mv "$old_path" "$new_path"
  else
    echo "⚠️  Directory not found: $old_path"
  fi
done

echo -e "\n✅ All folders renamed!"
echo "Folders now match the domain names (e.g., test-agency.localhost)"