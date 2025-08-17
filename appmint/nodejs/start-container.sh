#!/bin/bash
# Wrapper script for API to start containers with custom environment
# Usage: ./start-container.sh <org_id> <environment> <api_key> <base_url> <port> <preview_port> <data_path>

# Check if all parameters are provided
if [ $# -ne 7 ]; then
    echo "Error: All 7 parameters are required"
    echo "Usage: $0 <org_id> <environment> <api_key> <base_url> <port> <preview_port> <data_path>"
    exit 1
fi

ORG_ID=$1
ENVIRONMENT=$2
API_KEY=$3
BASE_URL=$4
PORT=${5:-3000}
PREVIEW_PORT=${6:-8888}
VIBE_DATA_PATH=$7

# Export variables for docker-compose
export APP_ENGINE_ORG_ID=$ORG_ID
export APP_ENGINE_DEV_ENVIRONMENT=$ENVIRONMENT
export APP_ENGINE_API_KEY=$API_KEY
export APP_ENGINE_BASE_URL=$BASE_URL
export DEV_PORT=$PORT
export PREVIEW_PORT=$PREVIEW_PORT

# Export data path for docker-compose
export VIBE_DATA_PATH=$VIBE_DATA_PATH

# Create volume directories if they don't exist
mkdir -p ${VIBE_DATA_PATH}/${ORG_ID}/${ENVIRONMENT}/{workspace,deploy}

echo "Starting Node.js container with:"
echo "  ORG_ID: $ORG_ID"
echo "  ENVIRONMENT: $ENVIRONMENT"
echo "  API_KEY: $API_KEY"
echo "  BASE_URL: $BASE_URL"
echo "  DEV_PORT: $DEV_PORT"
echo "  PREVIEW_PORT: $PREVIEW_PORT"
echo "  DATA_PATH: $VIBE_DATA_PATH"

# Start container with unique project name for each customer
docker-compose -p ${ORG_ID}-${ENVIRONMENT} up -d

echo "Started container for $ORG_ID-$ENVIRONMENT on port $DEV_PORT"