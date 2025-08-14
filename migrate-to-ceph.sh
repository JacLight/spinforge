#!/bin/bash
# SpinForge Data Migration to Ceph for HA
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SOURCE_DATA="/home/imzee/spinforge/hosting/data"
CEPH_BASE="/mnt/cephfs/spinforge"
CEPH_DATA="$CEPH_BASE/hosting/data"
BACKUP_DIR="/home/imzee/spinforge/backups/$(date +%Y%m%d_%H%M%S)"

echo -e "${GREEN}=== SpinForge Ceph Migration Script ===${NC}"
echo "Source: $SOURCE_DATA"
echo "Target: $CEPH_DATA"
echo ""

# Step 1: Pre-flight checks
echo -e "${YELLOW}Step 1: Pre-flight checks${NC}"
if [ ! -d "$SOURCE_DATA" ]; then
    echo -e "${RED}Error: Source directory $SOURCE_DATA does not exist${NC}"
    exit 1
fi

if ! mountpoint -q /mnt/cephfs; then
    echo -e "${RED}Error: Ceph filesystem is not mounted at /mnt/cephfs${NC}"
    exit 1
fi

# Step 2: Create Ceph directory structure (requires sudo)
echo -e "${YELLOW}Step 2: Creating Ceph directory structure${NC}"
echo "This step requires sudo privileges..."
sudo mkdir -p "$CEPH_DATA"
sudo chown -R $(id -u):$(id -g) "$CEPH_BASE"

# Create subdirectories
mkdir -p "$CEPH_DATA"/{static,certs,certbot-webroot,certbot-logs,certificates,deployments,uploads}

# Step 3: Create backup of docker-compose.yml
echo -e "${YELLOW}Step 3: Backing up configuration${NC}"
mkdir -p "$BACKUP_DIR"
cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml.backup"
echo "Backup created at: $BACKUP_DIR/docker-compose.yml.backup"

# Step 4: Stop services
echo -e "${YELLOW}Step 4: Stopping SpinForge services${NC}"
read -p "Stop services now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose down
    echo "Services stopped"
else
    echo -e "${RED}Migration cancelled${NC}"
    exit 1
fi

# Step 5: Sync data to Ceph
echo -e "${YELLOW}Step 5: Syncing data to Ceph${NC}"
echo "This may take a few minutes..."

# First do a dry-run
echo "Performing dry-run first..."
rsync -avP --dry-run "$SOURCE_DATA/" "$CEPH_DATA/"

read -p "Proceed with actual sync? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rsync -avP "$SOURCE_DATA/" "$CEPH_DATA/"
    
    # Fix permissions for certificates
    if [ -d "$CEPH_DATA/certs" ]; then
        echo "Fixing certificate permissions..."
        chmod -R 755 "$CEPH_DATA/certs" 2>/dev/null || true
    fi
else
    echo -e "${RED}Migration cancelled${NC}"
    exit 1
fi

# Step 6: Verify migration
echo -e "${YELLOW}Step 6: Verifying migration${NC}"
echo "Comparing source and destination..."

# Count files
SOURCE_COUNT=$(find "$SOURCE_DATA" -type f 2>/dev/null | wc -l)
DEST_COUNT=$(find "$CEPH_DATA" -type f 2>/dev/null | wc -l)

echo "Source files: $SOURCE_COUNT"
echo "Destination files: $DEST_COUNT"

if [ "$SOURCE_COUNT" -ne "$DEST_COUNT" ]; then
    echo -e "${YELLOW}Warning: File count mismatch. Please review.${NC}"
fi

# Step 7: Create symlink (optional fallback)
echo -e "${YELLOW}Step 7: Creating fallback symlink${NC}"
if [ -d "$SOURCE_DATA" ]; then
    mv "$SOURCE_DATA" "${SOURCE_DATA}.old"
    ln -s "$CEPH_DATA" "$SOURCE_DATA"
    echo "Created symlink: $SOURCE_DATA -> $CEPH_DATA"
fi

echo -e "${GREEN}=== Migration Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Update docker-compose.yml with new Ceph paths"
echo "2. Start services: docker compose up -d"
echo "3. Test all functionality"
echo "4. If everything works, remove old data: rm -rf ${SOURCE_DATA}.old"
echo ""
echo "To rollback:"
echo "1. docker compose down"
echo "2. rm $SOURCE_DATA && mv ${SOURCE_DATA}.old $SOURCE_DATA"
echo "3. cp $BACKUP_DIR/docker-compose.yml.backup docker-compose.yml"
echo "4. docker compose up -d"