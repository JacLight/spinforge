# SpinForge API Server
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License

FROM node:22-alpine

# Install Docker CLI
RUN apk add --no-cache docker-cli

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy application
COPY . .

EXPOSE 8080

# Set environment for static files location
ENV STATIC_ROOT=/data/static

CMD ["node", "server-openresty.js"]