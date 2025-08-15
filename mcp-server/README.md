# SpinForge MCP Server

Model Context Protocol (MCP) server for SpinForge - enabling AI agents to manage hosting infrastructure.

## Features

The SpinForge MCP server exposes the following tools to AI agents:

### Site Management
- **list_sites** - List all hosted sites/applications with optional type filtering
- **create_site** - Create new sites (static, proxy, container, or load balancer)
- **get_site** - Get detailed information about a specific site
- **update_site** - Update site configuration
- **delete_site** - Remove a site

### Container Operations
- **manage_container** - Start, stop, restart, rebuild, or check status of containers
- **get_container_logs** - Retrieve container logs

### Deployment
- **deploy_static_site** - Deploy static sites from Git repositories with build commands

### Security & SSL
- **setup_ssl** - Configure SSL certificates (Let's Encrypt, Cloudflare, or custom)
- **setup_auth** - Configure authentication and protected routes

### Monitoring
- **get_metrics** - Retrieve site metrics and analytics
- **check_health** - Check health status of sites

## Installation

1. Install dependencies:
```bash
cd mcp-server
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your SpinForge API settings
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "spinforge": {
      "command": "node",
      "args": ["/path/to/spinforge/mcp-server/index.js"],
      "env": {
        "SPINFORGE_API_URL": "http://localhost:5020/api"
      }
    }
  }
}
```

### With Other MCP Clients

Start the server:
```bash
npm start
```

Or in development mode with auto-reload:
```bash
npm run dev
```

## Example Usage in AI Conversations

Once connected, AI agents can use natural language to manage hosting:

```
"Create a new Node.js application at myapp.example.com using the node:18 Docker image"
"Deploy my React app from github.com/user/repo to site.example.com"
"Set up SSL for all my domains"
"Show me the health status of my applications"
"Protect the /admin route on mysite.com with authentication"
```

## Tool Examples

### Create a Static Site
```javascript
{
  "tool": "create_site",
  "arguments": {
    "domain": "mysite.example.com",
    "type": "static",
    "config": {
      "gitUrl": "https://github.com/user/repo",
      "buildCommand": "npm run build",
      "outputDir": "dist"
    }
  }
}
```

### Create a Container Application
```javascript
{
  "tool": "create_site",
  "arguments": {
    "domain": "app.example.com",
    "type": "container",
    "config": {
      "image": "node:18",
      "port": 3000,
      "env": [
        {"key": "NODE_ENV", "value": "production"}
      ]
    }
  }
}
```

### Set Up Protected Routes
```javascript
{
  "tool": "setup_auth",
  "arguments": {
    "domain": "app.example.com",
    "authType": "oauth",
    "routes": [
      {
        "pattern": "/admin/*",
        "authType": "oauth",
        "redirectUrl": "https://auth.example.com/login"
      }
    ]
  }
}
```

## API Integration

The MCP server communicates with the SpinForge API at the configured endpoint. Ensure your SpinForge instance is running and accessible.

Default API endpoint: `http://localhost:5020/api`

## Security

- Store API keys securely in environment variables
- Use HTTPS for production deployments
- Implement rate limiting for public-facing instances
- Regular security audits of exposed tools

## Development

To add new tools:

1. Add tool definition to `TOOLS` array
2. Implement handler in the `CallToolRequestSchema` switch statement
3. Update this README with the new tool documentation

## License

MIT