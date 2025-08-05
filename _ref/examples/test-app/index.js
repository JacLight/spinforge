const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Host: ${req.headers.host}`);
  next();
});

// Root route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SpinForge Test App</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #333; }
        .info { 
          background: #e3f2fd; 
          padding: 15px; 
          border-radius: 5px;
          margin: 20px 0;
        }
        .info p { margin: 5px 0; }
        code { 
          background: #f5f5f5; 
          padding: 2px 5px; 
          border-radius: 3px;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 SpinForge Test Application</h1>
        <p>Congratulations! Your routing is working correctly.</p>
        
        <div class="info">
          <h3>Request Information:</h3>
          <p><strong>Domain:</strong> <code>${req.headers.host}</code></p>
          <p><strong>Spinlet ID:</strong> <code>${req.headers['x-spinlet-id'] || 'Not set'}</code></p>
          <p><strong>Customer ID:</strong> <code>${req.headers['x-spinlet-customer'] || 'Not set'}</code></p>
          <p><strong>Request ID:</strong> <code>${req.headers['x-request-id'] || 'Not set'}</code></p>
          <p><strong>Container Port:</strong> <code>${port}</code></p>
          <p><strong>Process ID:</strong> <code>${process.pid}</code></p>
        </div>
        
        <h3>Environment Variables:</h3>
        <ul>
          ${Object.entries(process.env)
            .filter(([key]) => !key.includes('PASSWORD') && !key.includes('SECRET'))
            .map(([key, value]) => `<li><code>${key}</code>: ${value}</li>`)
            .join('')}
        </ul>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// API endpoint
app.get('/api/info', (req, res) => {
  res.json({
    message: 'Hello from SpinForge test app!',
    host: req.headers.host,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Test app listening on port ${port}`);
  console.log(`Process ID: ${process.pid}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});