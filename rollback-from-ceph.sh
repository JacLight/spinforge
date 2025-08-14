#!/bin/bash
# SpinForge Ceph Migration Rollback Script
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ORIGINAL_DATA="/home/imzee/spinforge/hosting/data"
OLD_DATA="${ORIGINAL_DATA}.old"
BACKUP_DIR=$(ls -td /home/imzee/spinforge/backups/*/ 2>/dev/null | head -1)

echo -e "${YELLOW}=== SpinForge Ceph Migration Rollback ===${NC}"
echo ""

# Step 1: Check if rollback is possible
echo -e "${YELLOW}Step 1: Checking rollback prerequisites${NC}"

if [ ! -d "$OLD_DATA" ]; then
    echo -e "${RED}Error: Old data directory $OLD_DATA not found${NC}"
    echo "Rollback may not be possible if original data was not preserved"
    exit 1
fi

if [ -z "$BACKUP_DIR" ]; then
    echo -e "${RED}Warning: No backup directory found${NC}"
    echo "You may need to manually restore docker-compose.yml"
else
    echo "Found backup at: $BACKUP_DIR"
fi

# Step 2: Stop services
echo -e "${YELLOW}Step 2: Stopping services${NC}"
read -p "Stop all SpinForge services? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose down
    echo "Services stopped"
else
    echo -e "${RED}Rollback cancelled${NC}"
    exit 1
fi

# Step 3: Remove symlink and restore original data
echo -e "${YELLOW}Step 3: Restoring original data directory${NC}"

if [ -L "$ORIGINAL_DATA" ]; then
    echo "Removing symlink..."
    rm "$ORIGINAL_DATA"
fi

if [ -d "$OLD_DATA" ]; then
    echo "Restoring original data..."
    mv "$OLD_DATA" "$ORIGINAL_DATA"
    echo "Data restored to: $ORIGINAL_DATA"
else
    echo -e "${RED}Error: Could not find old data to restore${NC}"
    exit 1
fi

# Step 4: Restore docker-compose.yml
echo -e "${YELLOW}Step 4: Restoring docker-compose.yml${NC}"

if [ -f "$BACKUP_DIR/docker-compose.yml.backup" ]; then
    cp "$BACKUP_DIR/docker-compose.yml.backup" docker-compose.yml
    echo "docker-compose.yml restored from backup"
else
    echo -e "${YELLOW}Warning: Backup docker-compose.yml not found${NC}"
    echo "Please manually restore docker-compose.yml or use:"
    echo "  git checkout docker-compose.yml"
fi

# Step 5: Verify restoration
echo -e "${YELLOW}Step 5: Verifying restoration${NC}"

if [ -d "$ORIGINAL_DATA" ]; then
    echo -e "${GREEN}✓ Data directory restored${NC}"
    ls -la "$ORIGINAL_DATA" | head -5
else
    echo -e "${RED}✗ Data directory not found${NC}"
fi

if [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}✓ docker-compose.yml exists${NC}"
else
    echo -e "${RED}✗ docker-compose.yml not found${NC}"
fi

echo ""
echo -e "${GREEN}=== Rollback Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Start services: docker compose up -d"
echo "2. Verify all services are running: docker ps"
echo "3. Test application functionality"
echo ""
echo "The Ceph data remains at: /mnt/cephfs/spinforge/hosting/data"
echo "You can safely remove it once rollback is confirmed successful"