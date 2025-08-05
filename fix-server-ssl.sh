#!/bin/bash

echo "Checking SSL certificate files on server..."

# Check what's in the luxesaver.com directory
echo "=== Contents of /etc/letsencrypt/live/luxesaver.com/ ==="
docker exec spinforge-openresty ls -la /etc/letsencrypt/live/luxesaver.com/

# Check if archive directory exists
echo -e "\n=== Checking archive directory ==="
docker exec spinforge-openresty ls -la /etc/letsencrypt/archive/ 2>/dev/null || echo "Archive directory not found"

# Test if fullchain.pem exists and is readable
echo -e "\n=== Testing certificate file ==="
docker exec spinforge-openresty test -f /etc/letsencrypt/live/luxesaver.com/fullchain.pem && echo "fullchain.pem exists" || echo "fullchain.pem NOT found"
docker exec spinforge-openresty test -r /etc/letsencrypt/live/luxesaver.com/fullchain.pem && echo "fullchain.pem is readable" || echo "fullchain.pem NOT readable"

# Check if it's a symlink
echo -e "\n=== Checking symlinks ==="
docker exec spinforge-openresty readlink /etc/letsencrypt/live/luxesaver.com/fullchain.pem 2>/dev/null || echo "Not a symlink or doesn't exist"

# Try to read the actual file content
echo -e "\n=== Testing file read ==="
docker exec spinforge-openresty head -n 1 /etc/letsencrypt/live/luxesaver.com/fullchain.pem 2>&1 || echo "Cannot read file"