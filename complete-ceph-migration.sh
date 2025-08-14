#!/bin/bash
# Complete the Ceph migration - final steps

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SOURCE_DATA="/home/imzee/spinforge/hosting/data"
CEPH_DATA="/mnt/cephfs/spinforge/hosting/data"

echo -e "${GREEN}=== Completing Ceph Migration ===${NC}"
echo ""

# Step 1: Sync certificate directories with sudo
echo -e "${YELLOW}Step 1: Syncing certificate directories (requires sudo)${NC}"
sudo rsync -avP $SOURCE_DATA/certs/accounts/ $CEPH_DATA/certs/accounts/
sudo rsync -avP $SOURCE_DATA/certs/archive/ $CEPH_DATA/certs/archive/

# Step 2: Fix permissions
echo -e "${YELLOW}Step 2: Fixing permissions${NC}"
sudo chown -R $(id -u):$(id -g) $CEPH_DATA
sudo chmod -R 755 $CEPH_DATA/certs

# Step 3: Verify sync
echo -e "${YELLOW}Step 3: Verifying sync${NC}"
echo "Source size: $(du -sh $SOURCE_DATA 2>/dev/null | cut -f1)"
echo "Ceph size: $(du -sh $CEPH_DATA 2>/dev/null | cut -f1)"

# Step 4: Create symlink
echo -e "${YELLOW}Step 4: Creating symlink for backward compatibility${NC}"
if [ ! -L "$SOURCE_DATA" ]; then
    if [ -d "$SOURCE_DATA" ]; then
        mv $SOURCE_DATA ${SOURCE_DATA}.old
        echo "Moved original data to ${SOURCE_DATA}.old"
    fi
    ln -s $CEPH_DATA $SOURCE_DATA
    echo "Created symlink: $SOURCE_DATA -> $CEPH_DATA"
else
    echo "Symlink already exists"
fi

# Step 5: Update docker-compose.yml
echo -e "${YELLOW}Step 5: Updating Docker Compose configuration${NC}"
if [ -f "docker-compose.ceph.yml" ]; then
    cp docker-compose.yml docker-compose.yml.pre-ceph
    cp docker-compose.ceph.yml docker-compose.yml
    echo "Docker Compose configuration updated"
    echo "Previous config backed up to docker-compose.yml.pre-ceph"
else
    echo -e "${RED}Warning: docker-compose.ceph.yml not found${NC}"
fi

# Step 6: Start services
echo -e "${YELLOW}Step 6: Starting services${NC}"
read -p "Start services now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose up -d
    echo ""
    echo "Waiting for services to start..."
    sleep 5
    docker ps
else
    echo "Skipping service start. Run 'docker compose up -d' when ready."
fi

echo ""
echo -e "${GREEN}=== Migration Complete ===${NC}"
echo ""
echo "Your SpinForge hosting data is now on Ceph at: $CEPH_DATA"
echo "Original data backed up at: ${SOURCE_DATA}.old"
echo ""
echo "To verify everything is working:"
echo "1. Check services: docker ps"
echo "2. Test admin UI: curl -k https://admin.spinforge.dev/"
echo "3. Check logs: docker compose logs"
echo ""
echo "Once verified, you can remove the old data:"
echo "  rm -rf ${SOURCE_DATA}.old"