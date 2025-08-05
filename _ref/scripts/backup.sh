#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# SpinForge Backup Script
# This script backs up KeyDB data and builds

set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATA_DIR="${DATA_DIR:-/data}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "[$(date)] Starting backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup KeyDB data
if [ -d "$DATA_DIR/keydb" ]; then
    echo "[$(date)] Backing up KeyDB data..."
    tar -czf "$BACKUP_DIR/keydb_$TIMESTAMP.tar.gz" -C "$DATA_DIR" keydb
    echo "[$(date)] KeyDB backup completed"
fi

# Backup builds
if [ -d "$DATA_DIR/builds" ]; then
    echo "[$(date)] Backing up builds..."
    tar -czf "$BACKUP_DIR/builds_$TIMESTAMP.tar.gz" -C "$DATA_DIR" builds
    echo "[$(date)] Builds backup completed"
fi

# Clean up old backups
echo "[$(date)] Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup completed successfully"