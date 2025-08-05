# SpinForge Recipes & Examples

## Table of Contents
1. [Quick Start Examples](#quick-start-examples)
2. [Framework-Specific Recipes](#framework-specific-recipes)
3. [Common Deployment Patterns](#common-deployment-patterns)
4. [Advanced Configurations](#advanced-configurations)
5. [Integration Examples](#integration-examples)
6. [Performance Optimization](#performance-optimization)
7. [Troubleshooting Recipes](#troubleshooting-recipes)

## Quick Start Examples

### Hello World Express App

**1. Create the app:**
```bash
mkdir hello-spinforge
cd hello-spinforge
```

**2. Create package.json:**
```json
{
  "name": "hello-spinforge",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

**3. Create server.js:**
```javascript
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <h1>Hello from SpinForge!</h1>
    <p>Spinlet ID: ${process.env.SPINLET_ID}</p>
    <p>Customer: ${process.env.CUSTOMER_ID}</p>
    <p>Running on port: ${port}</p>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

**4. Create deploy.yaml:**
```yaml
name: hello-spinforge
domain: hello.localhost
customerId: demo-user
framework: express
```

**5. Deploy:**
```bash
# Option A: Hot deployment
cp -r ../hello-spinforge /path/to/spinforge/deployments/

# Option B: Via UI
# Upload as ZIP file through the web interface

# Option C: Git deployment
git init && git add . && git commit -m "Initial commit"
git push origin main
# Then use Git URL in deployment
```

### Static Website

**1. Create structure:**
```bash
my-website/
├── deploy.yaml
├── index.html
├── style.css
└── script.js
```

**2. index.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>My SpinForge Site</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>Welcome to SpinForge</h1>
    <p id="message">Loading...</p>
    <button onclick="updateMessage()">Click Me</button>
  </div>
  <script src="script.js"></script>
</body>
</html>
```

**3. deploy.yaml:**
```yaml
name: my-static-site
domain: 
  - mysite.example.com
  - www.mysite.example.com
customerId: customer-123
framework: static

# Optional: Build step for modern frameworks
build:
  command: npm run build
  outputDir: dist
```

## Framework-Specific Recipes

### Express.js with TypeScript

**1. Project structure:**
```
express-ts-app/
├── src/
│   ├── server.ts
│   ├── routes/
│   └── middleware/
├── package.json
├── tsconfig.json
└── deploy.yaml
```

**2. package.json:**
```json
{
  "name": "express-ts-app",
  "version": "1.0.0",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node-dev src/server.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.19.9",
    "typescript": "^5.8.3",
    "ts-node-dev": "^2.0.0"
  }
}
```

**3. tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**4. src/server.ts:**
```typescript
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Express TypeScript API',
    environment: process.env.NODE_ENV,
    spinletId: process.env.SPINLET_ID
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

**5. deploy.yaml:**
```yaml
name: express-ts-api
domain: api.example.com
customerId: customer-123
framework: express

build:
  command: npm run build
  outputDir: dist

resources:
  memory: 512MB
  cpu: 0.5

env:
  NODE_ENV: production
  API_VERSION: v1
```

### Next.js Application

**1. Create Next.js app:**
```bash
npx create-next-app@latest my-nextjs-app --typescript --tailwind --app
cd my-nextjs-app
```

**2. Modify package.json:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p $PORT",
    "lint": "next lint"
  }
}
```

**3. Create deploy.yaml:**
```yaml
name: my-nextjs-app
domain: nextapp.example.com
customerId: customer-123
framework: nextjs

build:
  command: npm run build
  outputDir: .next

resources:
  memory: 1GB
  cpu: 1

env:
  NODE_ENV: production
  NEXT_PUBLIC_API_URL: https://api.example.com
```

**4. Add health check (app/api/health/route.ts):**
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}
```

### Remix Application

**1. Create Remix app:**
```bash
npx create-remix@latest my-remix-app
cd my-remix-app
```

**2. Update package.json:**
```json
{
  "scripts": {
    "build": "remix build",
    "dev": "remix dev",
    "start": "remix-serve build/index.js"
  }
}
```

**3. deploy.yaml:**
```yaml
name: my-remix-app
domain: remixapp.example.com
customerId: customer-123
framework: remix

build:
  command: npm run build
  
resources:
  memory: 768MB
  cpu: 0.75

env:
  NODE_ENV: production
  SESSION_SECRET: ${SECRET_SESSION_KEY}
```

### Python Flask App (via Custom Framework)

**1. Project structure:**
```
flask-app/
├── app.py
├── requirements.txt
├── package.json  # For SpinForge
├── server.js     # Node.js wrapper
└── deploy.yaml
```

**2. app.py:**
```python
from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({
        'message': 'Flask on SpinForge',
        'spinlet_id': os.environ.get('SPINLET_ID')
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

**3. server.js (Node wrapper):**
```javascript
const { spawn } = require('child_process');
const express = require('express');
const httpProxy = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 3000;

// Start Python Flask app
const python = spawn('python', ['app.py']);

python.stdout.on('data', (data) => {
  console.log(`Flask: ${data}`);
});

python.stderr.on('data', (data) => {
  console.error(`Flask Error: ${data}`);
});

// Wait for Flask to start
setTimeout(() => {
  // Proxy all requests to Flask
  app.use('/', httpProxy.createProxyMiddleware({
    target: 'http://localhost:5000',
    changeOrigin: true
  }));

  app.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
  });
}, 2000);

// Handle shutdown
process.on('SIGTERM', () => {
  python.kill();
  process.exit(0);
});
```

**4. package.json:**
```json
{
  "name": "flask-spinforge",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "postinstall": "pip install -r requirements.txt"
  },
  "dependencies": {
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6"
  }
}
```

## Common Deployment Patterns

### Multi-Environment Deployment

**1. Structure:**
```
my-app/
├── deploy/
│   ├── dev.yaml
│   ├── staging.yaml
│   └── prod.yaml
├── src/
└── package.json
```

**2. dev.yaml:**
```yaml
name: myapp-dev
domain: dev.myapp.example.com
customerId: myapp-team
framework: express

env:
  NODE_ENV: development
  API_URL: https://dev-api.example.com
  DEBUG: "true"

resources:
  memory: 256MB
  cpu: 0.25
```

**3. staging.yaml:**
```yaml
name: myapp-staging
domain: staging.myapp.example.com
customerId: myapp-team
framework: express

env:
  NODE_ENV: staging
  API_URL: https://staging-api.example.com
  DEBUG: "false"

resources:
  memory: 512MB
  cpu: 0.5

healthCheck:
  path: /health
  interval: 30
  timeout: 5
```

**4. prod.yaml:**
```yaml
name: myapp-prod
domain: 
  - myapp.example.com
  - www.myapp.example.com
customerId: myapp-team
framework: express

env:
  NODE_ENV: production
  API_URL: https://api.example.com
  DEBUG: "false"

resources:
  memory: 1GB
  cpu: 1

scaling:
  min: 2
  max: 10
  targetCPU: 70

monitoring:
  alerts:
    - type: error-rate
      threshold: 1
      action: email
```

### Microservices Pattern

**1. API Gateway:**
```yaml
# gateway/deploy.yaml
name: api-gateway
domain: api.example.com
customerId: platform-team
framework: express

env:
  SERVICES:
    - USER_SERVICE: http://user-service.internal
    - ORDER_SERVICE: http://order-service.internal
    - PAYMENT_SERVICE: http://payment-service.internal

resources:
  memory: 1GB
  cpu: 1
```

**2. User Service:**
```yaml
# services/user/deploy.yaml
name: user-service
domain: user-service.internal
customerId: platform-team
framework: express

env:
  DATABASE_URL: ${SECRET_USER_DB_URL}
  REDIS_URL: ${SECRET_REDIS_URL}

resources:
  memory: 512MB
  cpu: 0.5
```

**3. Gateway Implementation:**
```javascript
const express = require('express');
const httpProxy = require('http-proxy-middleware');
const app = express();

// Route to user service
app.use('/api/users', httpProxy.createProxyMiddleware({
  target: process.env.USER_SERVICE,
  changeOrigin: true,
  pathRewrite: { '^/api/users': '' }
}));

// Route to order service
app.use('/api/orders', httpProxy.createProxyMiddleware({
  target: process.env.ORDER_SERVICE,
  changeOrigin: true,
  pathRewrite: { '^/api/orders': '' }
}));

app.listen(process.env.PORT);
```

### Scheduled Jobs Pattern

**1. Cron job wrapper:**
```javascript
// cron-wrapper.js
const cron = require('node-cron');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', jobs: Object.keys(jobs) });
});

