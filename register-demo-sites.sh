#!/bin/bash

# Register demo sites using domains as primary keys

API_URL="http://localhost:8080"

echo "Registering demo sites..."

# Site 1: AppmInt
curl -X POST $API_URL/api/sites \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "appmint.localhost",
    "type": "proxy",
    "target": "https://web.appmint.io",
    "enabled": true,
    "customerId": "demo"
  }'

echo -e "\n\nRegistered appmint.localhost as proxy to https://web.appmint.io"

# Site 2: Example static site
curl -X POST $API_URL/api/sites \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "static.localhost",
    "type": "static",
    "enabled": true,
    "customerId": "demo"
  }'

echo -e "\n\nRegistered static.localhost as static site"

# Site 3: Another proxy example
curl -X POST $API_URL/api/sites \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "github.localhost",
    "type": "proxy", 
    "target": "https://github.com",
    "enabled": true,
    "customerId": "demo"
  }'

echo -e "\n\nRegistered github.localhost as proxy to https://github.com"

echo -e "\n\nAll demo sites registered!"
echo -e "\nNo need to edit /etc/hosts - .localhost domains work automatically!"
echo -e "\nJust visit:"
echo "http://appmint.localhost"
echo "http://static.localhost"
echo "http://github.localhost"