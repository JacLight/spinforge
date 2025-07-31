FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy application
COPY . .

EXPOSE 8080

CMD ["node", "server-openresty.js"]