// Define jobs
const jobs = {
  'daily-backup': {
    schedule: '0 2 * * *',  // 2 AM daily
    task: () => require('./jobs/backup').run()
  },
  'hourly-sync': {
    schedule: '0 * * * *',  // Every hour
    task: () => require('./jobs/sync').run()
  },
  'cleanup': {
    schedule: '0 0 * * 0',  // Weekly Sunday midnight
    task: () => require('./jobs/cleanup').run()
  }
};

// Schedule all jobs
Object.entries(jobs).forEach(([name, job]) => {
  cron.schedule(job.schedule, async () => {
    console.log(`Running job: ${name}`);
    try {
      await job.task();
      console.log(`Job completed: ${name}`);
    } catch (error) {
      console.error(`Job failed: ${name}`, error);
    }
  });
});

app.listen(port, () => {
  console.log(`Cron service running on port ${port}`);
});
```

**2. deploy.yaml:**
```yaml
name: cron-jobs
domain: cron.internal
customerId: platform-team
framework: express

resources:
  memory: 256MB
  cpu: 0.25

env:
  TZ: America/New_York
  BACKUP_BUCKET: s3://backups
  CLEANUP_DAYS: 30
```

## Advanced Configurations

### WebSocket Application

**1. server.js:**
```javascript
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('public'));

