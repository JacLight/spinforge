#!/bin/bash
# Fix certificate permissions for OpenResty to read

CERT_BASE="/etc/letsencrypt"

# Fix ownership and permissions for all certificates
find $CERT_BASE/live -type d -exec chmod 755 {} \;
find $CERT_BASE/archive -type d -exec chmod 755 {} \;

# Make certificate files readable
find $CERT_BASE/live -name "*.pem" -type l -exec chmod 644 {} \;
find $CERT_BASE/archive -name "*.pem" -type f -exec chmod 644 {} \;

# Fix the base directories
chmod 755 $CERT_BASE/live
chmod 755 $CERT_BASE/archive

echo "Certificate permissions fixed"