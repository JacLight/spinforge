#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# SpinForge Setup Verification Script
# This script verifies that all components are properly configured

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
PASS=0
FAIL=0
WARN=0

# Check function
check() {
    local name="$1"
    local command="$2"
    
    echo -n "Checking $name... "
    
    if eval "$command" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}✗${NC}"
        ((FAIL++))
        return 1
    fi
}

# Warning check function
check_warn() {
    local name="$1"
    local command="$2"
    
    echo -n "Checking $name... "
    
    if eval "$command" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${YELLOW}⚠${NC} (optional)"
        ((WARN++))
        return 1
    fi
}

echo "SpinForge Setup Verification"
echo "============================"
echo

echo "Core Files:"
check "docker-compose.yml" "[ -f docker-compose.yml ]"
check "Dockerfile" "[ -f Dockerfile ]"
check ".env file" "[ -f .env ]"
check ".env.example" "[ -f .env.example ]"
echo

echo "Configuration Files:"
check "nginx.conf" "[ -f nginx.conf ]"
check "prometheus.yml" "[ -f prometheus.yml ]"
check "proxy_params.conf" "[ -f proxy_params.conf ]"
check_warn "nginx SSL directory" "[ -d nginx/ssl ]"
echo

echo "Source Code:"
check "packages directory" "[ -d packages ]"
check "spinlet-core" "[ -d packages/spinlet-core ]"
check "spinlet-hub" "[ -d packages/spinlet-hub ]"
check "spinlet-builder" "[ -d packages/spinlet-builder ]"
check "spinlet-shared" "[ -d packages/spinlet-shared ]"
check "spinlet-cli" "[ -d packages/spinlet-cli ]"
echo

echo "Scripts:"
check "backup.sh" "[ -f scripts/backup.sh ]"
check "docker-manage.sh" "[ -f scripts/docker-manage.sh ]"
check "verify-setup.sh" "[ -f scripts/verify-setup.sh ]"
check_warn "install.sh" "[ -f scripts/install.sh ]"
echo

echo "Monitoring:"
check "Grafana dashboards directory" "[ -d grafana/dashboards ]"
check "Grafana dashboard JSON" "[ -f grafana/dashboards/spinforge-dashboard.json ]"
check "Grafana datasources" "[ -f grafana/datasources/prometheus.yml ]"
echo

echo "Documentation:"
check "README.md" "[ -f README.md ]"
check "README-DOCKER.md" "[ -f README-DOCKER.md ]"
check "ARCHITECTURE.md" "[ -f ARCHITECTURE.md ]"
check "KEYDB-SCHEMA.md" "[ -f KEYDB-SCHEMA.md ]"
check "QUICKSTART.md" "[ -f QUICKSTART.md ]"
echo

echo "Docker:"
check "Docker installed" "command -v docker"
check "Docker Compose installed" "command -v docker-compose"
check "Docker daemon running" "docker info"
echo

echo "Environment Variables:"
if [ -f .env ]; then
    check "KEYDB_PASSWORD set" "grep -q '^KEYDB_PASSWORD=' .env && [ -n \"\$(grep '^KEYDB_PASSWORD=' .env | cut -d= -f2)\" ]"
    check "NODE_ENV set" "grep -q '^NODE_ENV=' .env"
    check_warn "PRIMARY_DOMAIN set" "grep -q '^PRIMARY_DOMAIN=' .env"
else
    echo -e "${RED}Cannot check environment variables - .env file missing${NC}"
fi
echo

echo "Summary:"
echo "========"
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo -e "Warnings: ${YELLOW}$WARN${NC}"
echo

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ All required checks passed!${NC}"
    echo
    echo "You can now run:"
    echo "  ./scripts/docker-manage.sh start"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please fix the issues above.${NC}"
    exit 1
fi