// WebSocket handling
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    // Broadcast to all clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    connections: wss.clients.size
  });
});

server.listen(process.env.PORT || 3000);
```

**2. Client (public/index.html):**
```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Chat</title>
</head>
<body>
  <div id="messages"></div>
  <input type="text" id="messageInput" placeholder="Type a message...">
  <button onclick="sendMessage()">Send</button>

  <script>
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onmessage = (event) => {
      const messages = document.getElementById('messages');
      messages.innerHTML += `<p>${event.data}</p>`;
    };
    
    function sendMessage() {
      const input = document.getElementById('messageInput');
      ws.send(input.value);
      input.value = '';
    }
  </script>
</body>
</html>
```

**3. deploy.yaml:**
```yaml
name: websocket-chat
domain: chat.example.com
customerId: customer-123
framework: express

# WebSocket requires sticky sessions in multi-instance
scaling:
  min: 1
  max: 1  # Single instance for now

resources:
  memory: 256MB
  cpu: 0.5
```

### Server-Sent Events (SSE)

**1. SSE Server:**
```javascript
const express = require('express');
const app = express();

// Store active connections
const clients = new Set();

// SSE endpoint
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const clientId = Date.now();
  const client = { id: clientId, res };
  clients.add(client);

  // Send initial message
  res.write(`data: Connected with ID ${clientId}\n\n`);

  // Remove client on disconnect
  req.on('close', () => {
    clients.delete(client);
  });
});

// Broadcast endpoint
app.post('/broadcast', express.json(), (req, res) => {
  const message = req.body.message;
  
  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify({ message, time: new Date() })}\n\n`);
  });
  
  res.json({ sent: clients.size });
});

app.listen(process.env.PORT || 3000);
```

### GraphQL API

**1. Install dependencies:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "express-graphql": "^0.12.0",
    "graphql": "^16.6.0"
  }
}
```

**2. server.js:**
```javascript
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');

// GraphQL schema
const schema = buildSchema(`
  type Query {
    hello: String
    user(id: ID!): User
    users: [User]
  }
  
  type User {
    id: ID!
    name: String
    email: String
    spinletInfo: SpinletInfo
  }
  
  type SpinletInfo {
    spinletId: String
    customerId: String
    environment: String
  }
  
  type Mutation {
    createUser(name: String!, email: String!): User
  }
`);

// Mock data
const users = [
  { id: '1', name: 'John Doe', email: 'john@example.com' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
];

// Resolvers
const root = {
  hello: () => 'Hello from SpinForge GraphQL!',
  user: ({ id }) => users.find(u => u.id === id),
  users: () => users,
  createUser: ({ name, email }) => {
    const user = { id: String(users.length + 1), name, email };
    users.push(user);
    return user;
  }
};

// Add SpinletInfo to users
users.forEach(user => {
  user.spinletInfo = {
    spinletId: process.env.SPINLET_ID,
    customerId: process.env.CUSTOMER_ID,
    environment: process.env.NODE_ENV
  };
});

const app = express();

app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,  // Enable GraphQL IDE
}));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(process.env.PORT || 4000);
```

## Integration Examples

### Database Connections

**1. PostgreSQL with Connection Pooling:**
```javascript
const express = require('express');
const { Pool } = require('pg');

