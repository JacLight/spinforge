#!/bin/bash

# Fix luxesaver.com certificate issue by copying from container to host

echo "Fixing luxesaver.com certificate..."

# Create archive directory if it doesn't exist
if [ ! -d "hosting/data/certs/archive" ]; then
    echo "Archive directory doesn't exist on host. Creating temporary directory..."
    mkdir -p /tmp/luxesaver-certs-fix
    
    # Copy certificates from container to temp directory
    docker cp spinforge-certbot:/etc/letsencrypt/archive/luxesaver.com /tmp/luxesaver-certs-fix/
    
    echo "Certificate files copied to /tmp/luxesaver-certs-fix/"
    echo "You'll need to run the following commands with sudo:"
    echo ""
    echo "sudo mkdir -p hosting/data/certs/archive"
    echo "sudo cp -r /tmp/luxesaver-certs-fix/luxesaver.com hosting/data/certs/archive/"
    echo "sudo chown -R root:root hosting/data/certs/archive/luxesaver.com"
    echo "sudo chmod -R 644 hosting/data/certs/archive/luxesaver.com/*"
    echo "sudo chmod 600 hosting/data/certs/archive/luxesaver.com/privkey*.pem"
else
    echo "Archive directory exists. Checking if luxesaver.com directory exists..."
    if [ ! -d "hosting/data/certs/archive/luxesaver.com" ]; then
        echo "Luxesaver.com archive directory missing. Copying from container..."
        docker cp spinforge-certbot:/etc/letsencrypt/archive/luxesaver.com hosting/data/certs/archive/
    fi
fi

# Verify certificates exist
echo ""
echo "Checking certificate status..."
ls -la hosting/data/certs/live/luxesaver.com/
ls -la hosting/data/certs/archive/luxesaver.com/ 2>/dev/null || echo "Archive directory still missing - please run the sudo commands above"

echo ""
echo "After fixing the certificates, restart openresty:"
echo "docker compose restart openresty"