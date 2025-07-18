#!/bin/bash

# SpinForge Production Installation Script
# This script installs SpinForge on a production server

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SPINFORGE_USER=${SPINFORGE_USER:-spinforge}
SPINFORGE_DIR=${SPINFORGE_DIR:-/opt/spinforge}
SPINFORGE_DATA=${SPINFORGE_DATA:-/var/lib/spinforge}
SPINFORGE_LOG=${SPINFORGE_LOG:-/var/log/spinforge}
NODE_VERSION=${NODE_VERSION:-20}

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
    fi
}

check_os() {
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        error "This script only supports Linux"
    fi
    
    # Check for systemd
    if ! command -v systemctl &> /dev/null; then
        error "This script requires systemd"
    fi
}

install_dependencies() {
    log "Installing system dependencies..."
    
    # Update package manager
    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y curl git build-essential
    elif command -v yum &> /dev/null; then
        yum update -y
        yum install -y curl git gcc-c++ make
    else
        error "Unsupported package manager"
    fi
}

install_node() {
    log "Installing Node.js ${NODE_VERSION}..."
    
    # Install Node.js using NodeSource repository
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
        apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
        yum install -y nodejs
    fi
    
    # Verify installation
    node_version=$(node --version)
    log "Node.js ${node_version} installed"
}

install_keydb() {
    log "Installing KeyDB..."
    
    if command -v apt-get &> /dev/null; then
        # Add KeyDB repository
        curl -fsSL https://download.keydb.dev/pkg/open_source/deb/pubkey.gpg | apt-key add -
        echo "deb https://download.keydb.dev/pkg/open_source/deb $(lsb_release -sc) main" | tee /etc/apt/sources.list.d/keydb.list
        apt-get update
        apt-get install -y keydb-server keydb-tools
    else
        # For other systems, build from source
        warning "KeyDB package not available, installing Redis instead"
        if command -v yum &> /dev/null; then
            yum install -y redis
            systemctl enable redis
            systemctl start redis
        fi
    fi
}

create_user() {
    log "Creating SpinForge user..."
    
    if ! id "$SPINFORGE_USER" &>/dev/null; then
        useradd --system --shell /bin/bash --home-dir "$SPINFORGE_DIR" "$SPINFORGE_USER"
    fi
    
    # Create directories
    mkdir -p "$SPINFORGE_DIR" "$SPINFORGE_DATA" "$SPINFORGE_LOG"
    mkdir -p "$SPINFORGE_DATA"/{builds,data,cache}
    
    # Set permissions
    chown -R "$SPINFORGE_USER:$SPINFORGE_USER" "$SPINFORGE_DIR" "$SPINFORGE_DATA" "$SPINFORGE_LOG"
}

install_spinforge() {
    log "Installing SpinForge..."
    
    cd "$SPINFORGE_DIR"
    
    # Clone repository (or download release)
    if [[ -d ".git" ]]; then
        log "Updating existing installation..."
        sudo -u "$SPINFORGE_USER" git pull
    else
        log "Cloning SpinForge repository..."
        sudo -u "$SPINFORGE_USER" git clone https://github.com/spinforge/spinforge.git .
    fi
    
    # Install dependencies
    log "Installing Node.js dependencies..."
    sudo -u "$SPINFORGE_USER" npm ci --production
    
    # Build packages
    log "Building SpinForge packages..."
    sudo -u "$SPINFORGE_USER" npm run build
}

configure_spinforge() {
    log "Configuring SpinForge..."
    
    # Create configuration file
    cat > "$SPINFORGE_DIR/config/production.json" <<EOF
{
  "hub": {
    "port": 8080,
    "host": "0.0.0.0",
    "trustProxy": true,
    "rateLimits": {
      "global": {
        "windowMs": 60000,
        "max": 10000
      },
      "perCustomer": {
        "windowMs": 60000,
        "max": 1000
      }
    }
  },
  "redis": {
    "host": "localhost",
    "port": 6379,
    "db": 0
  },
  "spinlets": {
    "portRange": {
      "start": 30000,
      "end": 40000
    },
    "idleTimeout": 300000,
    "maxPerHost": 500
  },
  "storage": {
    "builds": "$SPINFORGE_DATA/builds",
    "data": "$SPINFORGE_DATA/data",
    "cache": "$SPINFORGE_DATA/cache"
  },
  "logging": {
    "level": "info",
    "file": "$SPINFORGE_LOG/spinforge.log"
  }
}
EOF
    
    chown "$SPINFORGE_USER:$SPINFORGE_USER" "$SPINFORGE_DIR/config/production.json"
}

