# SpinForge Debugging Guide

This guide covers debugging SpinForge in both Docker and native environments.

## Table of Contents
- [Quick Start](#quick-start)
- [Docker Debugging](#docker-debugging)
- [Native Debugging](#native-debugging)
- [VS Code Configuration](#vs-code-configuration)
- [Common Issues](#common-issues)
- [Port Reference](#port-reference)

## Quick Start

### One-Click Debug in VS Code
1. Open VS Code in the SpinForge project root
2. Press `F5` or click the "Run and Debug" button
3. Select your preferred debug configuration:
   - **"Debug All (Docker)"** - Starts everything in Docker with debugging
   - **"Debug SpinHub (Native)"** - Runs SpinHub locally with Docker dependencies
   - **"Debug Full Stack (Native)"** - Runs all services locally

### Manual Commands
```bash
# Docker debugging
npm run debug:docker

# Native debugging
npm run debug:native

# Stop all services
npm run debug:stop
```

## Docker Debugging

### Starting Services with Debug Mode
```bash
# Start all services with debugging enabled
docker-compose -f docker-compose.yml -f docker-compose.debug.yml up

# Start specific service
docker-compose -f docker-compose.yml -f docker-compose.debug.yml up spinhub
```

### Debug Ports
- **SpinHub**: Port 9229
- **Builder**: Port 9230
- **UI Dev Server**: Port 9231

### Attaching Debugger
1. Services start with `--inspect` flag automatically
2. In VS Code, go to Run and Debug (Ctrl+Shift+D)
3. Select "Attach to SpinHub (Docker)" or other Docker configs
4. Set breakpoints in your TypeScript files
5. The debugger will map Docker paths to your local files

### Docker Debug Features
- Hot reload enabled (watches for file changes)
- Source maps enabled for TypeScript debugging
- Automatic port exposure for debuggers
- Volume mounts for live code updates

## Native Debugging

### Prerequisites
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start only infrastructure services
docker-compose up keydb nginx prometheus grafana
```

### Running Services Locally

#### Option 1: Debug Individual Service
```bash
# Terminal 1: Start SpinHub
cd packages/spinlet-hub
npm run dev:debug

# Terminal 2: Start Builder
cd packages/spinlet-builder
npm run dev:debug

# Terminal 3: Start UI
cd packages/spinforge-ui
npm run dev
```

#### Option 2: Use VS Code Launch Configs
Press F5 and select:
- "Debug SpinHub (Native)"
- "Debug Builder (Native)"
- "Debug UI (Native)"
- "Debug Full Stack (Native)" - Launches all services

### Environment Variables for Native Debug
```bash
# Required for all services
export NODE_ENV=development
export REDIS_HOST=localhost
export REDIS_PORT=9000
export REDIS_PASSWORD=spinforge123

# SpinHub specific
export PORT=8080
export ADMIN_TOKEN=changeMe123

# Builder specific
export BUILD_CACHE_DIR=./cache
export BUILD_OUTPUT_DIR=./builds
```

## VS Code Configuration

### Recommended Extensions
- **Debugger for Chrome** - For UI debugging
- **Docker** - For container management
- **ESLint** - Code quality
- **Prettier** - Code formatting
- **TypeScript** - Language support

### Debug Configurations

#### launch.json Overview
- **Debug All (Docker)** - Compound configuration that starts everything
- **Attach to SpinHub (Docker)** - Attach to running Docker container
- **Debug SpinHub (Native)** - Launch SpinHub locally
- **Debug with Chrome** - Launch UI with Chrome debugging

### Keyboard Shortcuts
- `F5` - Start debugging
- `Shift+F5` - Stop debugging
- `F9` - Toggle breakpoint
- `F10` - Step over
- `F11` - Step into
- `Shift+F11` - Step out
- `Ctrl+Shift+D` - Open debug panel

## Common Issues

### Docker Debugging Issues

#### "Cannot connect to runtime"
```bash
# Ensure debug ports are exposed
docker ps # Check if containers are running
docker logs spinforge-hub # Check for errors

# Restart with fresh build
docker-compose down
docker-compose -f docker-compose.yml -f docker-compose.debug.yml up --build
```

#### Source maps not working
```bash
# Rebuild TypeScript with source maps
npm run build

# Ensure tsconfig.json has sourceMap enabled
```

### Native Debugging Issues

#### "ECONNREFUSED" to Redis
```bash
# Ensure KeyDB is running
docker-compose up keydb

# Check if port 9000 is available
lsof -i :9000
```

#### TypeScript breakpoints not hit
1. Ensure source maps are generated: Check for `.js.map` files
2. Rebuild the project: `npm run build`
3. Check `outFiles` in launch.json matches your build output
4. Try these debug configurations in order:
   - **"Debug SpinHub (Native)"** - Uses ts-node to run TypeScript directly
   - **"Debug SpinHub (Compiled)"** - Uses compiled JavaScript with source maps
5. Make sure breakpoints are set in TypeScript files (`.ts`), not JavaScript files
6. Verify breakpoints show as solid red circles (not hollow)
7. If using the compiled version, ensure the source map paths are correct by checking the `.js.map` files

### Performance Tips
- Use `skipFiles` in launch.json to skip node_modules
- Enable "Smart Step" in VS Code settings
- Use conditional breakpoints for high-frequency code paths

## Port Reference

### Application Ports
- **8080**: SpinHub API (Native)
- **8081**: Builder Service (Native)
- **3000**: UI Development Server
- **9004**: SpinHub API (Docker)
- **9010**: UI Production (Docker)

### Debug Ports
- **9229**: SpinHub Debug
- **9230**: Builder Debug
- **9231**: UI Debug

### Infrastructure Ports
- **9000**: KeyDB/Redis
- **9006**: Nginx HTTP
- **9007**: Nginx HTTPS
- **9008**: Prometheus
- **9009**: Grafana

## Advanced Debugging

### Remote Debugging
```bash
# Enable remote debugging on a server
NODE_OPTIONS='--inspect=0.0.0.0:9229' node dist/server.js

# SSH tunnel for secure debugging
ssh -L 9229:localhost:9229 user@remote-server

# Attach VS Code to localhost:9229
```

### Memory Profiling
```javascript
// Add to your code
if (process.env.NODE_ENV === 'development') {
  const v8Profiler = require('v8-profiler-next');
  // Take heap snapshot
  const snapshot = v8Profiler.takeSnapshot();
  snapshot.export().pipe(fs.createWriteStream('heap.heapsnapshot'));
}
```

### CPU Profiling
Use Chrome DevTools or VS Code's built-in profiler:
1. Start with `--inspect` flag
2. Open chrome://inspect
3. Click "Open dedicated DevTools for Node"
4. Go to Profiler tab

## Debugging Checklist

Before debugging:
- [ ] All dependencies installed (`npm install`)
- [ ] TypeScript compiled with source maps (`npm run build`)
- [ ] Required services running (KeyDB, etc.)
- [ ] Correct debug configuration selected
- [ ] Breakpoints set in TypeScript files (not JavaScript)
- [ ] Environment variables configured

During debugging:
- [ ] Check Debug Console for errors
- [ ] Verify breakpoint locations (should be solid red)
- [ ] Use Watch panel for variable inspection
- [ ] Check Call Stack for execution flow
- [ ] Use Debug Terminal for REPL access

## Troubleshooting Commands

```bash
# Check all running services
docker-compose ps

# View logs
docker-compose logs -f spinhub
docker-compose logs -f builder

# Restart everything
npm run debug:restart

# Clean build
npm run clean && npm run build

# Check port usage
netstat -tulpn | grep -E '9229|9230|8080|8081'
```

## Tips and Tricks

1. **Hot Reload**: Both Docker and native setups support hot reload with `nodemon`
2. **Conditional Breakpoints**: Right-click on a breakpoint to add conditions
3. **Logpoints**: Use logpoints instead of console.log for non-breaking debugging
4. **Debug Terminal**: Use the Debug Console as a REPL while paused
5. **Multi-target Debugging**: Use compound configurations to debug multiple services

## Need Help?

- Check service logs: `docker-compose logs [service-name]`
- Verify port availability: `lsof -i :[port]`
- Reset everything: `docker-compose down -v && docker-compose up`
- Check TypeScript compilation: `npx tsc --noEmit`