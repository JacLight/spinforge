#!/bin/sh
# Initialize internal service routes with IP addresses
# This runs on container startup to ensure routes survive restarts

echo "Initializing internal service routes..."

# Wait for Redis to be ready
for i in 1 2 3 4 5; do
  if nc -z ${REDIS_HOST:-172.18.0.10} ${REDIS_PORT:-16378}; then
    echo "Redis is ready"
    break
  fi
  echo "Waiting for Redis..."
  sleep 2
done

# Create the setup script inline with environment variables
cat > /tmp/setup-routes.js << 'EOF'
const redis = require('redis');

async function setupRoutes() {
  const redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || '172.18.0.10',
      port: process.env.REDIS_PORT || 16378
    },
    password: process.env.REDIS_PASSWORD || '',
    database: process.env.REDIS_DB || 1
  });

  try {
    await redisClient.connect();
    console.log('Connected to Redis');

    // Use IP addresses from environment or defaults
    const API_IP = process.env.API_IP || '172.18.0.12';
    const ADMIN_IP = process.env.ADMIN_UI_IP || '172.18.0.14';
    const WEBSITE_IP = process.env.WEBSITE_IP || '172.18.0.15';

    const routes = [
      {
        domain: 'admin.spinforge.dev',
        type: 'proxy',
        target: `http://${ADMIN_IP}:80`,
        ssl_enabled: false,
        description: 'SpinForge Admin UI'
      },
      {
        domain: 'api.spinforge.dev',
        type: 'proxy',
        target: `http://${API_IP}:8080`,
        ssl_enabled: false,
        description: 'SpinForge API'
      },
      {
        domain: 'www.spinforge.dev',
        type: 'proxy',
        target: `http://${WEBSITE_IP}:3000`,
        ssl_enabled: false,
        description: 'SpinForge Website'
      },
      {
        domain: 'admin.localhost',
        type: 'proxy',
        target: `http://${ADMIN_IP}:80`,
        ssl_enabled: false,
        description: 'SpinForge Admin UI (localhost)'
      },
      {
        domain: 'api.localhost',
        type: 'proxy',
        target: `http://${API_IP}:8080`,
        ssl_enabled: false,
        description: 'SpinForge API (localhost)'
      }
    ];

    for (const route of routes) {
      route.createdAt = new Date().toISOString();
      route.updatedAt = new Date().toISOString();
      await redisClient.set(`site:${route.domain}`, JSON.stringify(route));
      console.log(`Created route: ${route.domain} -> ${route.target}`);
    }

    console.log('Routes initialized successfully');
  } catch (error) {
    console.error('Error initializing routes:', error);
    process.exit(1);
  } finally {
    await redisClient.quit();
  }
}

setupRoutes();
EOF

# Run the setup script from app directory where node_modules exists
cd /app && node /tmp/setup-routes.js

echo "Route initialization complete"