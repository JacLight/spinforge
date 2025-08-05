#!/bin/bash
# SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# SpinForge Virtual Hosting Manager

API_URL="${API_URL:-http://localhost:18080}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "SpinForge Virtual Hosting Manager"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list                    List all virtual hosts"
    echo "  get <subdomain>         Get virtual host details"
    echo "  create <subdomain>      Create a new virtual host"
    echo "  update <subdomain>      Update a virtual host"
    echo "  delete <subdomain>      Delete a virtual host"
    echo "  enable <subdomain>      Enable a virtual host"
    echo "  disable <subdomain>     Disable a virtual host"
    echo ""
    exit 1
}

# Pretty print JSON
pretty_json() {
    if command -v jq &> /dev/null; then
        jq .
    else
        python3 -m json.tool 2>/dev/null || cat
    fi
}

# List all virtual hosts
list_vhosts() {
    echo -e "${BLUE}Listing virtual hosts...${NC}"
    curl -s "$API_URL/api/vhost" | pretty_json
}

# Get virtual host details
get_vhost() {
    local subdomain=$1
    if [ -z "$subdomain" ]; then
        echo -e "${RED}Error: Subdomain required${NC}"
        usage
    fi
    
    echo -e "${BLUE}Getting details for ${subdomain}.spinforge.io...${NC}"
    curl -s "$API_URL/api/vhost/$subdomain" | pretty_json
}

# Create virtual host
create_vhost() {
    local subdomain=$1
    if [ -z "$subdomain" ]; then
        echo -e "${RED}Error: Subdomain required${NC}"
        usage
    fi
    
    echo -e "${BLUE}Creating virtual host: ${subdomain}.spinforge.io${NC}"
    echo ""
    echo "Select type:"
    echo "1) Proxy - Reverse proxy to URL"
    echo "2) Static - Serve static files"
    echo "3) Container - Proxy to Docker container"
    echo "4) Load Balancer - Multiple backends"
    echo ""
    read -p "Choice (1-4): " type_choice
    
    case $type_choice in
        1)
            read -p "Upstream URL: " upstream
            data=$(cat <<EOF
{
    "subdomain": "$subdomain",
    "type": "proxy",
    "upstream": "$upstream",
    "enabled": true
}
EOF
            )
            ;;
        2)
            data=$(cat <<EOF
{
    "subdomain": "$subdomain",
    "type": "static",
    "enabled": true
}
EOF
            )
            echo -e "${YELLOW}Upload files to: ./data/static/$subdomain/${NC}"
            ;;
        3)
            read -p "Container name: " container
            read -p "Container port (default: 80): " port
            port=${port:-80}
            data=$(cat <<EOF
{
    "subdomain": "$subdomain",
    "type": "container",
    "containerName": "$container",
    "port": $port,
    "enabled": true
}
EOF
            )
            ;;
        4)
            backends=()
            echo "Enter backend URLs (empty to finish):"
            while true; do
                read -p "Backend URL: " backend
                [ -z "$backend" ] && break
                backends+=("\"$backend\"")
            done
            
            backends_json=$(IFS=,; echo "[${backends[*]}]")
            data=$(cat <<EOF
{
    "subdomain": "$subdomain",
    "type": "loadbalancer",
    "backends": $backends_json,
    "enabled": true
}
EOF
            )
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
    
    # Optional: Cookie-based routing
    read -p "Enable cookie-based routing? (y/N): " enable_cookie
    if [[ "$enable_cookie" =~ ^[Yy]$ ]]; then
        cookie_routes=()
        echo "Add cookie routing rules (empty cookie name to finish):"
        while true; do
            read -p "Cookie pattern (e.g., session_id=app1): " cookie
            [ -z "$cookie" ] && break
            read -p "Route name: " route_name
            read -p "Backend URL: " backend
            cookie_routes+=("{\"name\": \"$route_name\", \"cookie\": \"$cookie\", \"backend\": \"$backend\"}")
        done
        
        if [ ${#cookie_routes[@]} -gt 0 ]; then
            cookie_json=$(IFS=,; echo "[${cookie_routes[*]}]")
            data=$(echo "$data" | jq ". + {\"cookieRouting\": $cookie_json}")
        fi
    fi
    
    # Optional: Rate limiting
    read -p "Enable rate limiting? (y/N): " enable_rate
    if [[ "$enable_rate" =~ ^[Yy]$ ]]; then
        read -p "Requests per minute (default: 60): " rate_limit
        rate_limit=${rate_limit:-60}
        data=$(echo "$data" | jq ". + {\"rateLimit\": {\"requests\": $rate_limit}}")
    fi
    
    # Create the virtual host
    response=$(curl -s -X POST "$API_URL/api/vhost" \
        -H "Content-Type: application/json" \
        -d "$data")
    
    if echo "$response" | grep -q "error"; then
        echo -e "${RED}Failed to create virtual host:${NC}"
        echo "$response" | pretty_json
    else
        echo -e "${GREEN}✓ Virtual host created successfully${NC}"
        echo "$response" | pretty_json
        echo ""
        echo -e "${BLUE}Your site will be available at: https://${subdomain}.spinforge.io${NC}"
    fi
}

# Update virtual host
update_vhost() {
    local subdomain=$1
    if [ -z "$subdomain" ]; then
        echo -e "${RED}Error: Subdomain required${NC}"
        usage
    fi
    
    echo -e "${BLUE}Updating ${subdomain}.spinforge.io${NC}"
    echo "What would you like to update?"
    echo "1) Upstream/Backend"
    echo "2) Cookie routing"
    echo "3) Rate limiting"
    echo "4) Custom headers"
    read -p "Choice: " choice
    
    case $choice in
        1)
            # Get current config
            current=$(curl -s "$API_URL/api/vhost/$subdomain")
            type=$(echo "$current" | jq -r '.type')
            
            case $type in
                proxy)
                    read -p "New upstream URL: " upstream
                    data="{\"upstream\": \"$upstream\"}"
                    ;;
                container)
                    read -p "New container name: " container
                    read -p "New port: " port
                    data="{\"containerName\": \"$container\", \"port\": $port}"
                    ;;
                loadbalancer)
                    backends=()
                    echo "Enter new backend URLs (empty to finish):"
                    while true; do
                        read -p "Backend URL: " backend
                        [ -z "$backend" ] && break
                        backends+=("\"$backend\"")
                    done
                    backends_json=$(IFS=,; echo "[${backends[*]}]")
                    data="{\"backends\": $backends_json}"
                    ;;
            esac
            ;;
        2)
            cookie_routes=()
            echo "Add cookie routing rules (empty to finish):"
            while true; do
                read -p "Cookie pattern: " cookie
                [ -z "$cookie" ] && break
                read -p "Route name: " route_name
                read -p "Backend URL: " backend
                cookie_routes+=("{\"name\": \"$route_name\", \"cookie\": \"$cookie\", \"backend\": \"$backend\"}")
            done
            cookie_json=$(IFS=,; echo "[${cookie_routes[*]}]")
            data="{\"cookieRouting\": $cookie_json}"
            ;;
        3)
            read -p "Requests per minute: " rate
            data="{\"rateLimit\": {\"requests\": $rate}}"
            ;;
        4)
            headers="{}"
            echo "Enter headers (empty name to finish):"
            while true; do
                read -p "Header name: " name
                [ -z "$name" ] && break
                read -p "Header value: " value
                headers=$(echo "$headers" | jq ". + {\"$name\": \"$value\"}")
            done
            data="{\"headers\": $headers}"
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
    
    response=$(curl -s -X PUT "$API_URL/api/vhost/$subdomain" \
        -H "Content-Type: application/json" \
        -d "$data")
    
    echo "$response" | pretty_json
}

