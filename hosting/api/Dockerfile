# SpinForge API Server
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License

FROM node:22-alpine

# Install Docker CLI, OpenSSL, and netcat for health checks
RUN apk add --no-cache docker-cli openssl netcat-openbsd

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy application
COPY . .

# Make scripts executable (if they exist)
RUN if [ -f /app/entrypoint.sh ]; then chmod +x /app/entrypoint.sh; fi && \
    if [ -f /app/scripts/init-routes.sh ]; then chmod +x /app/scripts/init-routes.sh; fi

EXPOSE 8080

# Set environment for static files location
ENV STATIC_ROOT=/data/static

# Use entrypoint that initializes routes
ENTRYPOINT ["/app/entrypoint.sh"]