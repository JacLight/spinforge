#!/bin/bash
# Namecheap DNS authentication hook for certbot

DOMAIN="${CERTBOT_DOMAIN}"
VALIDATION="${CERTBOT_VALIDATION}"

# Extract base domain and subdomain
BASE_DOMAIN=$(echo "$DOMAIN" | sed 's/.*\.\([^.]*\.[^.]*\)$/\1/')
SLD=$(echo "$BASE_DOMAIN" | cut -d. -f1)
TLD=$(echo "$BASE_DOMAIN" | cut -d. -f2)
SUBDOMAIN="_acme-challenge"

# Get credentials from Redis
CREDS=$(redis-cli GET "dns:creds:${BASE_DOMAIN}" 2>/dev/null)
if [ -z "$CREDS" ]; then
  echo "No credentials found for domain ${BASE_DOMAIN}"
  exit 1
fi

API_KEY=$(echo "$CREDS" | jq -r '.apiKey')
CLIENT_IP=$(curl -s https://ipinfo.io/ip)

# Namecheap API endpoint
API_URL="https://api.namecheap.com/xml.response"

# Create TXT record using Namecheap API
curl -X POST "$API_URL" \
  -d "ApiUser=${API_KEY}" \
  -d "ApiKey=${API_KEY}" \
  -d "UserName=${API_KEY}" \
  -d "ClientIp=${CLIENT_IP}" \
  -d "Command=namecheap.domains.dns.setHosts" \
  -d "SLD=${SLD}" \
  -d "TLD=${TLD}" \
  -d "HostName1=${SUBDOMAIN}" \
  -d "RecordType1=TXT" \
  -d "Address1=${VALIDATION}" \
  -d "TTL1=300"

# Wait for DNS propagation
sleep 30