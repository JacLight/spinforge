import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const port = parseInt(Deno.env.get("PORT") || "8000");

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>SpinForge Deno Test App</title>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 40px; background: #f0f0f0; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { color: #1a1a1a; font-size: 2.5rem; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
    .info-card { background: #f8f8f8; padding: 20px; border-radius: 8px; }
    .info-card h3 { color: #333; margin-bottom: 10px; }
    .api-section { margin-top: 40px; }
    button { background: #4a5568; color: white; border: none; padding: 12px 24px; margin: 5px; border-radius: 6px; cursor: pointer; font-size: 16px; }
    button:hover { background: #2d3748; }
    #api-results { margin-top: 20px; padding: 20px; background: #f8f8f8; border-radius: 8px; font-family: monospace; white-space: pre-wrap; min-height: 100px; }
    .feature-list { list-style: none; padding: 0; }
    .feature-list li:before { content: "✓ "; color: #48bb78; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🦕 SpinForge Deno Test Application</h1>
    <p style="font-size: 1.2rem; color: #666;">Modern JavaScript runtime with secure defaults and great developer experience</p>
    
    <div class="info-grid">
      <div class="info-card">
        <h3>Deployment Info</h3>
        <p><strong>Runtime:</strong> Deno ${Deno.version.deno}</p>
        <p><strong>TypeScript:</strong> ${Deno.version.typescript}</p>
        <p><strong>V8:</strong> ${Deno.version.v8}</p>
        <p><strong>Port:</strong> ${port}</p>
        <p><strong>Deploy Method:</strong> ${Deno.env.get("DEPLOY_METHOD") || "Unknown"}</p>
      </div>
      
      <div class="info-card">
        <h3>Features</h3>
        <ul class="feature-list">
          <li>TypeScript support out of the box</li>
          <li>Secure by default</li>
          <li>ES modules</li>
          <li>Built-in testing</li>
          <li>Top-level await</li>
        </ul>
      </div>
      
      <div class="info-card">
        <h3>Permissions</h3>
        <p>This app runs with:</p>
        <ul class="feature-list">
          <li>Network access</li>
          <li>Environment variables</li>
          <li>Read access (limited)</li>
        </ul>
      </div>
    </div>
    
    <div class="api-section">
      <h2>API Endpoint Tests</h2>
      <p>Test the Deno server API endpoints:</p>
      
      <div>
        <button onclick="testAPI('/api/info')">Test /api/info</button>
        <button onclick="testAPI('/api/test')">Test /api/test</button>
        <button onclick="testAPI('/api/echo?message=Hello+Deno')">Test /api/echo</button>
        <button onclick="testAPI('/api/system')">Test /api/system</button>
      </div>
      
      <div id="api-results">Click a button to test an API endpoint...</div>
    </div>
  </div>
  
  <script>
    async function testAPI(endpoint) {
      const results = document.getElementById('api-results');
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
`;

const handler = (req: Request): Response => {
  const url = new URL(req.url);
  
  // Home page - HTML
  if (url.pathname === "/") {
    return new Response(htmlContent, {
      headers: { "content-type": "text/html" }
    });
  }
  
  // Health check
  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ 
      status: "healthy",
      timestamp: new Date().toISOString()
    }), {
      headers: { "content-type": "application/json" }
    });
  }
  
  // API endpoints
  if (url.pathname === "/api/info") {
    return new Response(JSON.stringify({
      framework: "deno",
      version: Deno.version,
      deploymentMethod: Deno.env.get("DEPLOY_METHOD") || "Unknown",
      timestamp: new Date().toISOString(),
      build: {
        target: Deno.build.target,
        arch: Deno.build.arch,
        os: Deno.build.os
      }
    }), {
      headers: { "content-type": "application/json" }
    });
  }
  
  if (url.pathname === "/api/test") {
    return new Response(JSON.stringify({
      message: "Deno API test endpoint",
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      timestamp: new Date().toISOString()
    }), {
      headers: { "content-type": "application/json" }
    });
  }
  
  if (url.pathname === "/api/echo") {
    const message = url.searchParams.get("message") || "No message provided";
    return new Response(JSON.stringify({
      echo: message,
      params: Object.fromEntries(url.searchParams.entries()),
      timestamp: new Date().toISOString()
    }), {
      headers: { "content-type": "application/json" }
    });
  }
  
  if (url.pathname === "/api/system") {
    return new Response(JSON.stringify({
      memory: Deno.memoryUsage(),
      permissions: {
        read: "granted",
        write: "prompt",
        net: "granted",
        env: "granted"
      },
      cwd: Deno.cwd(),
      pid: Deno.pid
    }), {
      headers: { "content-type": "application/json" }
    });
  }
  
  return new Response("Not Found", { status: 404 });
};

console.log(`🦕 Deno server running on http://localhost:${port}`);
serve(handler, { port });