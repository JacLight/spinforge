# SpinForge Admin UI

This is the administrative interface for managing SpinForge hosted sites.

## Features

- View all hosted sites (static, proxy, container, loadbalancer)
- Real-time site status monitoring
- Deployment management
- Application metrics and monitoring
- Customer management
- Redis/KeyDB integration for data persistence

## Setup

1. Install dependencies:
```bash
cd apps/admin-ui
npm install
```

2. Configure environment:
```bash
# The .env file is already configured with defaults
# Edit .env to match your setup if needed
```

3. Start the development server:
```bash
npm run dev
```

The UI will be available at http://localhost:5173 (or the next available port).

## Configuration

The UI connects to:
- **API Server**: http://localhost:8080 (hosting API)
- **SpinHub**: http://localhost:9004 (optional, for advanced features)
- **KeyDB/Redis**: localhost:16378 (used by the API backend)

## Pages

- **/hosting** - View and manage virtual hosts
- **/deployments** - Manage deployments
- **/applications** - Monitor running applications
- **/customers** - Customer management
- **/admin** - Main dashboard

## API Integration

The UI uses the hosting API endpoints:
- `GET /api/vhost` - List all virtual hosts
- `GET /api/vhost/:subdomain` - Get specific site details
- `POST /api/vhost` - Create new site
- `PUT /api/vhost/:subdomain` - Update site
- `DELETE /api/vhost/:subdomain` - Delete site

## Development

The UI is built with:
- React 18
- TypeScript
- Vite
- TanStack Query (React Query)
- Tailwind CSS
- Lucide React icons

## Production Build

```bash
npm run build
```

The built files will be in the `dist` directory.
