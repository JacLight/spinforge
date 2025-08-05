#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# SpinForge Docker Management Script
# Simplified version for the new architecture

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

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

# Build all images
build_all() {
    log_info "Building all SpinForge images..."
    
    # Build gateway
    log_info "Building OpenResty gateway..."
    docker-compose -f "$COMPOSE_FILE" build gateway
    
    # Build hub
    log_info "Building SpinHub..."
    docker-compose -f "$COMPOSE_FILE" build spinhub
    
    # Build builder
    log_info "Building builder service..."
    docker-compose -f "$COMPOSE_FILE" build builder
    
    # Build UI
    log_info "Building UI..."
    docker-compose -f "$COMPOSE_FILE" build ui
    
    log_success "All images built successfully"
}

# Start services
start_services() {
    local services="${1:-}"
    
    if [ -z "$services" ]; then
        log_info "Starting all SpinForge services..."
        docker-compose -f "$COMPOSE_FILE" up -d
    else
        log_info "Starting services: $services"
        docker-compose -f "$COMPOSE_FILE" up -d $services
    fi
    
    log_success "Services started"
}

# Stop services
stop_services() {
    log_info "Stopping SpinForge services..."
    docker-compose -f "$COMPOSE_FILE" stop
    log_success "Services stopped"
}

# Restart services
restart_services() {
    local service="${1:-}"
    
    if [ -z "$service" ]; then
        log_info "Restarting all services..."
        docker-compose -f "$COMPOSE_FILE" restart
    else
        log_info "Restarting $service..."
        docker-compose -f "$COMPOSE_FILE" restart "$service"
    fi
    
    log_success "Services restarted"
}

# Check health status
check_health() {
    log_info "Checking service health..."
    
    # Check KeyDB
    if docker-compose exec -T keydb redis-cli ping | grep -q PONG; then
        log_success "KeyDB is healthy"
    else
        log_error "KeyDB health check failed"
    fi
    
    # Check Gateway
    if curl -f -s http://localhost:9006/_health > /dev/null; then
        log_success "Gateway is healthy"
    else
        log_error "Gateway health check failed"
    fi
    
    # Check SpinHub
    if curl -f -s http://localhost:9004/_health > /dev/null; then
        log_success "SpinHub is healthy"
    else
        log_error "SpinHub health check failed"
    fi
    
    # Check UI
    if curl -f -s http://localhost:9010 > /dev/null; then
        log_success "UI is accessible"
    else
        log_warning "UI not accessible"
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

# Show status
show_status() {
    log_info "Service Status:"
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log_info "Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# Clean up resources
cleanup() {
    log_info "Cleaning up resources..."
    
    # Remove stopped containers
    docker-compose -f "$COMPOSE_FILE" rm -f
    
    # Prune unused volumes (with confirmation)
    read -p "Remove unused volumes? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume prune -f
    fi
    
    # Clean build cache
    docker builder prune -f
    
    log_success "Cleanup completed"
}

# Quick deploy for testing
quick_deploy() {
    local path="${1:-}"
    local domain="${2:-}"
    
    if [ -z "$path" ] || [ -z "$domain" ]; then
        log_error "Usage: $0 deploy <path> <domain>"
        exit 1
    fi
    
    log_info "Quick deploying from $path to $domain..."
    
    # Copy to deployments directory
    cp -r "$path" "$PROJECT_ROOT/deployments/"
    
    log_success "Deployment copied. The hot deployment watcher will process it automatically."
}

# Reset everything
reset_all() {
    log_warning "This will remove all SpinForge data and containers!"
    read -p "Are you sure? (yes/no) " -r
    if [[ $REPLY != "yes" ]]; then
        log_info "Reset cancelled"
        exit 0
    fi
    
    log_info "Resetting SpinForge..."
    
    # Stop and remove containers
    docker-compose -f "$COMPOSE_FILE" down -v
    
    # Remove deployments
    rm -rf "$PROJECT_ROOT/deployments/"*
    rm -rf "$PROJECT_ROOT/builds/"*
    
    log_success "Reset complete"
}

# Main menu
show_help() {
    cat << EOF
SpinForge Docker Management Script

Usage: $0 <command> [options]

Commands:
    build           Build all Docker images
    start [service] Start all services or specific service
    stop            Stop all services
    restart [svc]   Restart all services or specific service
    status          Show service status
    health          Check service health
    logs [service]  View logs (all or specific service)
    deploy <p> <d>  Quick deploy from path to domain
    cleanup         Clean up unused resources
    reset           Reset everything (CAUTION!)
    help            Show this help message

Services:
    gateway         OpenResty gateway (port 9006)
    spinhub         Management server (port 9004)
    keydb           Redis-compatible database (port 9000)
    builder         Build service
    ui              Web UI (port 9010)
    prometheus      Metrics collection (port 9008)
    grafana         Monitoring dashboard (port 9009)

Examples:
    $0 build                    # Build all images
    $0 start                    # Start all services
    $0 restart gateway          # Restart gateway only
    $0 logs gateway             # View gateway logs
    $0 deploy ./myapp test.local # Deploy myapp to test.local

EOF
}

# Main logic
main() {
    check_dependencies
    
    case "${1:-help}" in
        build)
            build_all
            ;;
        start)
            start_services "${2:-}"
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services "${2:-}"
            ;;
        status)
            show_status
            ;;
        health)
            check_health
            ;;
        logs)
            view_logs "${2:-}"
            ;;
        deploy)
            quick_deploy "${2:-}" "${3:-}"
            ;;
        cleanup)
            cleanup
            ;;
        reset)
            reset_all
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"