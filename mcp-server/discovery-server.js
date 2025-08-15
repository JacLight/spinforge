#!/usr/bin/env node
/**
 * SpinForge MCP Discovery Server
 * Provides a web interface for MCP server discovery and connection instructions
 */

import express from 'express';
import { config } from 'dotenv';
config();

const app = express();
const PORT = process.env.PORT || 3000;

// MCP Server metadata
const MCP_SERVER_INFO = {
  name: 'spinforge',
  version: '1.0.0',
  description: 'AI-native hosting platform - manage sites, containers, and deployments',
  vendor: 'SpinForge',
  homepage: 'https://spinforge.dev',
  capabilities: {
    tools: [
      'list_sites',
      'create_site', 
      'get_site',
      'update_site',
      'delete_site',
      'manage_container',
      'get_container_logs',
      'deploy_static_site',
      'setup_ssl',
      'setup_auth',
      'get_metrics',
      'check_health'
    ]
  },
  connection: {
    transport: 'stdio',
    command: 'npx',
    args: ['@spinforge/mcp-server'],
    env: {
      SPINFORGE_API_URL: 'https://api.spinforge.dev'
    }
  }
};

// Serve discovery endpoint
app.get('/', (req, res) => {
  res.json({
    mcp_version: '0.5.0',
    server: MCP_SERVER_INFO,
    instructions: {
      claude_desktop: {
        description: 'Add to Claude Desktop configuration',
        config_path: {
          macos: '~/Library/Application Support/Claude/claude_desktop_config.json',
          windows: '%APPDATA%\\Claude\\claude_desktop_config.json',
          linux: '~/.config/Claude/claude_desktop_config.json'
        },
        configuration: {
          mcpServers: {
            spinforge: {
              command: 'npx',
              args: ['@spinforge/mcp-server'],
              env: {
                SPINFORGE_API_URL: 'https://api.spinforge.dev'
              }
            }
          }
        }
      },
      npm_package: {
        description: 'Install via npm',
        install: 'npm install -g @spinforge/mcp-server',
        run: 'spinforge-mcp'
      },
      docker: {
        description: 'Run with Docker',
        pull: 'docker pull spinforge/mcp-server',
        run: 'docker run -it spinforge/mcp-server'
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mcp-discovery' });
});

// MCP tools documentation
app.get('/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: 'list_sites',
        description: 'List all hosted sites/applications',
        examples: [
          'List all my sites',
          'Show me container applications',
          'What sites are hosted?'
        ]
      },
      {
        name: 'create_site',
        description: 'Create a new site/application',
        examples: [
          'Create a Node.js app at myapp.com using node:18',
          'Set up a static site at blog.com',
          'Create a proxy to example.com at my.domain.com'
        ]
      },
      {
        name: 'deploy_static_site',
        description: 'Deploy from Git repository',
        examples: [
          'Deploy my React app from github.com/user/repo',
          'Deploy the Next.js site with npm run build'
        ]
      },
      {
        name: 'manage_container',
        description: 'Container operations',
        examples: [
          'Restart the container for myapp.com',
          'Stop the app at test.domain.com',
          'Check container status'
        ]
      },
      {
        name: 'setup_ssl',
        description: 'Configure SSL certificates',
        examples: [
          'Set up SSL for mydomain.com',
          'Enable HTTPS for all my sites'
        ]
      },
      {
        name: 'setup_auth',
        description: 'Configure authentication',
        examples: [
          'Protect /admin routes on mysite.com',
          'Add OAuth authentication to app.com',
          'Set up API key auth for api.domain.com'
        ]
      }
    ]
  });
});

