# SpinForge CLI

Command-line interface for managing SpinForge applications.

## Installation

```bash
npm install -g @spinforge/cli
```

## Commands

### Deploy (Direct API)
Deploy an application directly via the SpinHub API:

```bash
spinforge deploy <path> [options]
```

Options:
- `-d, --domain <domain>` - Domain for the application
- `-c, --customer <id>` - Customer ID
- `-f, --framework <type>` - Framework type (remix, nextjs, express)
- `-m, --memory <size>` - Memory limit (default: 512MB)
- `--cpu <limit>` - CPU limit (default: 0.5)

### Deploy Folder (Hot Deployment)
Prepare a folder for hot deployment with automatic build:

```bash
spinforge deploy-folder <path> [options]
```

Options:
- `-d, --domain <domain>` - Domain for the application
- `-c, --customer <id>` - Customer ID
- `-f, --framework <type>` - Framework type (auto-detected if not specified)
- `-n, --name <name>` - Application name
- `-m, --memory <size>` - Memory limit (default: 512MB)
- `--cpu <limit>` - CPU limit (default: 0.5)
- `--skip-build` - Skip build step (for pre-built apps)
- `-e, --env <vars...>` - Environment variables (KEY=value)

Examples:
```bash
# Deploy with auto-detection
spinforge deploy-folder ./my-app

# Deploy pre-built Next.js app
spinforge deploy-folder ./my-app --skip-build --framework nextjs

# Deploy with custom domain and env vars
spinforge deploy-folder ./my-app -d myapp.local -e API_KEY=secret -e DB_URL=postgres://...
```

### List Deployments
View all deployments:

```bash
spinforge deployments [options]
```

Options:
- `--json` - Output as JSON

### Scan Deployments
Manually trigger deployment folder scanning:

```bash
spinforge deployment-scan
```

### View Status
Get status of spinlets:

```bash
spinforge status [spinletId]
```

Options:
- `-c, --customer <id>` - Filter by customer ID

### View Logs
Stream logs from a spinlet:

```bash
spinforge logs <spinletId> [options]
```

Options:
- `-f, --follow` - Follow log output
- `-n, --lines <number>` - Number of lines to show (default: 100)

### Manage Routes
Manage domain routes:

```bash
spinforge routes [options]
```

Options:
- `-c, --customer <id>` - Filter by customer ID
- `--add` - Add a new route
- `--remove <domain>` - Remove a route

### Stop Spinlet
Stop a running spinlet:

```bash
spinforge stop <spinletId>
```

## Environment Variables

- `SPINHUB_URL` - SpinHub API URL (default: http://localhost:8080)
- `SPINFORGE_DEPLOYMENTS` - Deployment folder path (default: /spinforge/deployments)

## Deployment Workflow

### Option 1: Hot Deployment with Build
1. Create your application
2. Run `spinforge deploy-folder ./my-app`
3. Copy to deployment folder when prompted
4. SpinHub automatically builds and deploys

### Option 2: Pre-built Deployment
1. Build your application locally
2. Run `spinforge deploy-folder ./my-app --skip-build`
3. Copy built files to deployment folder
4. SpinHub automatically deploys without building

### Option 3: Direct API Deployment
1. Use `spinforge deploy ./my-app` for immediate deployment
2. Application is deployed directly via API

## Framework Support

- **nextjs** - Next.js applications
- **remix** - Remix applications  
- **express** - Express.js applications
- **static** - Static websites
- **custom** - Custom Node.js applications