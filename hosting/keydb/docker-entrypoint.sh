#!/bin/sh
#
# SpinForge KeyDB entrypoint
#
# Builds the keydb-server command line from environment variables.
# When KEYDB_PEERS is set, enables active-replica + multi-master and
# adds a --replicaof for each peer. Peers that aren't reachable yet
# (e.g. the other node hasn't booted) are fine — KeyDB retries
# automatically until the connection succeeds.
#
# Env:
#   KEYDB_PORT         default 16378
#   KEYDB_PASSWORD     if set, --requirepass + --masterauth
#   KEYDB_PEERS        comma-separated host:port list of OTHER nodes'
#                      KeyDB instances. Leave empty for single-node.
#                      Example: "192.168.88.171:16378,192.168.88.172:16378"
#
# Examples:
#   Single node:   KEYDB_PEERS=""      → vanilla standalone
#   Two nodes:     KEYDB_PEERS="192.168.88.171:16378"
#   Three nodes:   KEYDB_PEERS="192.168.88.171:16378,192.168.88.172:16378"

set -eu

PORT="${KEYDB_PORT:-16378}"

CMD="keydb-server"
CMD="$CMD --port $PORT"
CMD="$CMD --appendonly yes"
CMD="$CMD --protected-mode no"
CMD="$CMD --save 900 1 --save 300 10 --save 60 10000"

# Password auth (same password used for client auth AND master-replica auth)
if [ -n "${KEYDB_PASSWORD:-}" ]; then
  CMD="$CMD --requirepass $KEYDB_PASSWORD"
  CMD="$CMD --masterauth $KEYDB_PASSWORD"
fi

# Multi-master replication
if [ -n "${KEYDB_PEERS:-}" ]; then
  CMD="$CMD --active-replica yes"
  CMD="$CMD --multi-master yes"

  # Split comma-separated peers and add a --replicaof for each
  IFS=','
  for peer in $KEYDB_PEERS; do
    peer=$(echo "$peer" | tr -d ' ')
    host="${peer%%:*}"
    port="${peer##*:}"
    [ -z "$port" ] && port="$PORT"
    CMD="$CMD --replicaof $host $port"
    echo "[keydb-entrypoint] multi-master peer: $host:$port"
  done
  unset IFS
else
  echo "[keydb-entrypoint] single-node mode (no KEYDB_PEERS)"
fi

echo "[keydb-entrypoint] starting: $CMD"
exec $CMD
