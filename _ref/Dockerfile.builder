# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License

FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    docker-cli \
    bash

# Install TypeScript globally
RUN npm install -g typescript

# Set working directory
WORKDIR /spinforge

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/spinlet-core/package*.json ./packages/spinlet-core/
COPY packages/spinlet-builder/package*.json ./packages/spinlet-builder/

# Install dependencies
RUN cd packages/shared && npm install
RUN cd packages/spinlet-core && npm install  
RUN cd packages/spinlet-builder && npm install

# Copy source files
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/spinlet-core ./packages/spinlet-core
COPY packages/spinlet-builder ./packages/spinlet-builder

# Build all packages
RUN cd packages/shared && npm run build
RUN cd packages/spinlet-core && npm run build
RUN cd packages/spinlet-builder && npm run build

# Set environment variables
ENV NODE_ENV=production
ENV REDIS_HOST=keydb
ENV REDIS_PORT=16378
ENV BUILD_CACHE_DIR=/spinforge/cache
ENV BUILD_OUTPUT_DIR=/spinforge/builds

# Create directories
RUN mkdir -p /spinforge/cache /spinforge/builds

# Start the builder service
CMD ["node", "/spinforge/packages/spinlet-builder/dist/service.js"]