#!/bin/bash
# Script to stop Vibe Studio containers
# Usage: ./stop-container.sh <org_id> <environment> [env_type]
# env_type: nodejs (default) or flutter

if [ $# -lt 2 ]; then
    echo "Error: At least 2 parameters are required"
    echo "Usage: $0 <org_id> <environment> [env_type]"
    echo "  env_type is optional: nodejs (default) or flutter"
    exit 1
fi

ORG_ID=$1
ENVIRONMENT=$2
ENV_TYPE=${3:-nodejs}  # Default to nodejs if not specified

CONTAINER_NAME="vibe-${ENV_TYPE}-${ORG_ID}-${ENVIRONMENT}"

echo "Stopping container: ${CONTAINER_NAME}"
docker stop ${CONTAINER_NAME}
docker rm ${CONTAINER_NAME}

echo "Container ${CONTAINER_NAME} stopped and removed"