create_systemd_service() {
    log "Creating systemd service..."
    
    cat > /etc/systemd/system/spinforge.service <<EOF
[Unit]
Description=SpinForge - Dynamic Runtime Platform
Documentation=https://github.com/spinforge/spinforge
After=network.target keydb.service

[Service]
Type=simple
User=$SPINFORGE_USER
Group=$SPINFORGE_USER
WorkingDirectory=$SPINFORGE_DIR
Environment="NODE_ENV=production"
Environment="SPINFORGE_CONFIG=$SPINFORGE_DIR/config/production.json"
ExecStart=/usr/bin/node $SPINFORGE_DIR/packages/spinlet-hub/dist/server.js
Restart=always
RestartSec=10
StandardOutput=append:$SPINFORGE_LOG/spinforge.log
StandardError=append:$SPINFORGE_LOG/spinforge-error.log

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$SPINFORGE_DATA $SPINFORGE_LOG

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable spinforge.service
}

configure_firewall() {
    log "Configuring firewall..."
    
    # Check if ufw is installed
    if command -v ufw &> /dev/null; then
        ufw allow 8080/tcp comment "SpinForge Hub"
        ufw allow 30000:40000/tcp comment "SpinForge Spinlets"
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port=8080/tcp
        firewall-cmd --permanent --add-port=30000-40000/tcp
        firewall-cmd --reload
    else
        warning "No firewall detected. Please manually configure ports 8080 and 30000-40000"
    fi
}

setup_nginx() {
    log "Setting up Nginx reverse proxy..."
    
    # Install Nginx if not present
    if ! command -v nginx &> /dev/null; then
        if command -v apt-get &> /dev/null; then
            apt-get install -y nginx
        elif command -v yum &> /dev/null; then
            yum install -y nginx
        fi
    fi
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/spinforge <<'EOF'
server {
    listen 80;
    server_name _;
    
    # Increase timeouts for long-running requests
    proxy_connect_timeout 60s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    
    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Admin routes (restrict in production!)
    location /_admin {
        # Add IP restrictions here
        # allow 10.0.0.0/8;
        # deny all;
        proxy_pass http://localhost:8080;
    }
    
    # Health check
    location /_health {
        proxy_pass http://localhost:8080;
    }
    
    # All other traffic
    location / {
        proxy_pass http://localhost:8080;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/spinforge /etc/nginx/sites-enabled/
    
    # Test and reload Nginx
    nginx -t && systemctl reload nginx
}

setup_monitoring() {
    log "Setting up monitoring..."
    
    # Create log rotation
    cat > /etc/logrotate.d/spinforge <<EOF
$SPINFORGE_LOG/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 $SPINFORGE_USER $SPINFORGE_USER
    sharedscripts
    postrotate
        systemctl reload spinforge >/dev/null 2>&1 || true
    endscript
}
EOF
}

print_summary() {
    log "Installation complete!"
    echo
    echo "SpinForge has been installed successfully!"
    echo
    echo "Installation Summary:"
    echo "  - User: $SPINFORGE_USER"
    echo "  - Directory: $SPINFORGE_DIR"
    echo "  - Data: $SPINFORGE_DATA"
    echo "  - Logs: $SPINFORGE_LOG"
    echo "  - Service: spinforge.service"
    echo "  - Port: 8080 (behind Nginx)"
    echo
    echo "Next steps:"
    echo "  1. Review configuration: $SPINFORGE_DIR/config/production.json"
    echo "  2. Start SpinForge: systemctl start spinforge"
    echo "  3. Check status: systemctl status spinforge"
    echo "  4. View logs: journalctl -u spinforge -f"
    echo "  5. Configure SSL with Let's Encrypt (recommended)"
    echo
    echo "Security recommendations:"
    echo "  - Restrict access to /_admin routes in Nginx"
    echo "  - Enable SSL/TLS encryption"
    echo "  - Configure firewall rules"
    echo "  - Set up monitoring and alerting"
    echo
}

# Main installation flow
main() {
    log "Starting SpinForge installation..."
    
    check_root
    check_os
    install_dependencies
    install_node
    install_keydb
    create_user
    install_spinforge
    configure_spinforge
    create_systemd_service
    configure_firewall
    setup_nginx
    setup_monitoring
    print_summary
}

# Run main function
main "$@"