#!/bin/bash

# SpinForge Docker Management Script
# This script helps manage SpinForge Docker deployments

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
CLUSTER_FILE="${PROJECT_ROOT}/docker-compose.cluster.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check dependencies
check_dependencies() {
    local deps=("docker" "docker-compose")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "$dep is not installed"
            exit 1
        fi
    done
    log_success "All dependencies are installed"
}

# Setup environment
setup_env() {
    if [ ! -f "${PROJECT_ROOT}/.env" ]; then
        log_info "Creating .env file from template..."
        cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"
        log_warning "Please edit .env file with your configuration"
        exit 1
    fi
    log_success "Environment file exists"
}

# Build images
build_images() {
    log_info "Building Docker images..."
    docker-compose -f "$COMPOSE_FILE" build
    log_success "Images built successfully"
}

# Start services
start_services() {
    local mode="${1:-single}"
    
    if [ "$mode" = "cluster" ]; then
        log_info "Starting services in cluster mode..."
        docker-compose -f "$COMPOSE_FILE" -f "$CLUSTER_FILE" up -d
    else
        log_info "Starting services in single mode..."
        docker-compose -f "$COMPOSE_FILE" up -d
    fi
    
    log_success "Services started successfully"
}

# Stop services
stop_services() {
    log_info "Stopping services..."
    docker-compose -f "$COMPOSE_FILE" down
    log_success "Services stopped"
}

# Check service health
check_health() {
    log_info "Checking service health..."
    
    # Check SpinHub
    if curl -f -s http://localhost/_health > /dev/null; then
        log_success "SpinHub is healthy"
    else
        log_error "SpinHub health check failed"
    fi
    
    # Check KeyDB
    if docker-compose exec -T keydb redis-cli ping | grep -q PONG; then
        log_success "KeyDB is healthy"
    else
        log_error "KeyDB health check failed"
    fi
    
    # Check Grafana
    if curl -f -s http://localhost:3000/api/health > /dev/null; then
        log_success "Grafana is healthy"
    else
        log_warning "Grafana health check failed (may still be starting)"
    fi
}

# View logs
view_logs() {
    local service="${1:-}"
    if [ -z "$service" ]; then
        docker-compose -f "$COMPOSE_FILE" logs -f
    else
        docker-compose -f "$COMPOSE_FILE" logs -f "$service"
    fi
}

# Deploy an app
deploy_app() {
    local source="${1:-}"
    local domain="${2:-}"
    
    if [ -z "$source" ] || [ -z "$domain" ]; then
        log_error "Usage: $0 deploy <source> <domain>"
        exit 1
    fi
    
    log_info "Deploying app from $source to $domain..."
    
    docker-compose run --rm cli spinforge deploy \
        --source "$source" \
        --domain "$domain" \
        --framework auto
    
    log_success "App deployed successfully"
}

# Backup data
backup_data() {
    log_info "Creating backup..."
    docker-compose exec backup /scripts/backup.sh
    log_success "Backup completed"
}

# Scale service
scale_service() {
    local service="${1:-}"
    local count="${2:-}"
    
    if [ -z "$service" ] || [ -z "$count" ]; then
        log_error "Usage: $0 scale <service> <count>"
        exit 1
    fi
    
    log_info "Scaling $service to $count instances..."
    docker-compose -f "$COMPOSE_FILE" up -d --scale "$service=$count"
    log_success "Scaling completed"
}

# Clean up resources
cleanup() {
    log_info "Cleaning up resources..."
    
    # Remove stopped containers
    docker-compose -f "$COMPOSE_FILE" rm -f
    
    # Prune unused volumes
    docker volume prune -f
    
    # Clean build cache
    docker builder prune -f
    
    log_success "Cleanup completed"
}

# Show status
show_status() {
    log_info "Service Status:"
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log_info "Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# Main menu
show_help() {
    cat << EOF
SpinForge Docker Management Script

Usage: $0 <command> [options]

Commands:
    setup           Set up environment and check dependencies
    build           Build Docker images
    start [mode]    Start services (mode: single|cluster)
    stop            Stop all services
    restart         Restart all services
    health          Check service health
    logs [service]  View logs (optionally for specific service)
    deploy <src> <domain>  Deploy an application
    scale <service> <count>  Scale a service
    backup          Create data backup
    cleanup         Clean up resources
    status          Show service status
    help            Show this help message

Examples:
    $0 setup
    $0 start
    $0 start cluster
    $0 logs spinhub
    $0 deploy ./my-app myapp.local
    $0 scale spinhub 3

EOF
}

# Main script
main() {
    cd "$PROJECT_ROOT"
    
    case "${1:-help}" in
        setup)
            check_dependencies
            setup_env
            ;;
        build)
            build_images
            ;;
        start)
            start_services "${2:-single}"
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            start_services "${2:-single}"
            ;;
        health)
            check_health
            ;;
        logs)
            view_logs "${2:-}"
            ;;
        deploy)
            deploy_app "${2:-}" "${3:-}"
            ;;
        scale)
            scale_service "${2:-}" "${3:-}"
            ;;
        backup)
            backup_data
            ;;
        cleanup)
            cleanup
            ;;
        status)
            show_status
            ;;
        help|*)
            show_help
            ;;
    esac
}

main "$@"