#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# SpinForge Environment Setup Script
# Usage: ./scripts/env-setup.sh [development|staging|production]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default environment
ENV=${1:-development}

# Validate environment
if [[ ! "$ENV" =~ ^(development|staging|production)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENV'${NC}"
    echo "Usage: $0 [development|staging|production]"
    exit 1
fi

echo -e "${GREEN}Setting up SpinForge for ${YELLOW}$ENV${GREEN} environment...${NC}"

# Create .env file from template
if [ -f ".env.$ENV" ]; then
    cp ".env.$ENV" .env
    echo -e "${GREEN}✓ Created .env from .env.$ENV${NC}"
else
    echo -e "${RED}Error: .env.$ENV not found${NC}"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Create necessary directories
echo -e "${GREEN}Creating necessary directories...${NC}"
mkdir -p "$SPINFORGE_DEPLOYMENTS"
mkdir -p logs
mkdir -p data/redis
mkdir -p data/builds

# Set up authentication for CLI
if [ "$ENV" = "development" ]; then
    # Create local development auth config
    mkdir -p ~/.spinforge
    cat > ~/.spinforge/config.json <<EOF
{
  "token": "local-dev-token-${ENV}",
  "customerId": "local-dev",
  "apiUrl": "$SPINFORGE_API_URL",
  "authMethod": "token"
}
EOF
    echo -e "${GREEN}✓ Created local development auth config${NC}"
fi

# Build shared packages if in development
if [ "$ENV" = "development" ]; then
    echo -e "${GREEN}Building shared packages...${NC}"
    (cd packages/shared && npm install && npm run build) || true
    (cd packages/spinlet-core && npm install && npm run build) || true
    echo -e "${GREEN}✓ Built shared packages${NC}"
fi

# Docker compose file selection
COMPOSE_FILE="docker-compose.env.yml"
if [ "$ENV" = "production" ]; then
    COMPOSE_FILE="docker-compose.yml"
fi

# Export for docker-compose
export COMPOSE_FILE

echo -e "${GREEN}Environment setup complete!${NC}"
echo ""
echo "Current configuration:"
echo "  Environment:    $ENV"
echo "  API URL:        $SPINFORGE_API_URL"
echo "  Web URL:        $SPINFORGE_WEB_URL"
echo "  Redis Host:     $REDIS_HOST"
echo "  Deployments:    $SPINFORGE_DEPLOYMENTS"
echo ""
echo "To start services:"
echo "  docker-compose up -d"
echo ""
echo "To use the CLI:"
echo "  export NODE_ENV=$ENV"
echo "  spinforge --help"