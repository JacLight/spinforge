#!/usr/bin/env bash
# Prove the AI build-type detection chain end-to-end against the live
# building-api: admin login -> POST /pipelines/detect -> sidecar -> Claude.
# Usage:  bash detect-test.sh [git-repo-url]
set -euo pipefail

REPO="${1:-https://github.com/heroku/node-js-getting-started}"   # a Node/Express server → expect "container"

echo "== logging in =="
TOKEN=$(curl -s -X POST https://api.spinforge.dev/_admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))')

if [ -z "$TOKEN" ]; then echo "login failed"; exit 1; fi
echo "token length: ${#TOKEN}"

echo "== detecting: $REPO =="
curl -s -X POST https://build.spinforge.dev/_api/customer/pipelines/detect \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"$REPO\"}" \
  --max-time 150 \
  | python3 -m json.tool
