#!/bin/sh
# SpinBuild API entrypoint
set -e

echo "Starting SpinBuild API..."

# Ensure Ceph-backed data directories exist for workspaces + artifacts.
# Missing dirs on first boot are expected; mkdir is idempotent.
mkdir -p "${DATA_ROOT:-/data}/workspaces" "${DATA_ROOT:-/data}/artifacts"

exec node server.js
