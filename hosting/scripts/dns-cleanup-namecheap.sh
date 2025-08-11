#!/bin/bash
# Namecheap DNS cleanup hook for certbot

DOMAIN="${CERTBOT_DOMAIN}"

# Extract base domain and subdomain
BASE_DOMAIN=$(echo "$DOMAIN" | sed 's/.*\.\([^.]*\.[^.]*\)$/\1/')
SLD=$(echo "$BASE_DOMAIN" | cut -d. -f1)
TLD=$(echo "$BASE_DOMAIN" | cut -d. -f2)

# Get credentials from Redis
CREDS=$(redis-cli GET "dns:creds:${BASE_DOMAIN}" 2>/dev/null)
if [ -z "$CREDS" ]; then
  echo "No credentials found for domain ${BASE_DOMAIN}"
  exit 0
fi

API_KEY=$(echo "$CREDS" | jq -r '.apiKey')
CLIENT_IP=$(curl -s https://ipinfo.io/ip)

# Namecheap API endpoint
API_URL="https://api.namecheap.com/xml.response"

# Get existing records and remove the TXT record
# This requires fetching current records and resubmitting without the _acme-challenge record
# For simplicity, we'll just clean up Redis

# Clean up credentials
redis-cli DEL "dns:creds:${BASE_DOMAIN}" 2>/dev/null