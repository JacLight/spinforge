#!/usr/bin/env bash
# prune-caches.sh — delete stale entries from shared build caches on Ceph.
#
# For each cache dir under /mnt/cephfs/spinforge/hosting/data/cache, drop
# any file not accessed (atime) in the last 30 days, then collapse empty
# directories. Reports size pruned per cache.
#
# Usage:  sudo /home/imzee/spinforge/scripts/prune-caches.sh
#
# TODO(task 131): wire into a Nomad periodic batch so this runs nightly
# without a human cron.

set -euo pipefail

CACHE_ROOT="/mnt/cephfs/spinforge/hosting/data/cache"
AGE_DAYS="${AGE_DAYS:-30}"

if [[ ! -d "$CACHE_ROOT" ]]; then
  echo "cache root $CACHE_ROOT not found" >&2
  exit 1
fi

CACHES=(npm pnpm yarn gradle maven pip cocoapods sccache xcode-derived-data)

total_before=0
total_after=0

human() {
  # bytes -> human readable via numfmt (coreutils); fall back to raw if missing.
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec --suffix=B "$1"
  else
    echo "${1}B"
  fi
}

echo "Pruning files with atime > ${AGE_DAYS} days under ${CACHE_ROOT}"
echo

printf "%-22s %12s %12s %12s\n" "cache" "before" "after" "pruned"
printf "%-22s %12s %12s %12s\n" "-----" "------" "-----" "------"

for c in "${CACHES[@]}"; do
  dir="${CACHE_ROOT}/${c}"
  if [[ ! -d "$dir" ]]; then
    printf "%-22s %12s %12s %12s\n" "$c" "missing" "-" "-"
    continue
  fi

  before=$(du -sb "$dir" 2>/dev/null | awk '{print $1}')
  before=${before:-0}

  # Delete files not accessed in N days. -atime +N is "strictly older than N".
  find "$dir" -type f -atime "+${AGE_DAYS}" -delete 2>/dev/null || true
  # Collapse empty dirs (skip cache root itself).
  find "$dir" -mindepth 1 -type d -empty -delete 2>/dev/null || true

  after=$(du -sb "$dir" 2>/dev/null | awk '{print $1}')
  after=${after:-0}

  pruned=$(( before - after ))
  total_before=$(( total_before + before ))
  total_after=$(( total_after + after ))

  printf "%-22s %12s %12s %12s\n" \
    "$c" "$(human "$before")" "$(human "$after")" "$(human "$pruned")"
done

echo
printf "%-22s %12s %12s %12s\n" \
  "TOTAL" \
  "$(human "$total_before")" \
  "$(human "$total_after")" \
  "$(human "$(( total_before - total_after ))")"
