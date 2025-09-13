#!/bin/bash
# Unified script to start Vibe Studio containers
# Usage: ./start-container.sh <org_id> <environment> <api_key> [env_type] [port] [preview_port] [data_path] [base_url]

# Check if minimum parameters are provided
if [ $# -lt 3 ]; then
    echo "Error: At least 3 parameters are required"
    echo "Usage: $0 <org_id> <environment> <api_key> [env_type] [port] [preview_port] [data_path] [base_url]"
    echo "  Required:"
    echo "    org_id       - Organization ID"
    echo "    environment  - Environment name (dev, staging, prod, etc.)"
    echo "    api_key      - API key for authentication"
    echo "  Optional:"
    echo "    env_type     - nodejs (default) or flutter"
    echo "    port         - Main port (default: 3000)"
    echo "    preview_port - Preview port (default: 8888)"
    echo "    data_path    - Data storage path (default: ~/vibe-studio-data)"
    echo "    base_url     - API base URL (default: https://appengine.appmint.io)"
    exit 1
fi

# Required parameters
ORG_ID=$1
ENVIRONMENT=$2
API_KEY=$3

# Optional parameters with defaults
ENV_TYPE=${4:-nodejs}
PORT=${5:-3000}
PREVIEW_PORT=${6:-8888}
VIBE_DATA_PATH=${7:-~/vibe-studio-data}
BASE_URL=${8:-https://appengine.appmint.io}

# Validate env_type
if [[ "$ENV_TYPE" != "nodejs" && "$ENV_TYPE" != "flutter" ]]; then
    echo "Error: env_type must be 'nodejs' or 'flutter'"
    exit 1
fi

# Create volume directories if they don't exist
# First create the parent directories if needed
mkdir -p ${VIBE_DATA_PATH}/${ORG_ID}/${ENVIRONMENT}
mkdir -p ${VIBE_DATA_PATH}/${ORG_ID}/${ENVIRONMENT}/workspace
mkdir -p ${VIBE_DATA_PATH}/${ORG_ID}/${ENVIRONMENT}/deploy

# Set proper permissions on the directories (if running as root/sudo)
if [ "$EUID" -eq 0 ]; then
    chmod 777 ${VIBE_DATA_PATH}/${ORG_ID}/${ENVIRONMENT}/workspace
    chmod 777 ${VIBE_DATA_PATH}/${ORG_ID}/${ENVIRONMENT}/deploy
fi

echo "Starting ${ENV_TYPE} container with:"
echo "  ORG_ID: $ORG_ID"
echo "  ENVIRONMENT: $ENVIRONMENT"
echo "  API_KEY: $API_KEY"
echo "  ENV_TYPE: $ENV_TYPE"
echo "  PORT: $PORT"
echo "  PREVIEW_PORT: $PREVIEW_PORT"
echo "  DATA_PATH: $VIBE_DATA_PATH"
echo "  BASE_URL: $BASE_URL"
echo "  APP_PREVIEW_URL: https://preview-${ENVIRONMENT}-dev-${ORG_ID}.appmint.app"
echo "  APP_DEV_URL: https://${ENVIRONMENT}-dev-${ORG_ID}.appmint.app"
echo "  APP_PROD_URL: https://${ENVIRONMENT}-app-${ORG_ID}.appmint.app"

# Set container name and image based on env_type
CONTAINER_NAME="vibe-${ENV_TYPE}-${ORG_ID}-${ENVIRONMENT}"
if [ "$ENV_TYPE" = "nodejs" ]; then
    IMAGE="jaclight/platform:vibe-studio-nodejs-latest"
    EXTRA_ENV="-e NODE_ENV=development"
elif [ "$ENV_TYPE" = "flutter" ]; then
    IMAGE="jaclight/platform:vibe-studio-flutter-latest"
    EXTRA_ENV="-e FLUTTER_HOME=/opt/flutter"
fi

# Stop and remove existing container if it exists
docker stop ${CONTAINER_NAME} 2>/dev/null || true
docker rm ${CONTAINER_NAME} 2>/dev/null || true

# Run the container
docker run -d \
  --name ${CONTAINER_NAME} \
  -p ${PORT}:3000 \
  -p ${PREVIEW_PORT}:8888 \
  -v ${VIBE_DATA_PATH}/${ORG_ID}/${ENVIRONMENT}/workspace:/workspace \
  -v ${VIBE_DATA_PATH}/${ORG_ID}/${ENVIRONMENT}/deploy:/deploy \
  ${EXTRA_ENV} \
  -e ORG_ID=${ORG_ID} \
  -e API_KEY=${API_KEY} \
  -e ENV_NAME=${ENVIRONMENT} \
  -e APPENGINE_ENDPOINT=${BASE_URL} \
  -e APP_ENGINE_BASE_URL=${BASE_URL} \
  -e APP_ENGINE_DEV_ENVIRONMENT=${ENVIRONMENT} \
  -e APP_ENGINE_ORG_ID=${ORG_ID} \
  -e APP_ENGINE_API_KEY=${API_KEY} \
  -e APP_PREVIEW_URL="https://preview-${ENVIRONMENT}-dev-${ORG_ID}.appmint.app" \
  -e APP_DEV_URL="https://${ENVIRONMENT}-dev-${ORG_ID}.appmint.app" \
  -e APP_PROD_URL="https://${ENVIRONMENT}-app-${ORG_ID}.appmint.app" \
  --restart unless-stopped \
  ${IMAGE}

echo "Started ${ENV_TYPE} container for $ORG_ID-$ENVIRONMENT on port $PORT"