# Delete virtual host
delete_vhost() {
    local subdomain=$1
    if [ -z "$subdomain" ]; then
        echo -e "${RED}Error: Subdomain required${NC}"
        usage
    fi
    
    echo -e "${YELLOW}Warning: This will delete ${subdomain}.spinforge.io${NC}"
    read -p "Are you sure? (y/N): " confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        exit 0
    fi
    
    response=$(curl -s -X DELETE "$API_URL/api/vhost/$subdomain")
    echo "$response" | pretty_json
}

# Enable/Disable shortcuts
enable_vhost() {
    local subdomain=$1
    if [ -z "$subdomain" ]; then
        echo -e "${RED}Error: Subdomain required${NC}"
        usage
    fi
    
    curl -s -X PUT "$API_URL/api/vhost/$subdomain" \
        -H "Content-Type: application/json" \
        -d '{"enabled": true}' | pretty_json
}

disable_vhost() {
    local subdomain=$1
    if [ -z "$subdomain" ]; then
        echo -e "${RED}Error: Subdomain required${NC}"
        usage
    fi
    
    curl -s -X PUT "$API_URL/api/vhost/$subdomain" \
        -H "Content-Type: application/json" \
        -d '{"enabled": false}' | pretty_json
}

# Main command handler
case "${1:-}" in
    list)
        list_vhosts
        ;;
    get)
        get_vhost "$2"
        ;;
    create)
        create_vhost "$2"
        ;;
    update)
        update_vhost "$2"
        ;;
    delete)
        delete_vhost "$2"
        ;;
    enable)
        enable_vhost "$2"
        ;;
    disable)
        disable_vhost "$2"
        ;;
    *)
        usage
        ;;
esac