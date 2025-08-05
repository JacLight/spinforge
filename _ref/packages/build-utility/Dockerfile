# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License

FROM node:20-alpine as builder

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    bash \
    curl \
    tar \
    gzip

# Install Flutter SDK
RUN apk add --no-cache bash curl git unzip xz \
    && git clone https://github.com/flutter/flutter.git -b stable /flutter \
    && /flutter/bin/flutter doctor

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh

ENV PATH="/flutter/bin:/root/.deno/bin:${PATH}"

WORKDIR /build-utility

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the utility
RUN npm run build

# Create final image
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    bash \
    curl \
    tar \
    gzip \
    docker-cli

# Install Flutter SDK
RUN apk add --no-cache bash curl git unzip xz \
    && git clone https://github.com/flutter/flutter.git -b stable /flutter \
    && /flutter/bin/flutter doctor

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh

ENV PATH="/flutter/bin:/root/.deno/bin:${PATH}"

WORKDIR /spinforge-build

# Copy built application
COPY --from=builder /build-utility/dist ./dist
COPY --from=builder /build-utility/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Create build directories
RUN mkdir -p /builds /cache /workspace

# Set up entrypoint
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]