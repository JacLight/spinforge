#!/bin/bash
# Manual sync script for Ceph migration with proper permissions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SOURCE_DATA="/home/imzee/spinforge/hosting/data"
CEPH_DATA="/mnt/cephfs/spinforge/hosting/data"

echo -e "${GREEN}=== Manual Ceph Data Sync ===${NC}"
echo "This script will sync your data to Ceph with proper permissions"
echo ""

# Step 1: Sync non-privileged files first
echo -e "${YELLOW}Step 1: Syncing regular files${NC}"
rsync -avP --exclude='certs/accounts' --exclude='certs/archive' "$SOURCE_DATA/" "$CEPH_DATA/"

# Step 2: Handle certificate directories with sudo
echo -e "${YELLOW}Step 2: Syncing certificate directories (requires sudo)${NC}"
echo "Please run these commands manually with sudo:"
echo ""
echo -e "${GREEN}sudo rsync -avP $SOURCE_DATA/certs/accounts/ $CEPH_DATA/certs/accounts/${NC}"
echo -e "${GREEN}sudo rsync -avP $SOURCE_DATA/certs/archive/ $CEPH_DATA/certs/archive/${NC}"
echo ""
echo "After running the above commands with sudo, continue with:"
echo ""

# Step 3: Fix permissions
echo -e "${YELLOW}Step 3: Fix permissions on Ceph${NC}"
echo -e "${GREEN}sudo chown -R $(id -u):$(id -g) $CEPH_DATA${NC}"
echo -e "${GREEN}sudo chmod -R 755 $CEPH_DATA/certs${NC}"
echo ""

# Step 4: Create symlink
echo -e "${YELLOW}Step 4: Create symlink for compatibility${NC}"
echo "After syncing is complete, run:"
echo -e "${GREEN}mv $SOURCE_DATA ${SOURCE_DATA}.old${NC}"
echo -e "${GREEN}ln -s $CEPH_DATA $SOURCE_DATA${NC}"
echo ""

# Step 5: Update docker-compose
echo -e "${YELLOW}Step 5: Update Docker Compose${NC}"
echo -e "${GREEN}cp docker-compose.ceph.yml docker-compose.yml${NC}"
echo ""

# Step 6: Start services
echo -e "${YELLOW}Step 6: Start services${NC}"
echo -e "${GREEN}docker compose up -d${NC}"
echo ""

echo -e "${YELLOW}Current status:${NC}"
echo "Source size: $(du -sh $SOURCE_DATA 2>/dev/null | cut -f1)"
echo "Ceph size: $(du -sh $CEPH_DATA 2>/dev/null | cut -f1)"
echo ""
echo "Files in Ceph:"
ls -la $CEPH_DATA 2>/dev/null | head -10