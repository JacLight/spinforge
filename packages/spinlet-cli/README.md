# SpinForge CLI

<div align="center">
  <h1>⚡ SpinForge CLI</h1>
  <p><strong>Deploy and manage applications with ease on the SpinForge platform</strong></p>
  <p>
    <a href="https://spinforge.dev">Website</a> •
    <a href="https://github.com/JacLight/spinforge">GitHub</a> •
    <a href="https://spinforge.dev/docs">Documentation</a>
  </p>
</div>

## Installation

```bash
npm install -g spinforge-cli
```

## Quick Start

```bash
# Deploy current directory
spinforge deploy

# Deploy with custom domain
spinforge deploy -d myapp.spinforge.dev

# Deploy a specific folder
spinforge deploy -p ./my-app -d myapp.local
```

## Features

- 🚀 **Instant Deployments** - Deploy applications in seconds
- 🔧 **Framework Auto-Detection** - Automatically detects Next.js, React, Vue, Express, and more
- 🌐 **Custom Domains** - Deploy with your own domain
- 📊 **Real-time Monitoring** - View logs and metrics
- 🔄 **Hot Reloading** - Watch for changes and auto-deploy
- 🎯 **Zero Config** - Works out of the box with sensible defaults

## Commands

### Authentication

```bash
spinforge login              # Login to SpinForge
spinforge logout             # Logout from SpinForge
spinforge whoami             # Display current user information
```

### Deployment

```bash
spinforge deploy [options]   # Deploy an application
  -p, --path <path>          # Path to deploy (default: current directory)
  -d, --domain <domain>      # Domain for the application
  -f, --framework <type>     # Framework type (auto-detected if not specified)
  -n, --name <name>          # Application name
  -m, --memory <size>        # Memory limit (default: 512MB)
  --cpu <limit>              # CPU limit (default: 0.5)
```

### Management

```bash
spinforge deployments        # List all deployments
spinforge status [id]        # Get status of spinlets
spinforge logs <id>          # Stream logs from a spinlet
spinforge stop <id>          # Stop a running spinlet
spinforge routes             # Manage domain routes
```

### Development

```bash
spinforge watch [path]       # Watch for changes and auto-deploy
spinforge deploy-folder      # Prepare folder for hot deployment
```

## Framework Support

SpinForge automatically detects and optimizes deployments for:

- **Next.js** - Full support for SSR, SSG, and API routes
- **React** - Optimized static builds
- **Vue** - Production-ready deployments
- **Express** - Node.js server applications
- **NestJS** - Enterprise Node.js applications
- **Remix** - Full-stack React framework
- **Static Sites** - HTML, CSS, JS websites
- **Custom Node.js** - Any Node.js application

## Examples

### Deploy a Next.js Application

```bash
cd my-nextjs-app
spinforge deploy -d myapp.spinforge.dev
```

### Deploy with Environment Variables

```bash
spinforge deploy -e API_KEY=secret -e DB_URL=postgres://...
```

### Watch for Changes

```bash
spinforge watch ./my-app
```

### Deploy Pre-built Application

```bash
spinforge deploy-folder ./dist --skip-build --framework static
```

## Configuration

Create a `spinforge.json` in your project root:

```json
{
  "name": "my-app",
  "domain": "myapp.spinforge.dev",
  "framework": "nextjs",
  "env": {
    "NODE_ENV": "production"
  },
  "build": {
    "command": "npm run build",
    "output": ".next"
  }
}
```

## Configuration

SpinForge CLI requires explicit configuration. You can configure it using:

1. **Environment Variables**
2. **spinforge.config.json** file in your project directory

### Environment Variables

- `SPINFORGE_API_URL` - API URL (required)
- `SPINFORGE_WEB_URL` - Web UI URL (required)
- `SPINFORGE_TOKEN` - API token for authentication
- `SPINFORGE_DEPLOYMENTS` - Local deployment directory path (required)

### spinforge.config.json

Create a `spinforge.config.json` file in your project directory:

```json
{
  "apiUrl": "https://api.spinforge.dev",
  "webUrl": "https://spinforge.dev",
  "deploymentPath": "~/.spinforge/deployments"
}
```

Environment variables take precedence over the config file.

### Local Development

For local development:

```bash
export SPINFORGE_API_URL=http://localhost:9006
export SPINFORGE_WEB_URL=http://localhost:3000
export SPINFORGE_DEPLOYMENTS=/Users/you/.spinforge/deployments
```

## Support

- 📖 [Documentation](https://spinforge.dev/docs)
- 🐛 [Report Issues](https://github.com/JacLight/spinforge/issues)
- 💬 [Community](https://spinforge.dev/community)

## License

MIT License - see [LICENSE](https://github.com/JacLight/spinforge/blob/main/LICENSE) for details.

---

<div align="center">
  <p>Built with ❤️ by the SpinForge Team</p>
  <p><a href="https://spinforge.dev">spinforge.dev</a></p>
</div>