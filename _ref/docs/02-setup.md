# SpinForge Setup Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Docker Setup](#docker-setup)
3. [Kubernetes Setup](#kubernetes-setup)
4. [Bare Metal Setup](#bare-metal-setup)
5. [Configuration](#configuration)
6. [Verification](#verification)
7. [Setup Scripts](#setup-scripts)

## Prerequisites

### System Requirements
- **CPU**: 2+ cores (4+ recommended)
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 20GB minimum
- **OS**: Linux, macOS, or Windows with WSL2

### Software Requirements
- **Docker**: 20.10+ (for Docker setup)
- **Kubernetes**: 1.24+ (for K8s setup)
- **Node.js**: 20+ (for bare metal)
- **Redis**: 6+ or KeyDB (for bare metal)
- **NGINX**: 1.20+ (for bare metal)

### Network Requirements
- Ports 80/443 for web traffic
- Port 9000-9010 for management (configurable)
- Port 30000-40000 for spinlets (configurable)

---

## Docker Setup

### Quick Start (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/spinforge.git
cd spinforge

# Copy environment template
cp .env.example .env

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step-by-Step Docker Setup

#### 1. Install Docker and Docker Compose

**Ubuntu/Debian:**
```bash
# Update package index
sudo apt-get update

# Install dependencies
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's GPG key
sudo mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

**macOS:**
```bash
# Install Docker Desktop
brew install --cask docker

# Start Docker Desktop
open /Applications/Docker.app
```

#### 2. Configure Environment

Create `.env` file:
```bash
# Redis Configuration
REDIS_PASSWORD=changeThisStrongPassword123

# Admin Configuration
ADMIN_TOKEN=changeThisAdminToken123

# Grafana Configuration
GRAFANA_PASSWORD=changeThisGrafanaPassword

# Rate Limits
RATE_LIMIT_GLOBAL=10000
RATE_LIMIT_CUSTOMER=1000

# Resource Limits
DEFAULT_MEMORY_LIMIT=512MB
DEFAULT_CPU_LIMIT=0.5

# Port Configuration
PORT_START=30000
PORT_END=40000

# Deployment Path
HOT_DEPLOYMENT_PATH=/spinforge/deployments

# Logging
LOG_LEVEL=info
```

#### 3. Create Required Directories

```bash
# Create deployment directory
mkdir -p ~/spinforge-deployments

# Create data directories
mkdir -p ./data/{ssl,backup}

# Set permissions
chmod 755 ~/spinforge-deployments
```

#### 4. Build and Start Services

```bash
# Build custom images
docker-compose build

# Start services in order
docker-compose up -d keydb
docker-compose up -d spinhub builder
docker-compose up -d nginx ui prometheus grafana

# Verify all services are running
docker-compose ps

# Check logs for errors
docker-compose logs --tail=50
```

#### 5. Initial Configuration

```bash
# Create admin user (if using auth)
docker exec spinforge-hub node scripts/create-admin.js \
  --username admin \
  --password yourpassword \
  --email admin@example.com

# Initialize database schema
docker exec spinforge-hub node scripts/init-db.js
```

### Docker Compose Override

For development, create `docker-compose.override.yml`:
```yaml
version: '3.8'

services:
  spinhub:
    volumes:
      - ./packages/spinlet-hub/src:/spinforge/packages/spinlet-hub/src
      - ./packages/spinlet-core/src:/spinforge/packages/spinlet-core/src
    environment:
      - NODE_ENV=development
      - DEBUG=spinforge:*
    command: npm run dev

  builder:
    volumes:
      - ./packages/spinlet-builder/src:/spinforge/packages/spinlet-builder/src
    environment:
      - NODE_ENV=development
```

---

## Kubernetes Setup

### Helm Installation (Recommended)

```bash
# Add SpinForge Helm repository
helm repo add spinforge https://charts.spinforge.io
helm repo update

# Install with default values
helm install spinforge spinforge/spinforge \
  --namespace spinforge \
  --create-namespace

# Install with custom values
helm install spinforge spinforge/spinforge \
  --namespace spinforge \
  --create-namespace \
  --values values.yaml
```

### Custom values.yaml:
```yaml
# Global settings
global:
  domain: spinforge.example.com
  storageClass: fast-ssd

# Redis settings
redis:
  enabled: true
  auth:
    password: "changeThisStrongPassword123"
  persistence:
    size: 10Gi

# SpinHub settings
spinhub:
  replicas: 3
  resources:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "2000m"
  
# Ingress settings
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  tls:
    enabled: true

# Monitoring
monitoring:
  enabled: true
  prometheus:
    retention: 30d
  grafana:
    adminPassword: "changeThisGrafanaPassword"
```

### Manual Kubernetes Setup

#### 1. Create Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: spinforge
  labels:
    name: spinforge
```

```bash
kubectl apply -f namespace.yaml
```

#### 2. Create ConfigMaps

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: spinforge-config
  namespace: spinforge
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "8080"
  HOST: "0.0.0.0"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "16378"
  PORT_START: "30000"
  PORT_END: "40000"
  DEFAULT_MEMORY_LIMIT: "512MB"
  RATE_LIMIT_GLOBAL: "10000"
  RATE_LIMIT_CUSTOMER: "1000"
```

#### 3. Create Secrets

```bash
# Create secrets
kubectl create secret generic spinforge-secrets \
  --namespace spinforge \
  --from-literal=REDIS_PASSWORD=changeThisStrongPassword123 \
  --from-literal=ADMIN_TOKEN=changeThisAdminToken123
```

#### 4. Deploy Redis/KeyDB

```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: spinforge
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: eqalpha/keydb:latest
        ports:
        - containerPort: 16378
        env:
        - name: KEYDB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: spinforge-secrets
              key: REDIS_PASSWORD
        command:
        - keydb-server
        - --appendonly
        - "yes"
        - --requirepass
        - $(KEYDB_PASSWORD)
        volumeMounts:
        - name: redis-storage
          mountPath: /data
      volumes:
      - name: redis-storage
        persistentVolumeClaim:
          claimName: redis-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: spinforge
spec:
  selector:
    app: redis
  ports:
  - port: 16378
    targetPort: 16378
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: spinforge
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

#### 5. Deploy SpinHub

```yaml
# spinhub-deployment.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: spinhub
  namespace: spinforge
spec:
  serviceName: spinhub
  replicas: 3
  selector:
    matchLabels:
      app: spinhub
  template:
    metadata:
      labels:
        app: spinhub
    spec:
      containers:
      - name: spinhub
        image: spinforge/spinhub:latest
        ports:
        - containerPort: 8080
        envFrom:
        - configMapRef:
            name: spinforge-config
        - secretRef:
            name: spinforge-secrets
        volumeMounts:
        - name: apps
          mountPath: /spinforge/apps
        - name: deployments
          mountPath: /spinforge/deployments
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: apps
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Gi
  - metadata:
      name: deployments
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: spinhub-service
  namespace: spinforge
spec:
  selector:
    app: spinhub
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
```

#### 6. Deploy Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: spinforge-ingress
  namespace: spinforge
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - "*.spinforge.example.com"
    secretName: spinforge-tls
  rules:
  - host: "*.spinforge.example.com"
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: spinhub-service
            port:
              number: 8080
```

---

## Bare Metal Setup

### Step-by-Step Bare Metal Installation

#### 1. Install System Dependencies

**Ubuntu/Debian:**
```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install build tools
sudo apt-get install -y build-essential git python3

# Install NGINX
sudo apt-get install -y nginx

# Install Redis/KeyDB
sudo apt-get install -y redis-server
# OR for KeyDB:
curl -s https://download.keydb.dev/keydb-ppa/KEY.gpg | sudo apt-key add -
echo "deb https://download.keydb.dev/keydb-ppa $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/keydb.list
sudo apt-get update
sudo apt-get install -y keydb-server

# Install PM2 for process management
sudo npm install -g pm2
```

**CentOS/RHEL:**
```bash
# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install dependencies
sudo yum install -y gcc-c++ make git python3

# Install NGINX
sudo yum install -y nginx

# Install Redis
sudo yum install -y epel-release
sudo yum install -y redis

# Install PM2
sudo npm install -g pm2
```

#### 2. Create SpinForge User

```bash
# Create system user
sudo useradd -r -s /bin/bash -m -d /opt/spinforge spinforge

# Add to necessary groups
sudo usermod -aG docker spinforge  # if using Docker for builds

# Switch to spinforge user
sudo su - spinforge
```

#### 3. Clone and Build SpinForge

```bash
# Clone repository
cd /opt/spinforge
git clone https://github.com/yourusername/spinforge.git .

# Install dependencies
npm install

# Build all packages
npm run build

# Create required directories
mkdir -p apps deployments logs data/ssl
```

#### 4. Configure Redis/KeyDB

Edit `/etc/redis/redis.conf`:
```conf
# Set password
requirepass changeThisStrongPassword123

# Enable AOF persistence
appendonly yes

# Set memory limit
maxmemory 2gb
maxmemory-policy allkeys-lru

# Bind to all interfaces (be careful in production)
bind 0.0.0.0

# Disable protected mode
protected-mode no
```

Start Redis:
```bash
sudo systemctl enable redis
sudo systemctl start redis
```

#### 5. Configure NGINX

Create `/etc/nginx/sites-available/spinforge`:
```nginx
upstream spinhub {
    server 127.0.0.1:8080;
    keepalive 32;
}

# HTTP redirect
server {
    listen 80;
    server_name *.spinforge.example.com spinforge.example.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name *.spinforge.example.com;

    # SSL configuration
    ssl_certificate /opt/spinforge/data/ssl/fullchain.pem;
    ssl_certificate_key /opt/spinforge/data/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Proxy settings
    location / {
        proxy_pass http://spinhub;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering off;
        proxy_request_buffering off;
    }
}

# Admin UI
server {
    listen 443 ssl http2;
    server_name spinforge.example.com;

    ssl_certificate /opt/spinforge/data/ssl/fullchain.pem;
    ssl_certificate_key /opt/spinforge/data/ssl/privkey.pem;

    root /opt/spinforge/packages/spinlet-ui/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://spinhub;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# WebSocket connection upgrade map
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/spinforge /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. Create Environment Configuration

Create `/opt/spinforge/.env`:
```bash
# Node environment
NODE_ENV=production

# Redis
REDIS_HOST=localhost
REDIS_PORT=16378
REDIS_PASSWORD=changeThisStrongPassword123

# SpinHub
PORT=8080
HOST=0.0.0.0
ADMIN_TOKEN=changeThisAdminToken123

# Rate limits
RATE_LIMIT_GLOBAL=10000
RATE_LIMIT_CUSTOMER=1000

# Resources
DEFAULT_MEMORY_LIMIT=512MB
DEFAULT_CPU_LIMIT=0.5

# Ports
PORT_START=30000
PORT_END=40000

# Paths
HOT_DEPLOYMENT_PATH=/opt/spinforge/deployments
APPS_PATH=/opt/spinforge/apps

# Logging
LOG_LEVEL=info
LOG_FILE=/opt/spinforge/logs/spinforge.log
```

#### 7. Create PM2 Ecosystem File

Create `/opt/spinforge/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'spinhub',
      script: './packages/spinlet-hub/dist/server.js',
      instances: 1,
      exec_mode: 'cluster',
      env_file: '.env',
      error_file: './logs/spinhub-error.log',
      out_file: './logs/spinhub-out.log',
      log_file: './logs/spinhub-combined.log',
      time: true,
      watch: false,
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=2048',
      kill_timeout: 5000,
      listen_timeout: 5000,
      shutdown_with_message: true
    },
    {
      name: 'builder',
      script: './packages/spinlet-builder/dist/service.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      error_file: './logs/builder-error.log',
      out_file: './logs/builder-out.log',
      log_file: './logs/builder-combined.log',
      time: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
```

#### 8. Start Services

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions output by the command

# Check status
pm2 status

# View logs
pm2 logs
```

#### 9. Setup SSL with Let's Encrypt

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get wildcard certificate
sudo certbot certonly --nginx -d "*.spinforge.example.com" -d "spinforge.example.com"

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

#### 10. Configure Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 9000:9010/tcp  # Management ports (optional)
sudo ufw enable

# firewalld (CentOS)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=9000-9010/tcp
sudo firewall-cmd --reload
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode | production |
| REDIS_HOST | Redis hostname | localhost |
| REDIS_PORT | Redis port | 16378 |
| REDIS_PASSWORD | Redis password | Required |
| PORT | SpinHub port | 8080 |
| HOST | SpinHub host | 0.0.0.0 |
| ADMIN_TOKEN | Admin API token | Required |
| RATE_LIMIT_GLOBAL | Global rate limit | 10000 |
| RATE_LIMIT_CUSTOMER | Per-customer limit | 1000 |
| DEFAULT_MEMORY_LIMIT | Default memory | 512MB |
| DEFAULT_CPU_LIMIT | Default CPU | 0.5 |
| PORT_START | First spinlet port | 30000 |
| PORT_END | Last spinlet port | 40000 |
| HOT_DEPLOYMENT_PATH | Deploy folder | /spinforge/deployments |
| LOG_LEVEL | Log verbosity | info |

### Security Configuration

#### 1. Change Default Passwords
```bash
# Generate secure passwords
openssl rand -base64 32  # For Redis
openssl rand -base64 32  # For Admin token
openssl rand -base64 32  # For Grafana
```

#### 2. Configure TLS/SSL
- Use Let's Encrypt for production
- Generate self-signed for development
- Enable HSTS headers
- Use TLS 1.2+ only

#### 3. Network Security
- Use private networks for internal communication
- Enable firewall rules
- Implement IP whitelisting for admin
- Use VPN for management access

### Resource Limits

Configure in `docker-compose.yml` or Kubernetes:
```yaml
resources:
  limits:
    cpus: '2.0'
    memory: 2G
  reservations:
    cpus: '0.5'
    memory: 512M
```

---

## Verification

### 1. Check Service Health

```bash
# Docker
docker-compose ps
docker-compose logs --tail=50

# Kubernetes
kubectl get pods -n spinforge
kubectl logs -n spinforge -l app=spinhub --tail=50

# Bare Metal
pm2 status
pm2 logs --lines 50
```

### 2. Test Endpoints

```bash
# Check SpinHub health
curl http://localhost:9004/health

# Check admin API
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:9004/api/status

# Check metrics
curl http://localhost:9008/metrics

# Check UI
open http://localhost:9010
```

### 3. Deploy Test Application

```bash
# Create test app
mkdir test-app
cd test-app

cat > package.json << EOF
{
  "name": "test-app",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

cat > server.js << EOF
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from SpinForge!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
EOF

# Deploy via hot deployment
cd ..
cp -r test-app ~/spinforge-deployments/

cat > ~/spinforge-deployments/test-app/deploy.yaml << EOF
name: test-app
domain: test.localhost
customerId: test-customer
framework: express
EOF
```

---

## Setup Scripts

### All-in-One Docker Setup Script

Create `setup-docker.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 SpinForge Docker Setup"
echo "========================"

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed."; exit 1; }

# Create directories
echo "📁 Creating directories..."
mkdir -p ~/spinforge-deployments
mkdir -p ./data/{ssl,backup}

# Generate passwords if not exists
if [ ! -f .env ]; then
    echo "🔐 Generating secure passwords..."
    REDIS_PASS=$(openssl rand -base64 32)
    ADMIN_TOKEN=$(openssl rand -base64 32)
    GRAFANA_PASS=$(openssl rand -base64 16)
    
    cat > .env << EOF
REDIS_PASSWORD=${REDIS_PASS}
ADMIN_TOKEN=${ADMIN_TOKEN}
GRAFANA_PASSWORD=${GRAFANA_PASS}
RATE_LIMIT_GLOBAL=10000
RATE_LIMIT_CUSTOMER=1000
DEFAULT_MEMORY_LIMIT=512MB
DEFAULT_CPU_LIMIT=0.5
PORT_START=30000
PORT_END=40000
HOT_DEPLOYMENT_PATH=/spinforge/deployments
LOG_LEVEL=info
EOF
    echo "✅ Environment file created"
    echo "⚠️  Save these credentials:"
    echo "   Redis Password: ${REDIS_PASS}"
    echo "   Admin Token: ${ADMIN_TOKEN}"
    echo "   Grafana Password: ${GRAFANA_PASS}"
fi

# Build and start
echo "🏗️  Building images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check health
echo "🏥 Checking service health..."
docker-compose ps

echo "✅ Setup complete!"
echo ""
echo "Access points:"
echo "  - UI: http://localhost:9010"
echo "  - Grafana: http://localhost:9009 (admin/${GRAFANA_PASS})"
echo "  - Apps: http://*.localhost:9006"
echo ""
echo "Next steps:"
echo "  1. Deploy your first app via the UI"
echo "  2. Configure domain DNS"
echo "  3. Setup SSL certificates"
```

Make executable:
```bash
chmod +x setup-docker.sh
./setup-docker.sh
```

### Kubernetes Setup Script

Create `setup-k8s.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 SpinForge Kubernetes Setup"
echo "============================="

# Check prerequisites
command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl is required but not installed."; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "❌ Helm is required but not installed."; exit 1; }

# Configuration
NAMESPACE="spinforge"
RELEASE_NAME="spinforge"

# Create namespace
echo "📁 Creating namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Generate secrets
echo "🔐 Generating secrets..."
REDIS_PASS=$(openssl rand -base64 32)
ADMIN_TOKEN=$(openssl rand -base64 32)

kubectl create secret generic spinforge-secrets \
  --namespace $NAMESPACE \
  --from-literal=REDIS_PASSWORD=$REDIS_PASS \
  --from-literal=ADMIN_TOKEN=$ADMIN_TOKEN \
  --dry-run=client -o yaml | kubectl apply -f -

# Create values file
cat > values.yaml << EOF
global:
  storageClass: standard

redis:
  auth:
    password: "${REDIS_PASS}"

spinhub:
  adminToken: "${ADMIN_TOKEN}"
  replicas: 2

ingress:
  enabled: true
  className: nginx
  host: spinforge.example.com

monitoring:
  enabled: true
EOF

# Install with Helm
echo "📦 Installing SpinForge..."
helm repo add spinforge https://charts.spinforge.io || true
helm repo update
helm upgrade --install $RELEASE_NAME spinforge/spinforge \
  --namespace $NAMESPACE \
  --values values.yaml \
  --wait

# Check status
echo "🏥 Checking deployment status..."
kubectl get pods -n $NAMESPACE
kubectl get svc -n $NAMESPACE
kubectl get ingress -n $NAMESPACE

echo "✅ Setup complete!"
echo ""
echo "⚠️  Save these credentials:"
echo "   Redis Password: ${REDIS_PASS}"
echo "   Admin Token: ${ADMIN_TOKEN}"
```

### Bare Metal Setup Script

Create `setup-bare-metal.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 SpinForge Bare Metal Setup"
echo "============================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Configuration
SPINFORGE_USER="spinforge"
SPINFORGE_HOME="/opt/spinforge"
NODE_VERSION="20"

# Install dependencies
echo "📦 Installing system dependencies..."
apt-get update
apt-get install -y curl git build-essential python3 nginx redis-server

# Install Node.js
echo "📦 Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# Install PM2
echo "📦 Installing PM2..."
npm install -g pm2

# Create user
echo "👤 Creating SpinForge user..."
useradd -r -s /bin/bash -m -d $SPINFORGE_HOME $SPINFORGE_USER || true

# Clone repository
echo "📥 Cloning SpinForge..."
cd $SPINFORGE_HOME
if [ ! -d ".git" ]; then
    git clone https://github.com/yourusername/spinforge.git .
    chown -R $SPINFORGE_USER:$SPINFORGE_USER $SPINFORGE_HOME
fi

# Switch to spinforge user for build
sudo -u $SPINFORGE_USER bash << 'EOF'
cd /opt/spinforge

# Install dependencies
echo "📦 Installing Node dependencies..."
npm install

# Build
echo "🏗️  Building SpinForge..."
npm run build

# Create directories
mkdir -p apps deployments logs data/ssl

# Generate environment file
if [ ! -f .env ]; then
    echo "🔐 Generating configuration..."
    cat > .env << 'ENVFILE'
NODE_ENV=production
REDIS_HOST=localhost
REDIS_PORT=16378
REDIS_PASSWORD=$(openssl rand -base64 32)
PORT=8080
HOST=0.0.0.0
ADMIN_TOKEN=$(openssl rand -base64 32)
RATE_LIMIT_GLOBAL=10000
RATE_LIMIT_CUSTOMER=1000
DEFAULT_MEMORY_LIMIT=512MB
DEFAULT_CPU_LIMIT=0.5
PORT_START=30000
PORT_END=40000
HOT_DEPLOYMENT_PATH=/opt/spinforge/deployments
LOG_LEVEL=info
ENVFILE
fi

# Start with PM2
echo "🚀 Starting services..."
pm2 start ecosystem.config.js
pm2 save
EOF

# Configure Redis
echo "🔧 Configuring Redis..."
REDIS_PASS=$(grep REDIS_PASSWORD $SPINFORGE_HOME/.env | cut -d= -f2)
sed -i "s/# requirepass foobared/requirepass $REDIS_PASS/" /etc/redis/redis.conf
sed -i "s/bind 127.0.0.1/bind 0.0.0.0/" /etc/redis/redis.conf
systemctl restart redis

# Configure NGINX
echo "🔧 Configuring NGINX..."
cp $SPINFORGE_HOME/nginx.conf /etc/nginx/sites-available/spinforge
ln -sf /etc/nginx/sites-available/spinforge /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Setup PM2 startup
echo "🔧 Configuring PM2 startup..."
sudo -u $SPINFORGE_USER pm2 startup systemd -u $SPINFORGE_USER --hp $SPINFORGE_HOME
systemctl enable pm2-$SPINFORGE_USER

# Configure firewall
echo "🔒 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "✅ Setup complete!"
echo ""
echo "⚠️  Important: Save your credentials from $SPINFORGE_HOME/.env"
echo ""
echo "Next steps:"
echo "  1. Configure DNS for your domain"
echo "  2. Setup SSL with: certbot --nginx -d '*.yourdomain.com'"
echo "  3. Access UI at: http://yourdomain.com"
```

---

## Post-Installation

### 1. Configure DNS

Point your domain to the server:
```
*.spinforge.example.com -> Your server IP
spinforge.example.com -> Your server IP
```

### 2. Setup SSL

**Docker/K8s with cert-manager:**
Already configured in the setup

**Bare metal with Let's Encrypt:**
```bash
sudo certbot --nginx -d "*.spinforge.example.com" -d "spinforge.example.com"
```

### 3. Configure Backups

```bash
# Create backup script
cat > /opt/spinforge/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/spinforge/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup Redis
redis-cli -a $REDIS_PASSWORD --rdb $BACKUP_DIR/dump.rdb

# Backup deployments
tar -czf $BACKUP_DIR/deployments.tar.gz /opt/spinforge/deployments

# Backup configs
cp /opt/spinforge/.env $BACKUP_DIR/

# Clean old backups (keep 7 days)
find /opt/spinforge/backups -type d -mtime +7 -exec rm -rf {} +
EOF

# Add to crontab
crontab -e
# Add: 0 2 * * * /opt/spinforge/backup.sh
```

### 4. Monitor Services

- Grafana: http://localhost:9009
- Prometheus: http://localhost:9008
- PM2 Monitor: `pm2 monit`

### 5. Initial Admin Setup

```bash
# Create first admin user
docker exec spinforge-hub node scripts/create-admin.js \
  --username admin \
  --email admin@example.com

# Deploy test app
curl -X POST http://localhost:9004/api/routes \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "test.localhost",
    "customerId": "test",
    "gitUrl": "https://github.com/spinforge/example-express"
  }'
```

---

## Troubleshooting Setup

### Docker Issues

```bash
# Reset everything
docker-compose down -v
docker-compose up -d

# View detailed logs
docker-compose logs -f spinhub

# Exec into container
docker exec -it spinforge-hub bash
```

### Kubernetes Issues

```bash
# Check pod logs
kubectl logs -n spinforge -l app=spinhub --tail=100

# Describe pod
kubectl describe pod -n spinforge spinhub-0

# Get events
kubectl get events -n spinforge --sort-by='.lastTimestamp'
```

### Bare Metal Issues

```bash
# Check PM2 logs
pm2 logs --lines 100

# Restart services
pm2 restart all

# Check Redis
redis-cli -a $REDIS_PASSWORD ping

# Check ports
netstat -tlnp | grep -E '(8080|16378|80|443)'
```

### Common Problems

1. **Port conflicts**: Change ports in .env
2. **Permission denied**: Check file ownership
3. **Redis connection**: Verify password and host
4. **Out of memory**: Increase system resources
5. **SSL issues**: Check certificate paths

For more help, see the [Troubleshooting Guide](./06-troubleshooting.md).