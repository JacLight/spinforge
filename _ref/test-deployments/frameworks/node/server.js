const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Home page with HTML
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SpinForge Node.js Test App</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .info { background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .api-test { margin-top: 30px; }
        button { background: #2196f3; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #1976d2; }
        #results { margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 4px; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>SpinForge Node.js Test Application</h1>
        <p>Express.js server with API endpoints and static file serving</p>
        
        <div class="info">
          <h3>Deployment Information</h3>
          <p><strong>Framework:</strong> Node.js (Express)</p>
          <p><strong>Port:</strong> ${PORT}</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
          <p><strong>Deployment Method:</strong> ${process.env.DEPLOY_METHOD || 'Unknown'}</p>
        </div>
        
        <div class="api-test">
          <h3>Test API Endpoints</h3>
          <button onclick="testAPI('/api/info')">Test /api/info</button>
          <button onclick="testAPI('/api/test')">Test /api/test</button>
          <button onclick="testAPI('/api/echo?message=Hello')">Test /api/echo</button>
          <button onclick="testAPI('/api/data')">Test /api/data</button>
          <div id="results"></div>
        </div>
      </div>
      
      <script>
        async function testAPI(endpoint) {
          const results = document.getElementById('results');
          results.textContent = 'Loading...';
          
          try {
            const response = await fetch(endpoint);
            const data = await response.json();
            results.textContent = JSON.stringify(data, null, 2);
          } catch (error) {
            results.textContent = 'Error: ' + error.message;
          }
        }
      </script>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/info', (req, res) => {
  res.json({
    framework: 'node',
    server: 'express',
    version: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      DEPLOY_METHOD: process.env.DEPLOY_METHOD
    }
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    timestamp: new Date().toISOString(),
    headers: {
      'user-agent': req.headers['user-agent'],
      'host': req.headers.host
    }
  });
});

app.get('/api/echo', (req, res) => {
  const { message = 'No message provided' } = req.query;
  res.json({
    echo: message,
    query: req.query,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/echo', (req, res) => {
  res.json({
    echo: req.body,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/data', (req, res) => {
  res.json({
    users: [
      { id: 1, name: 'Test User 1' },
      { id: 2, name: 'Test User 2' }
    ],
    metadata: {
      total: 2,
      page: 1
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints: http://localhost:${PORT}/api/*`);
});