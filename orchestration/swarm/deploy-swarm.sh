#!/bin/bash
# SpinForge Docker Swarm Deployment Script
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SWARM_STACK_NAME="spinforge"

echo -e "${BLUE}🚀 SpinForge Docker Swarm Deployment${NC}"
echo "================================================"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root (not recommended for Docker)
if [[ $EUID -eq 0 ]]; then
    print_warning "Running as root. Consider using a non-root user in the docker group."
fi

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running. Please start Docker."
    exit 1
fi

print_status "Docker is installed and running"

# Check if we're in a Swarm cluster
if ! docker info | grep -q "Swarm: active"; then
    print_info "Initializing Docker Swarm..."
    
    # Get the primary IP address
    PRIMARY_IP=$(hostname -I | awk '{print $1}')
    
    if [ -z "$PRIMARY_IP" ]; then
        print_error "Could not determine primary IP address"
        exit 1
    fi
    
    print_info "Initializing Swarm with advertise address: $PRIMARY_IP"
    docker swarm init --advertise-addr "$PRIMARY_IP"
    
    print_status "Docker Swarm initialized successfully!"
    
    # Show join commands
    echo ""
    print_info "To add worker nodes to this swarm, run the following command on each worker:"
    docker swarm join-token worker | grep docker
    
    echo ""
    print_info "To add manager nodes to this swarm, run the following command on each manager:"
    docker swarm join-token manager | grep docker
    echo ""
else
    print_status "Already in Docker Swarm mode"
fi

# Label the current node
NODE_ID=$(docker node ls --format "{{.ID}}" --filter "role=manager" | head -1)
if [ ! -z "$NODE_ID" ]; then
    docker node update --label-add role=manager "$NODE_ID" 2>/dev/null || true
    print_status "Node labeled as manager"
fi

# Create overlay network if it doesn't exist
if ! docker network ls | grep -q spinforge-swarm; then
    print_info "Creating overlay network 'spinforge-swarm'..."
    docker network create --driver overlay --attachable spinforge-swarm
    print_status "Overlay network created"
else
    print_status "Overlay network already exists"
fi

# Create required directories
create_directories() {
    print_info "Creating required directories..."
    
    local dirs=(
        "$PROJECT_ROOT/orchestration/monitoring"
        "$PROJECT_ROOT/orchestration/logs"
        "$PROJECT_ROOT/orchestration/secrets"
        "$PROJECT_ROOT/orchestration/haproxy/certs"
        "$PROJECT_ROOT/orchestration/haproxy/logs"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
    done
    
    print_status "Directories created"
}

create_directories

# Generate secrets if they don't exist
generate_secrets() {
    print_info "Generating secrets..."
    
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        cat > "$PROJECT_ROOT/.env" << EOF
# SpinForge Environment Configuration
JWT_SECRET=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 16)
GRAFANA_PASSWORD=admin123
HAPROXY_STATS_PASSWORD=admin123

# API Configuration
API_PORT=8080
STATIC_ROOT=/data/static

# Domain Configuration (update for production)
BASE_DOMAIN=localhost
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Orchestration Settings
ORCHESTRATION_MODE=swarm
SCALING_ENABLED=true
SLEEP_ENABLED=true
SLEEP_TIMEOUT_MINUTES=30
EOF
        print_status "Environment file created"
    else
        print_status "Environment file already exists"
    fi
}

generate_secrets

# Create Prometheus configuration
create_prometheus_config() {
    if [ ! -f "$PROJECT_ROOT/orchestration/monitoring/prometheus.yml" ]; then
        print_info "Creating Prometheus configuration..."
        
        cat > "$PROJECT_ROOT/orchestration/monitoring/prometheus.yml" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'spinforge-api'
    static_configs:
      - targets: ['spinforge-api:8080']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'docker-swarm'
    static_configs:
      - targets: ['host.docker.internal:9323']
    scrape_interval: 30s

  - job_name: 'haproxy'
    static_configs:
      - targets: ['host.docker.internal:8405']
    scrape_interval: 30s
EOF
        print_status "Prometheus configuration created"
    fi
}

create_prometheus_config

# Deploy SpinForge stack
deploy_stack() {
    print_info "Deploying SpinForge stack..."
    
    # Change to the project root directory
    cd "$PROJECT_ROOT"
    
    # Deploy the stack
    docker stack deploy -c orchestration/swarm/docker-compose.swarm.yml "$SWARM_STACK_NAME"
    
    print_status "Stack deployed successfully!"
}

deploy_stack

# Wait for services to become ready
wait_for_services() {
    print_info "Waiting for services to become ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        local running_services=$(docker service ls --filter name="${SWARM_STACK_NAME}_" --format "{{.Replicas}}" | grep -c "1/1\|2/2\|3/3" || true)
        local total_services=$(docker service ls --filter name="${SWARM_STACK_NAME}_" | wc -l)
        
        if [ $total_services -gt 1 ]; then
            total_services=$((total_services - 1))  # Subtract header line
        fi
        
        print_info "Services ready: $running_services/$total_services (attempt $attempt/$max_attempts)"
        
        if [ "$running_services" -eq "$total_services" ] && [ "$total_services" -gt 0 ]; then
            print_status "All services are ready!"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_warning "Some services may still be starting. Check with 'docker service ls'"
            break
        fi
        
        sleep 10
        attempt=$((attempt + 1))
    done
}

wait_for_services

# Show service status
show_status() {
    echo ""
    print_info "Service Status:"
    docker service ls --filter name="${SWARM_STACK_NAME}_"
    
    echo ""
    print_info "Node Status:"
    docker node ls
    
    echo ""
    print_status "SpinForge Swarm deployment completed!"
    
    echo ""
    echo "🌐 Access Points:"
    echo "   Admin UI:     http://localhost:8083"
    echo "   API:          http://localhost:8080"
    echo "   Website:      http://localhost:3001"
    echo "   Prometheus:   http://localhost:9090"
    echo "   Grafana:      http://localhost:3000"
    echo ""
    echo "📊 Management Commands:"
    echo "   Service status:    docker service ls"
    echo "   Service logs:      docker service logs ${SWARM_STACK_NAME}_<service-name>"
    echo "   Scale service:     docker service scale ${SWARM_STACK_NAME}_<service-name>=<replicas>"
    echo "   Stack status:      docker stack services ${SWARM_STACK_NAME}"
    echo ""
    echo "🔧 Configuration:"
    echo "   Environment:       .env"
    echo "   Swarm config:      orchestration/swarm/docker-compose.swarm.yml"
    echo "   HAProxy config:    orchestration/haproxy/haproxy.cfg"
    echo ""
}

show_status

# Provide next steps
echo "🎉 SpinForge Docker Swarm is now ready!"
echo ""
echo "Next steps:"
echo "1. Update HAProxy configuration with your actual node IPs"
echo "2. Configure SSL certificates for production"
echo "3. Set up monitoring and alerting"
echo "4. Scale services as needed"
echo ""
echo "For production deployment:"
echo "- Update .env with production values"
echo "- Configure proper SSL certificates"
echo "- Set up automated backups"
echo "- Configure log rotation"
echo ""