// Serve a simple HTML interface
app.get('/web', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SpinForge MCP Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .card {
      background: white;
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-bottom: 1rem;
      font-size: 2.5rem;
    }
    h2 {
      color: #667eea;
      margin: 2rem 0 1rem;
      font-size: 1.5rem;
    }
    .subtitle {
      color: #666;
      margin-bottom: 2rem;
      font-size: 1.2rem;
    }
    .code-block {
      background: #f7f7f7;
      border: 1px solid #e1e1e1;
      border-radius: 0.5rem;
      padding: 1rem;
      margin: 1rem 0;
      font-family: 'Monaco', 'Courier New', monospace;
      overflow-x: auto;
    }
    .tool-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }
    .tool-card {
      background: #f9f9f9;
      border-radius: 0.5rem;
      padding: 1rem;
      border: 1px solid #e1e1e1;
    }
    .tool-name {
      font-weight: bold;
      color: #667eea;
      margin-bottom: 0.5rem;
    }
    .tool-example {
      color: #666;
      font-size: 0.9rem;
      margin-top: 0.5rem;
      font-style: italic;
    }
    .tab-container {
      margin: 2rem 0;
    }
    .tabs {
      display: flex;
      gap: 1rem;
      border-bottom: 2px solid #e1e1e1;
      margin-bottom: 1rem;
    }
    .tab {
      padding: 0.5rem 1rem;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      transition: all 0.3s;
    }
    .tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .badge {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.8rem;
      margin-left: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>🚀 SpinForge MCP Server</h1>
      <p class="subtitle">AI-Native Hosting Platform Integration</p>
      
      <h2>Quick Connect</h2>
      <div class="tab-container">
        <div class="tabs">
          <div class="tab active" onclick="showTab('claude')">Claude Desktop</div>
          <div class="tab" onclick="showTab('npm')">NPM Package</div>
          <div class="tab" onclick="showTab('docker')">Docker</div>
          <div class="tab" onclick="showTab('api')">API</div>
        </div>
        
        <div id="claude" class="tab-content active">
          <p>Add to your Claude Desktop configuration:</p>
          <div class="code-block">
{
  "mcpServers": {
    "spinforge": {
      "command": "npx",
      "args": ["@spinforge/mcp-server"],
      "env": {
        "SPINFORGE_API_URL": "https://api.spinforge.dev"
      }
    }
  }
}
          </div>
          <p style="margin-top: 1rem;">
            <strong>Config Location:</strong><br>
            macOS: ~/Library/Application Support/Claude/claude_desktop_config.json<br>
            Windows: %APPDATA%\\Claude\\claude_desktop_config.json<br>
            Linux: ~/.config/Claude/claude_desktop_config.json
          </p>
        </div>
        
        <div id="npm" class="tab-content">
          <p>Install globally via NPM:</p>
          <div class="code-block">npm install -g @spinforge/mcp-server</div>
          <p>Run the server:</p>
          <div class="code-block">spinforge-mcp</div>
        </div>
        
        <div id="docker" class="tab-content">
          <p>Pull the Docker image:</p>
          <div class="code-block">docker pull spinforge/mcp-server</div>
          <p>Run the container:</p>
          <div class="code-block">docker run -it spinforge/mcp-server</div>
        </div>
        
        <div id="api" class="tab-content">
          <p>Discovery Endpoint:</p>
          <div class="code-block">GET https://mcp.spinforge.dev/</div>
          <p>Tools Documentation:</p>
          <div class="code-block">GET https://mcp.spinforge.dev/tools</div>
        </div>
      </div>
      
      <h2>Available Tools <span class="badge">12 tools</span></h2>
      <div class="tool-grid">
        <div class="tool-card">
          <div class="tool-name">📋 list_sites</div>
          <div>List all hosted sites</div>
          <div class="tool-example">"Show me all my websites"</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">➕ create_site</div>
          <div>Create new applications</div>
          <div class="tool-example">"Create a Node.js app at myapp.com"</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">🚀 deploy_static_site</div>
          <div>Deploy from Git</div>
          <div class="tool-example">"Deploy my React app from GitHub"</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">🐳 manage_container</div>
          <div>Control containers</div>
          <div class="tool-example">"Restart the app container"</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">🔒 setup_ssl</div>
          <div>Configure HTTPS</div>
          <div class="tool-example">"Enable SSL for my domain"</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">🔐 setup_auth</div>
          <div>Add authentication</div>
          <div class="tool-example">"Protect /admin routes"</div>
        </div>
      </div>
      
      <h2>Example Usage</h2>
      <div class="code-block">
// Once connected, you can use natural language:

"List all my hosted sites"
"Create a static site at blog.example.com"
"Deploy my Next.js app from github.com/user/repo"
"Set up SSL for all domains"
"Restart the container for api.example.com"
"Show me container logs for the last hour"
      </div>
    </div>
  </div>
  
  <script>
    function showTab(tabName) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    }
  </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 SpinForge MCP Discovery Server running on port ${PORT}`);
  console.log(`📍 Discovery endpoint: http://localhost:${PORT}/`);
  console.log(`🌐 Web interface: http://localhost:${PORT}/web`);
  console.log(`📚 Tools documentation: http://localhost:${PORT}/tools`);
});