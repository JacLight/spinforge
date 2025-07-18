# Multi-stage Dockerfile for all SpinForge components

# Base stage with common dependencies
FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++ git
WORKDIR /app

# Builder stage - copy everything and build
FROM base AS builder
COPY . .
RUN npm install
RUN npm run build

# SpinHub runtime
FROM node:20-alpine AS spinhub
RUN apk add --no-cache curl
WORKDIR /spinforge

# Copy everything from builder (including node_modules)
COPY --from=builder /app ./

# Remove dev dependencies
RUN npm prune --omit=dev

# Create necessary directories
RUN mkdir -p /spinforge/builds /spinforge/data /spinforge/logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/_health || exit 1

EXPOSE 8080
CMD ["node", "packages/spinlet-hub/dist/server.js"]

# Builder service
FROM node:20-alpine AS builder-service
RUN apk add --no-cache git python3 make g++
WORKDIR /spinforge

# Copy all packages for building
COPY package*.json ./
COPY lerna.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/spinlet-builder/package*.json ./packages/spinlet-builder/
RUN npm install --workspaces --if-present --omit=dev

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/spinlet-builder/dist ./packages/spinlet-builder/dist

# Create build directories
RUN mkdir -p /spinforge/builds /spinforge/cache

EXPOSE 8081
CMD ["node", "packages/spinlet-builder/dist/service.js"]

# CLI tool
FROM node:20-alpine AS cli
WORKDIR /spinforge

# Copy CLI package
COPY package*.json ./
COPY lerna.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/spinlet-cli/package*.json ./packages/spinlet-cli/
RUN npm install --workspaces --if-present --omit=dev

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/spinlet-cli/dist ./packages/spinlet-cli/dist

# Make CLI executable
RUN chmod +x packages/spinlet-cli/dist/cli.js
RUN ln -s /spinforge/packages/spinlet-cli/dist/cli.js /usr/local/bin/spinforge

ENTRYPOINT ["spinforge"]

# All-in-one image (for development)
FROM node:20-alpine AS all-in-one
RUN apk add --no-cache curl git python3 make g++ docker-cli
WORKDIR /spinforge

# Copy everything
COPY --from=builder /app .

# Install all dependencies
RUN npm install --workspaces --if-present

# Create directories
RUN mkdir -p /spinforge/builds /spinforge/data /spinforge/logs

# Make CLI available
RUN chmod +x packages/spinlet-cli/dist/cli.js
RUN ln -s /spinforge/packages/spinlet-cli/dist/cli.js /usr/local/bin/spinforge

EXPOSE 8080
CMD ["node", "packages/spinlet-hub/dist/server.js"]