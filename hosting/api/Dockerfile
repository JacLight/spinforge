FROM node:22-alpine

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