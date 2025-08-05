const express = require('express');
const httpProxy = require('http-proxy');
const app = express();

// Create a proxy instance
const proxy = httpProxy.createProxyServer({});

// Simple in-memory route storage
const routes = {
  'test.localhost': 'http://localhost:3001',
  'demo.localhost': 'http://localhost:3002',
  'app.localhost': 'http://localhost:3003'
};

// Proxy middleware
app.use((req, res) => {
  const host = req.headers.host;
  const target = routes[host];
  
  console.log(`Request for ${host} -> ${target || 'No route found'}`);
  
  if (!target) {
    res.status(404).send(`
      <h1>404 - No route configured</h1>
      <p>No application is configured for domain: ${host}</p>
      <p>Available routes:</p>
      <ul>
        ${Object.keys(routes).map(domain => `<li>${domain}</li>`).join('')}
      </ul>
    `);
    return;
  }
  
  // Proxy the request
  proxy.web(req, res, { 
    target,
    changeOrigin: true,
    xfwd: true
  }, (err) => {
    console.error('Proxy error:', err);
    res.status(502).send(`
      <h1>502 - Bad Gateway</h1>
      <p>The application at ${target} is not responding</p>
      <p>Error: ${err.message}</p>
    `);
  });
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Simple proxy server running on port ${PORT}`);
  console.log('Configured routes:');
  Object.entries(routes).forEach(([domain, target]) => {
    console.log(`  ${domain} -> ${target}`);
  });
});