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
    /etc/openresty/conf.d \
    /var/www/static \
    /etc/letsencrypt/live/default \
    /var/www/certbot \
 && printf 'set_real_ip_from 127.0.0.1;\nreal_ip_header proxy_protocol;\nreal_ip_recursive on;\n' \
    > /etc/openresty/conf.d/real_ip.conf

# Copy Nginx configuration
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf

# Copy Lua scripts
COPY lua/*.lua /etc/openresty/lua/

# Copy and run certificate generation script
COPY generate-default-cert.sh /tmp/
RUN chmod +x /tmp/generate-default-cert.sh && /tmp/generate-default-cert.sh && rm /tmp/generate-default-cert.sh

# Renders /etc/openresty/conf.d/real_ip.conf from HAPROXY_TRUSTED_IP on
# every container start, then execs the CMD below.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose ports
EXPOSE 80 443

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["openresty", "-g", "daemon off;"]