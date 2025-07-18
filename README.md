# SpinForge 🔥

> Open-source platform for on-demand execution of AI-generated applications in isolated runtime environments

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

SpinForge is a self-hosted serverless runtime that enables you to run thousands of isolated Node.js applications with minimal overhead. Built specifically for AI-generated applications, it provides AWS Lambda-like functionality on your own infrastructure.

## ✨ Features

- **🚀 Instant Startup**: Fork-based process spawning with <100ms cold starts
- **🔒 Complete Isolation**: Each application runs in its own process with resource limits
- **💰 Zero Idle Cost**: Automatic shutdown after 5 minutes of inactivity
- **📊 Built-in Telemetry**: OpenTelemetry integration with metrics, logs, and traces
- **🌐 Multi-Framework**: Support for Next.js, Remix, Express, and static sites
- **⚡ KeyDB Powered**: Fast routing and state management with Redis-compatible storage
- **🎯 Domain Routing**: Automatic domain-to-application mapping
- **📈 Auto-scaling**: Efficient resource utilization across thousands of apps

## 🏗 Architecture

SpinForge consists of several modular components:

```
SpinForge/
├── spinlet-core/     # Runtime lifecycle manager
├── spinlet-hub/      # Smart router/proxy
├── spinlet-builder/  # Build system for frameworks
├── spinlet-telemetry/# Metrics and monitoring
└── spinlet-cli/      # Developer tools
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- KeyDB or Redis 6+
- Linux or macOS (Windows WSL2 supported)

### Installation

```bash
# Clone the repository
git clone https://github.com/spinforge/spinforge.git
cd spinforge

# Install dependencies
npm install

# Build all packages
npm run build

# Start SpinForge
npm start
```

### Deploy Your First App

```bash
# Using the CLI
spinforge deploy ./my-remix-app --domain myapp.example.com

# Or via API
curl -X POST http://localhost:8080/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "user-123",
    "buildPath": "/apps/my-remix-app",
    "domain": "myapp.example.com"
  }'
```

## 📖 Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [KeyDB Schema Reference](./KEYDB-SCHEMA.md)
- [Implementation Checklist](./IMPLEMENTATION-CHECKLIST.md)
- [API Reference](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)

## 🧱 Core Concepts

### Spinlets
A **Spinlet** is an isolated runtime instance for a single application. Each Spinlet:
- Runs in its own Node.js process
- Has dedicated port allocation
- Includes resource limits (CPU, memory)
- Auto-scales based on demand
- Shuts down when idle

### SpinHub (Router)
The intelligent routing layer that:
- Maps domains to Spinlets
- Spawns processes on-demand
- Proxies HTTP/WebSocket traffic
- Handles SSL termination

### Telemetry
Built-in observability with:
- Request metrics (count, latency, errors)
- Resource usage (CPU, memory)
- Custom application metrics
- Distributed tracing
- Centralized logging

## 🔧 Configuration

### Environment Variables

```bash
# KeyDB/Redis connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Port range for Spinlets
PORT_START=3000
PORT_END=4000

# Resource limits
DEFAULT_MEMORY_LIMIT=512MB
DEFAULT_CPU_LIMIT=0.5

# Telemetry
TELEMETRY_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

### Spinfile Configuration

```yaml
# spinfile.yaml
name: my-app
framework: remix
resources:
  memory: 1GB
  cpu: 1.0
env:
  NODE_ENV: production
  API_KEY: ${SECRET_API_KEY}
domains:
  - myapp.com
  - www.myapp.com
```

## 📊 Performance

SpinForge is designed for high-density hosting:

| Metric | Value |
|--------|-------|
| Cold Start | <100ms |
| Request Routing | <1ms |
| Memory per Spinlet | ~50MB base |
| Concurrent Spinlets | 1000+ per host |
| Requests/sec | 10,000+ |

## 🔌 Integrations

SpinForge works seamlessly with:
- **MintFlow.ai**: AI workflow automation
- **GitHub Actions**: CI/CD deployment
- **Kubernetes**: Container orchestration
- **Grafana**: Metrics visualization
- **Jaeger**: Distributed tracing

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Install development dependencies
npm install

# Run tests
npm test

# Run in development mode
npm run dev

# Lint code
npm run lint
```

## 🗺 Roadmap

- [ ] Multi-node clustering support
- [ ] Python and Deno runtime support
- [ ] Built-in A/B testing
- [ ] Edge deployment mode
- [ ] WebAssembly support
- [ ] GPU allocation for AI workloads

## 📄 License

SpinForge is MIT licensed. See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with ❤️ for the AI-first development community. Special thanks to:
- The Node.js team for an amazing runtime
- KeyDB for blazing-fast data storage
- The open-source community for inspiration

---

**SpinForge** - Forging the future of serverless, one Spinlet at a time 🚀# spinforge