const app = express();

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware to attach db to requests
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Example route
app.get('/users', async (req, res) => {
  try {
    const result = await req.db.query('SELECT * FROM users LIMIT 10');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check with DB ping
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

app.listen(process.env.PORT || 3000);
```

**2. MongoDB with Mongoose:**
```javascript
const express = require('express');
const mongoose = require('mongoose');

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10
});

// Define schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Routes
app.get('/users', async (req, res) => {
  const users = await User.find().limit(10);
  res.json(users);
});

app.post('/users', express.json(), async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 3000);
```

### External API Integration

**1. With Rate Limiting and Caching:**
```javascript
const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');

const app = express();
const cache = new NodeCache({ stdTTL: 600 }); // 10 minute cache

// Rate limiter for external API calls
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many API requests'
});

// External API wrapper
app.get('/weather/:city', apiLimiter, async (req, res) => {
  const { city } = req.params;
  const cacheKey = `weather:${city}`;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }
  
  try {
    // Call external API
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: city,
          appid: process.env.WEATHER_API_KEY,
          units: 'metric'
        },
        timeout: 5000
      }
    );
    
    const data = {
      city: response.data.name,
      temperature: response.data.main.temp,
      description: response.data.weather[0].description,
      timestamp: new Date()
    };
    
    // Cache the result
    cache.set(cacheKey, data);
    
    res.json({ ...data, cached: false });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch weather data',
      message: error.message 
    });
  }
});

app.listen(process.env.PORT || 3000);
```

### File Upload Handling

**1. With Multer:**
```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const app = express();

// Configure multer
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = 'uploads/';
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueName}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    url: `/uploads/${req.file.filename}`
  });
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

app.listen(process.env.PORT || 3000);
```

## Performance Optimization

### Caching Strategies

**1. Redis Caching:**
```javascript
const express = require('express');
const Redis = require('ioredis');

const app = express();
const redis = new Redis(process.env.REDIS_URL);

// Cache middleware
const cacheMiddleware = (duration = 300) => async (req, res, next) => {
  const key = `cache:${req.originalUrl}`;
  
  try {
    const cached = await redis.get(key);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (error) {
    console.error('Cache error:', error);
  }
  
  // Store original json method
  const originalJson = res.json;
  
  // Override json method to cache response
  res.json = function(data) {
    redis.setex(key, duration, JSON.stringify(data));
    originalJson.call(this, data);
  };
  
  next();
};

// Use cache for expensive operations
app.get('/expensive-operation', cacheMiddleware(600), async (req, res) => {
  // Simulate expensive operation
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  res.json({
    result: 'Expensive calculation result',
    timestamp: new Date()
  });
});

app.listen(process.env.PORT || 3000);
```

**2. CDN Integration:**
```javascript
// Configure for CDN
app.use(express.static('public', {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));
```

### Database Optimization

**1. Query Optimization:**
```javascript
// Bad: N+1 query problem
app.get('/posts-bad', async (req, res) => {
  const posts = await db.query('SELECT * FROM posts');
  
  for (let post of posts) {
    post.comments = await db.query(
      'SELECT * FROM comments WHERE post_id = $1',
      [post.id]
    );
  }
  
  res.json(posts);
});

// Good: Single query with join
app.get('/posts-good', async (req, res) => {
  const result = await db.query(`
    SELECT 
      p.*, 
      json_agg(
        json_build_object(
          'id', c.id,
          'text', c.text,
          'author', c.author
        )
      ) as comments
    FROM posts p
    LEFT JOIN comments c ON c.post_id = p.id
    GROUP BY p.id
  `);
  
  res.json(result.rows);
});
```

### Memory Optimization

**1. Stream Large Files:**
```javascript
const express = require('express');
const fs = require('fs');
const app = express();

// Bad: Loads entire file into memory
app.get('/download-bad', (req, res) => {
  const file = fs.readFileSync('large-file.zip');
  res.send(file);
});

// Good: Streams file
app.get('/download-good', (req, res) => {
  const stream = fs.createReadStream('large-file.zip');
  stream.pipe(res);
});

// Better: With error handling and headers
app.get('/download-better', (req, res) => {
  const filePath = 'large-file.zip';
  const stat = fs.statSync(filePath);
  
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Length': stat.size,
    'Content-Disposition': 'attachment; filename="large-file.zip"'
  });
  
  const stream = fs.createReadStream(filePath);
  stream.on('error', (error) => {
    res.status(500).end();
  });
  stream.pipe(res);
});
```

## Troubleshooting Recipes

### Debug Mode Application

**1. Debug wrapper:**
```javascript
const express = require('express');
const app = express();

