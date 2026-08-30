#!/usr/bin/env bash
# Full end-to-end proof: auto-detect -> build -> deploy -> live URL.
# Usage: ./deploy-e2e.sh [git-url] [domain]
set -uo pipefail

REPO="${1:-https://github.com/heroku/node-js-getting-started}"
DOMAIN="${2:-e2e-$(date +%s).spinforge.dev}"
API=https://api.spinforge.dev
BUILD=https://build.spinforge.dev

jqpy() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)" 2>/dev/null; }

echo "== login =="
TOKEN=$(curl -s -X POST $API/_admin/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jqpy 'd.get("token","")')
[ -z "$TOKEN" ] && { echo "login failed"; exit 1; }
AUTH="Authorization: Bearer $TOKEN"
echo "token ok (${#TOKEN})"

echo "== auto pipeline (detect + create app + build): $REPO -> $DOMAIN =="
RESP=$(curl -s -X POST $BUILD/_api/customer/pipelines/auto -H "$AUTH" -H 'Content-Type: application/json' \
  -H "x-customer-id: partner_prt_17f3102d4d8eb211_localhost" \
  -d "{\"url\":\"$REPO\",\"domain\":\"$DOMAIN\",\"createApp\":true,\"mode\":\"deploy\",\"customerId\":\"partner_prt_17f3102d4d8eb211_localhost\"}" --max-time 180)
echo "$RESP" | python3 -m json.tool 2>/dev/null || { echo "$RESP"; exit 1; }

BID=$(echo "$RESP" | jqpy 'd.get("build",{}).get("id") or d.get("buildId","")')
DETECTED=$(echo "$RESP" | jqpy 'd.get("pipeline",{}).get("type","?")')
echo "== detected pipeline type: $DETECTED | build: $BID =="
[ -z "$BID" ] && { echo "no build id returned; stopping"; exit 1; }

echo "== polling build $BID =="
for i in $(seq 1 90); do
  B=$(curl -s "$BUILD/api/builds/$BID" -H "$AUTH")
  ST=$(echo "$B" | jqpy 'd.get("status","?")')
  STAGES=$(echo "$B" | jqpy '" ".join(f"{s.get(\"id\")}:{s.get(\"status\")}" for s in d.get("stages",[]))')
  echo "[$i] status=$ST | $STAGES"
  case "$ST" in
    succeeded) echo "== BUILD+DEPLOY SUCCEEDED =="; break;;
    failed|canceled) echo "== BUILD $ST =="; echo "$B" | jqpy 'd.get("error","")'; break;;
  esac
  sleep 5
done

echo "== hitting the deployed site: https://$DOMAIN/ =="
curl -s -o /dev/null -w "HTTP %{http_code} in %{time_total}s\n" --max-time 20 "https://$DOMAIN/" || echo "(not reachable yet — DNS/cert may lag)"
echo "done. domain=$DOMAIN buildId=$BID"
