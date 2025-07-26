const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`[4050] ${req.method} ${req.url} - Headers:`, req.headers);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Hello from test server on port 4050!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: req.headers,
    proxiedThrough: req.headers['x-proxied-by'] || 'Unknown'
  }, null, 2));
});

server.listen(4050, () => {
  console.log('Test server running on http://localhost:4050');
});