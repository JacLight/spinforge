# SpinForge OpenResty Server
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License

FROM openresty/openresty:alpine

# Install additional packages
RUN apk add --no-cache \
    curl \
    bash \
    openssl \
    ca-certificates \
    diffutils \
    grep \
    sed

# Create necessary directories
RUN mkdir -p /var/log/nginx \
    /etc/openresty/lua \
    /var/www/static \
    /etc/letsencrypt/live/default \
    /var/www/certbot

# Copy Nginx configuration
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf

# Copy Lua scripts
COPY lua/*.lua /etc/openresty/lua/

# Copy and run certificate generation script
COPY generate-default-cert.sh /tmp/
RUN chmod +x /tmp/generate-default-cert.sh && /tmp/generate-default-cert.sh && rm /tmp/generate-default-cert.sh

# Expose ports
EXPOSE 80 443

# Start OpenResty
CMD ["openresty", "-g", "daemon off;"]