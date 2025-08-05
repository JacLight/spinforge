#!/bin/bash
# SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# Create default certificate directory
mkdir -p /etc/letsencrypt/live/default

# Generate self-signed certificate for default server
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/letsencrypt/live/default/privkey.pem \
    -out /etc/letsencrypt/live/default/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=SpinForge/CN=localhost"

echo "Default SSL certificate generated successfully"