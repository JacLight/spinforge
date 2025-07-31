FROM openresty/openresty:alpine

# Install additional packages
RUN apk add --no-cache \
    curl \
    bash

# Create necessary directories
RUN mkdir -p /var/log/nginx \
    /etc/openresty/lua \
    /var/www/static

# Copy Nginx configuration
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf

# Copy Lua scripts
COPY lua/*.lua /etc/openresty/lua/

# Expose ports
EXPOSE 80 443

# Start OpenResty
CMD ["openresty", "-g", "daemon off;"]