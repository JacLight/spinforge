#!/bin/bash
# GoDaddy DNS cleanup hook for certbot

DOMAIN="${CERTBOT_DOMAIN}"

# Extract base domain
BASE_DOMAIN=$(echo "$DOMAIN" | sed 's/.*\.\([^.]*\.[^.]*\)$/\1/')
SUBDOMAIN="_acme-challenge"

# Get credentials from Redis
CREDS=$(redis-cli GET "dns:creds:${BASE_DOMAIN}" 2>/dev/null)
if [ -z "$CREDS" ]; then
  echo "No credentials found for domain ${BASE_DOMAIN}"
  exit 0
fi

API_KEY=$(echo "$CREDS" | jq -r '.apiKey')
API_SECRET=$(echo "$CREDS" | jq -r '.apiSecret')

# GoDaddy API endpoint
API_URL="https://api.godaddy.com/v1/domains/${BASE_DOMAIN}/records/TXT/${SUBDOMAIN}"

# Delete TXT record
curl -X DELETE "$API_URL" \
  -H "Authorization: sso-key ${API_KEY}:${API_SECRET}"

# Clean up credentials
redis-cli DEL "dns:creds:${BASE_DOMAIN}" 2>/dev/null