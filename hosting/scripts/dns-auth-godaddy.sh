#!/bin/bash
# GoDaddy DNS authentication hook for certbot

DOMAIN="${CERTBOT_DOMAIN}"
VALIDATION="${CERTBOT_VALIDATION}"

# Extract base domain
BASE_DOMAIN=$(echo "$DOMAIN" | sed 's/.*\.\([^.]*\.[^.]*\)$/\1/')
SUBDOMAIN="_acme-challenge"

# Get credentials from Redis
CREDS=$(redis-cli GET "dns:creds:${BASE_DOMAIN}" 2>/dev/null)
if [ -z "$CREDS" ]; then
  echo "No credentials found for domain ${BASE_DOMAIN}"
  exit 1
fi

API_KEY=$(echo "$CREDS" | jq -r '.apiKey')
API_SECRET=$(echo "$CREDS" | jq -r '.apiSecret')

# GoDaddy API endpoint
API_URL="https://api.godaddy.com/v1/domains/${BASE_DOMAIN}/records/TXT/${SUBDOMAIN}"

# Create TXT record
curl -X PUT "$API_URL" \
  -H "Authorization: sso-key ${API_KEY}:${API_SECRET}" \
  -H "Content-Type: application/json" \
  -d "[{\"data\":\"${VALIDATION}\",\"ttl\":300}]"

# Wait for DNS propagation
sleep 30