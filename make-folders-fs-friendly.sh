#!/bin/bash

# Make folder names filesystem-friendly by replacing dots with underscores

STATIC_DIR="/Users/imzee/projects/spinforge/hosting/data/static"

echo "Making folder names filesystem-friendly..."
echo "Converting dots to underscores (e.g., test-agency.localhost → test-agency_localhost)"
echo

cd "$STATIC_DIR"

# Find all directories with .localhost suffix and rename them
for dir in *.localhost; do
  if [ -d "$dir" ]; then
    # Replace dots with underscores
    new_name=$(echo "$dir" | sed 's/\./_/g')
    
    echo "Renaming: $dir → $new_name"
    mv "$dir" "$new_name"
  fi
done

echo
echo "✅ All folders renamed to be filesystem-friendly!"
echo
echo "Updated folder structure:"
ls -la | grep "^d" | grep -v "^\." | awk '{print "  " $9}'