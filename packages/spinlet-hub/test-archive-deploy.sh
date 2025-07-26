#!/bin/bash

# Test script for uploading deployment archives
# Usage: ./test-archive-deploy.sh <archive-file>

ARCHIVE_FILE="${1:-test-app.zip}"
API_URL="http://localhost:8080/_admin/deployments/upload"

# Example deployment configuration
CONFIG='{
  "name": "test-archive-app",
  "domain": "archive-test.local",
  "customerId": "test-customer",
  "framework": "static",
  "resources": {
    "memory": "256MB",
    "cpu": 0.5
  },
  "env": {
    "NODE_ENV": "production"
  }
}'

echo "Uploading archive: $ARCHIVE_FILE"
echo "Configuration: $CONFIG"

# Upload the archive
curl -X POST "$API_URL" \
  -H "X-Admin-Token: changeMe123" \
  -F "archive=@$ARCHIVE_FILE" \
  -F "config=$CONFIG" \
  -v

echo -e "\n\nDeployment uploaded. Check status at: http://localhost:8080/_admin/deployments"