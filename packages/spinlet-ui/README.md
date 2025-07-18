# SpinForge Management UI

A modern web-based management interface for SpinForge.

## Features

- **Dashboard**: Real-time system overview with health status and metrics
- **Applications**: View, manage, and delete deployed applications
- **Deploy**: Easy-to-use deployment form for new applications
- **Metrics**: Resource usage monitoring and performance tracking
- **Settings**: Configure admin token for API access

## Quick Start

### Development Mode

```bash
cd packages/spinlet-ui
npm install
npm run dev
```

Access the UI at http://localhost:3001

### Production Mode (Docker)

The UI is automatically included in the main docker-compose setup:

```bash
docker-compose up -d
```

Access the UI at http://localhost:9010

## Configuration

1. **Get your admin token**:
   ```bash
   docker logs spinforge-hub | grep "Admin token"
   # or
   cat .env | grep ADMIN_TOKEN
   ```

2. **Configure in UI**:
   - Navigate to Settings page
   - Enter your admin token
   - Click Save

## Port Mappings

- Development: `3001` (Vite dev server)
- Production: `9010` (Nginx)

## Technology Stack

- React 18 with TypeScript
- Vite for fast development
- TailwindCSS for styling
- React Query for data fetching
- React Router for navigation
- Lucide React for icons

## API Integration

The UI communicates with SpinHub through the admin API endpoints:
- `/_admin/*` - Admin operations
- `/_health` - Health checks
- `/_metrics` - System metrics

All admin endpoints require the `X-Admin-Token` header.