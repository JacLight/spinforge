# SpinForge Build Utility

A standalone build utility for building and packaging customer applications for SpinForge deployment.

## Features

- **Multi-framework support**: React, Remix, Next.js, Node.js, NestJS, Deno, Flutter
- **Auto-detection**: Automatically detects the framework used
- **Isolated builds**: Each build runs in an isolated environment
- **Docker support**: Can run builds inside Docker containers
- **Configurable**: Supports custom build configurations

## Installation

```bash
npm install -g @spinforge/build-utility
```

Or use Docker:

```bash
docker run -v $(pwd):/workspace spinforge-build-utility build /workspace
```

## Usage

### CLI Usage

```bash
# Build a project (auto-detect framework)
spinforge-build build ./my-app

# Build with specific framework
spinforge-build build ./my-app --framework nextjs

# Build and create deployment package
spinforge-build build ./my-app --output ./my-app-deploy.tar.gz

# Build with custom config
spinforge-build build ./my-app --config ./build-config.json

# Verbose output
spinforge-build build ./my-app --verbose
```

### Configuration

Create a `spinforge.json` file in your project root:

```json
{
  "name": "my-app",
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "env": {
    "NODE_ENV": "production"
  }
}
```

Or use the init command:

```bash
spinforge-build init
```

### Docker Usage

```bash
# Build the Docker image
docker build -t spinforge-build-utility .

# Run a build
docker run -v $(pwd)/my-app:/workspace \
  -v $(pwd)/output:/output \
  spinforge-build-utility build /workspace -o /output/build.tar.gz
```

### Docker Compose

Add to your `docker-compose.yml`:

```yaml
build-utility:
  image: spinforge-build-utility
  volumes:
    - ./builds:/builds
    - ./cache:/cache
  environment:
    - NODE_ENV=production
```

## Supported Frameworks

### React
- Detects: `react` in dependencies
- Build output: Static files
- Includes Express server for serving

### Next.js
- Detects: `next` in dependencies  
- Supports standalone builds
- Handles static assets

### Remix
- Detects: `@remix-run/react` in dependencies
- Builds server and client bundles

### NestJS
- Detects: `@nestjs/core` in dependencies
- TypeScript compilation
- Preserves dist structure

### Node.js
- Detects: `package.json` present
- Generic Node.js apps
- Preserves node_modules

### Deno
- Detects: `deno.json` or Deno imports
- Caches dependencies
- Creates permission-aware start scripts

### Flutter
- Detects: `pubspec.yaml` with Flutter SDK
- Builds for web target
- Includes web server

## Build Output

The build utility produces:
- Compiled/built application files
- `start.sh` script for running the app
- Dependencies (when needed)
- Configuration files
- Optional `.tar.gz` package

## API Usage

```javascript
import { BuildManager } from '@spinforge/build-utility';

const buildManager = new BuildManager();

const result = await buildManager.build({
  source: './my-app',
  output: './build-output',
  framework: 'auto',
  verbose: true
});

if (result.success) {
  console.log('Build successful!', result.metadata);
} else {
  console.error('Build failed:', result.errors);
}
```