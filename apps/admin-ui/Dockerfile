# SpinForge Admin UI
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License

# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx:alpine runs envsubst on every *.template file in
# /etc/nginx/templates/ at container start, writing the rendered result
# to /etc/nginx/conf.d/ before launching nginx. This lets us inject the
# upstream hostname + listen port from env vars, so the same image runs
# under both docker-compose (names via bridge DNS) and Nomad (names via
# Consul DNS).
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Sensible defaults so the image also works on docker-compose without
# any env overrides.
ENV NGINX_LISTEN_PORT=80 \
    API_UPSTREAM=api:8080 \
    NGINX_RESOLVER=127.0.0.11

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
