# SpinForge MCP Discovery Server
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY index.js ./
COPY discovery-server.js ./
COPY .env.example ./.env

# Expose MCP discovery port
EXPOSE 3000

# Start MCP discovery server
CMD ["node", "discovery-server.js"]