// Debug middleware
if (process.env.DEBUG === 'true') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Query:', req.query);
    next();
  });
}

// System info endpoint (debug only)
if (process.env.DEBUG === 'true') {
  app.get('/debug/info', (req, res) => {
    res.json({
      spinletId: process.env.SPINLET_ID,
      customerId: process.env.CUSTOMER_ID,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: process.env
    });
  });
}

// Your app routes here
app.get('/', (req, res) => {
  res.send('Hello World');
});

app.listen(process.env.PORT || 3000);
```

### Health Check Patterns

**1. Comprehensive health check:**
```javascript
app.get('/health', async (req, res) => {
  const checks = {
    app: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {}
  };

  // Check database
  try {
    await db.query('SELECT 1');
    checks.checks.database = 'healthy';
  } catch (error) {
    checks.checks.database = 'unhealthy';
    checks.app = 'degraded';
  }

  // Check Redis
  try {
    await redis.ping();
    checks.checks.redis = 'healthy';
  } catch (error) {
    checks.checks.redis = 'unhealthy';
    checks.app = 'degraded';
  }

  // Check external API
  try {
    await axios.get('https://api.example.com/health', { timeout: 2000 });
    checks.checks.externalApi = 'healthy';
  } catch (error) {
    checks.checks.externalApi = 'unhealthy';
    // Don't degrade app status for external service
  }

  const statusCode = checks.app === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});
```

### Error Handling Patterns

**1. Global error handler:**
```javascript
// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Use in routes
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  res.json(user);
}));

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
  }
}

// Global error handler
app.use((err, req, res, next) => {
  const { statusCode = 500, message } = err;
  
  // Log error
  console.error({
    error: err,
    request: req.url,
    method: req.method,
    ip: req.ip
  });
  
  // Send error response
  res.status(statusCode).json({
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : message,
      statusCode
    }
  });
});
```

## Testing Your Deployment

### Load Testing Recipe

**1. Simple load test script:**
```javascript
// load-test.js
const axios = require('axios');

const URL = process.env.TEST_URL || 'http://localhost:3000';
const CONCURRENT = parseInt(process.env.CONCURRENT) || 10;
const REQUESTS = parseInt(process.env.REQUESTS) || 1000;

async function makeRequest() {
  const start = Date.now();
  try {
    const response = await axios.get(URL);
    return { 
      success: true, 
      duration: Date.now() - start,
      status: response.status
    };
  } catch (error) {
    return { 
      success: false, 
      duration: Date.now() - start,
      error: error.message
    };
  }
}

async function runLoadTest() {
  console.log(`Load testing ${URL}`);
  console.log(`Concurrent requests: ${CONCURRENT}`);
  console.log(`Total requests: ${REQUESTS}`);
  
  const results = [];
  const startTime = Date.now();
  
  for (let i = 0; i < REQUESTS; i += CONCURRENT) {
    const batch = [];
    for (let j = 0; j < CONCURRENT && i + j < REQUESTS; j++) {
      batch.push(makeRequest());
    }
    
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    process.stdout.write(`\rProgress: ${results.length}/${REQUESTS}`);
  }
  
  const totalTime = Date.now() - startTime;
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  console.log('\n\nResults:');
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Requests/sec: ${(REQUESTS / (totalTime / 1000)).toFixed(2)}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Average response time: ${avgDuration.toFixed(2)}ms`);
}

runLoadTest();
```

## Best Practices Summary

### Deployment Checklist

- [ ] Add health check endpoint
- [ ] Handle graceful shutdown
- [ ] Set resource limits appropriately
- [ ] Configure environment variables
- [ ] Add error handling
- [ ] Implement logging
- [ ] Test locally first
- [ ] Use semantic versioning
- [ ] Document API endpoints
- [ ] Add monitoring/metrics

### Security Checklist

- [ ] Never commit secrets
- [ ] Use environment variables
- [ ] Implement rate limiting
- [ ] Validate all inputs
- [ ] Use HTTPS only
- [ ] Keep dependencies updated
- [ ] Add security headers
- [ ] Implement authentication
- [ ] Log security events
- [ ] Regular security audits

### Performance Checklist

- [ ] Enable compression
- [ ] Implement caching
- [ ] Optimize database queries
- [ ] Use connection pooling
- [ ] Minimize bundle size
- [ ] Enable HTTP/2
- [ ] Use CDN for assets
- [ ] Implement pagination
- [ ] Monitor performance
- [ ] Load test before production