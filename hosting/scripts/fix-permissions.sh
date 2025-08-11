#!/bin/bash
# Fix permissions for SpinForge files

echo "Fixing file permissions..."

# Fix certificate permissions
if [ -d "./hosting/data/certs" ]; then
    find ./hosting/data/certs -type d -exec chmod 755 {} \;
    find ./hosting/data/certs -name "*.pem" -exec chmod 644 {} \;
    echo "✅ Certificate permissions fixed"
fi

# Fix upload directory permissions
if [ -d "./hosting/data/uploads" ]; then
    chmod 777 ./hosting/data/uploads
    echo "✅ Upload directory permissions fixed"
fi

# Fix static files permissions
if [ -d "./hosting/data/static" ]; then
    find ./hosting/data/static -type d -exec chmod 755 {} \;
    find ./hosting/data/static -type f -exec chmod 644 {} \;
    echo "✅ Static files permissions fixed"
fi

echo "✅ All permissions fixed"