/**
 * MCP (Model Context Protocol) Discovery Routes
 * Provides discovery interface for AI agents to connect to SpinForge
 */

const express = require('express');
const router = express.Router();

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
  }
};

// Main discovery endpoint
router.get('/', (req, res) => {
  res.json({
    mcp_version: '0.5.0',
    server: MCP_SERVER_INFO,
    endpoint: 'https://mcp.spinforge.dev/mcp',
    connection: {
      url: 'https://mcp.spinforge.dev/mcp',
      protocol: 'HTTP/JSONRPC',
      authentication: 'none',
      claude_desktop: {
        description: 'Add this URL to Claude Desktop',
        url: 'https://mcp.spinforge.dev/mcp'
      }
    }
  });
});

// Tools documentation endpoint
router.get('/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: 'list_sites',
        description: 'List all hosted sites/applications',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['all', 'static', 'proxy', 'container', 'loadbalancer'],
              description: 'Filter sites by type'
            }
          }
        },
        examples: [
          'List all my sites',
          'Show me container applications',
          'What sites are hosted?'
        ]
      },
      {
        name: 'create_site',
        description: 'Create a new site/application',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            type: { type: 'string', enum: ['static', 'proxy', 'container', 'loadbalancer'] },
            config: { type: 'object' }
          },
          required: ['domain', 'type']
        },
        examples: [
          'Create a Node.js app at myapp.com using node:18',
          'Set up a static site at blog.com'
        ]
      },
      {
        name: 'deploy_static_site',
        description: 'Deploy from Git repository',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            gitUrl: { type: 'string' },
            branch: { type: 'string' },
            buildCommand: { type: 'string' }
          },
          required: ['domain', 'gitUrl']
        },
        examples: [
          'Deploy my React app from github.com/user/repo',
          'Deploy the Next.js site with npm run build'
        ]
      },
      {
        name: 'manage_container',
        description: 'Container operations (start, stop, restart, rebuild)',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            action: { type: 'string', enum: ['start', 'stop', 'restart', 'rebuild', 'status'] }
          },
          required: ['domain', 'action']
        },
        examples: [
          'Restart the container for myapp.com',
          'Stop the app at test.domain.com'
        ]
      },
      {
        name: 'setup_ssl',
        description: 'Configure SSL certificates',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            provider: { type: 'string', enum: ['letsencrypt', 'cloudflare', 'custom'] }
          },
          required: ['domain']
        },
        examples: ['Set up SSL for mydomain.com']
      },
      {
        name: 'setup_auth',
        description: 'Configure authentication and protected routes',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            authType: { type: 'string', enum: ['basic', 'oauth', 'custom', 'apiKey'] },
            routes: { type: 'array' }
          },
          required: ['domain', 'authType']
        },
        examples: [
          'Protect /admin routes on mysite.com',
          'Add OAuth authentication to app.com'
        ]
      }
    ]
  });
});

// Connection instructions endpoint
router.get('/connect', (req, res) => {
  res.json({
    platforms: {
      claude_desktop: {
        name: 'Claude Desktop',
        steps: [
          'Install Claude Desktop from https://claude.ai/download',
          'Locate your configuration file:',
          '  - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json',
          '  - Windows: %APPDATA%\\Claude\\claude_desktop_config.json',
          '  - Linux: ~/.config/Claude/claude_desktop_config.json',
          'Add the SpinForge MCP server configuration',
          'Restart Claude Desktop'
        ],
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
      cline: {
        name: 'Cline (VS Code)',
        steps: [
          'Install Cline extension in VS Code',
          'Open Cline settings',
          'Add SpinForge MCP server URL: https://mcp.spinforge.dev',
          'Configure API credentials if required'
        ]
      },
      custom: {
        name: 'Custom Integration',
        steps: [
          'Install the MCP SDK for your platform',
          'Connect to SpinForge MCP discovery endpoint',
          'Use the provided tool schemas for integration'
        ],
        endpoints: {
          discovery: 'https://mcp.spinforge.dev/api/mcp',
          tools: 'https://mcp.spinforge.dev/api/mcp/tools',
          api: 'https://api.spinforge.dev'
        }
      }
    }
  });
});

// Web interface for human-readable documentation
router.get('/web', (req, res) => {
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
      white-space: pre-wrap;
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
    .badge {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.8rem;
      margin-left: 0.5rem;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      text-decoration: none;
      margin: 0.5rem;
      transition: background 0.3s;
    }
    .button:hover {
      background: #764ba2;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>🚀 SpinForge MCP Server</h1>
      <p class="subtitle">AI-Native Hosting Platform Integration</p>
      
      <div style="margin: 2rem 0;">
        <a href="/api/mcp" class="button">📡 Discovery API</a>
        <a href="/api/mcp/tools" class="button">🔧 Tools Documentation</a>
        <a href="/api/mcp/connect" class="button">🔌 Connection Guide</a>
      </div>
      
      <h2>Quick Connect</h2>
      <p>Add SpinForge to your AI assistant with MCP support:</p>
      
      <h3 style="margin-top: 1.5rem;">Claude Desktop Configuration</h3>
      <div class="code-block">{
  "mcpServers": {
    "spinforge": {
      "command": "npx",
      "args": ["@spinforge/mcp-server"],
      "env": {
        "SPINFORGE_API_URL": "https://api.spinforge.dev"
      }
    }
  }
}</div>
      
      <h2>Available Tools <span class="badge">12 tools</span></h2>
      <div class="tool-grid">
        <div class="tool-card">
          <div class="tool-name">📋 list_sites</div>
          <div>List all hosted sites</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">➕ create_site</div>
          <div>Create new applications</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">🚀 deploy_static_site</div>
          <div>Deploy from Git</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">🐳 manage_container</div>
          <div>Control containers</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">🔒 setup_ssl</div>
          <div>Configure HTTPS</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">🔐 setup_auth</div>
          <div>Add authentication</div>
        </div>
      </div>
      
      <h2>Integration Examples</h2>
      <div class="code-block">// Natural language commands AI agents can use:

"List all my hosted sites"
"Create a Node.js app at myapp.com using node:18"
"Deploy my React app from github.com/user/repo"
"Set up SSL for all my domains"
"Restart the container for api.example.com"
"Protect /admin routes with OAuth"</div>
      
      <h2>API Endpoints</h2>
      <ul style="line-height: 1.8;">
        <li><strong>Discovery:</strong> GET https://mcp.spinforge.dev/api/mcp</li>
        <li><strong>Tools:</strong> GET https://mcp.spinforge.dev/api/mcp/tools</li>
        <li><strong>Connect:</strong> GET https://mcp.spinforge.dev/api/mcp/connect</li>
      </ul>
    </div>
  </div>
</body>
</html>
  `);
});

module.exports = router;