#!/bin/bash

# SpinForge Backup Script
# Backs up KeyDB data and build artifacts

set -euo pipefail

# Configuration
BACKUP_DIR=${BACKUP_DIR:-/var/backups/spinforge}
DATA_DIR=${DATA_DIR:-/var/lib/spinforge}
RETENTION_DAYS=${RETENTION_DAYS:-7}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="spinforge_backup_${TIMESTAMP}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

# Check if running as root or with appropriate permissions
check_permissions() {
    if [[ ! -w "$BACKUP_DIR" ]]; then
        error "Cannot write to backup directory: $BACKUP_DIR"
    fi
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
    log "Created backup directory: $BACKUP_DIR/$BACKUP_NAME"
}

# Backup KeyDB data
backup_keydb() {
    log "Backing up KeyDB data..."
    
    # Check if KeyDB is running
    if command -v keydb-cli &> /dev/null; then
        # Trigger BGSAVE
        keydb-cli BGSAVE || warning "Could not trigger KeyDB background save"
        
        # Wait for background save to complete
        while [ $(keydb-cli LASTSAVE) -eq $(keydb-cli LASTSAVE) ]; do
            sleep 1
        done
    fi
    
    # Copy KeyDB data files
    if [[ -d "/var/lib/keydb" ]]; then
        cp -r /var/lib/keydb "$BACKUP_DIR/$BACKUP_NAME/keydb"
    elif [[ -d "$DATA_DIR/keydb" ]]; then
        cp -r "$DATA_DIR/keydb" "$BACKUP_DIR/$BACKUP_NAME/keydb"
    else
        warning "KeyDB data directory not found"
    fi
}

# Backup build artifacts
backup_builds() {
    log "Backing up build artifacts..."
    
    if [[ -d "$DATA_DIR/builds" ]]; then
        # Use rsync for efficient copying
        if command -v rsync &> /dev/null; then
            rsync -a --info=progress2 "$DATA_DIR/builds/" "$BACKUP_DIR/$BACKUP_NAME/builds/"
        else
            cp -r "$DATA_DIR/builds" "$BACKUP_DIR/$BACKUP_NAME/builds"
        fi
    else
        warning "Builds directory not found"
    fi
}

# Backup configuration
backup_config() {
    log "Backing up configuration..."
    
    # SpinForge config
    if [[ -d "/opt/spinforge/config" ]]; then
        cp -r /opt/spinforge/config "$BACKUP_DIR/$BACKUP_NAME/config"
    fi
    
    # System config
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME/system"
    
    # Copy service files if they exist
    [[ -f /etc/systemd/system/spinforge.service ]] && cp /etc/systemd/system/spinforge.service "$BACKUP_DIR/$BACKUP_NAME/system/"
    [[ -f /etc/nginx/sites-available/spinforge ]] && cp /etc/nginx/sites-available/spinforge "$BACKUP_DIR/$BACKUP_NAME/system/"
    [[ -f /etc/logrotate.d/spinforge ]] && cp /etc/logrotate.d/spinforge "$BACKUP_DIR/$BACKUP_NAME/system/"
}

# Create metadata file
create_metadata() {
    log "Creating backup metadata..."
    
    cat > "$BACKUP_DIR/$BACKUP_NAME/metadata.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "version": "$(node --version 2>/dev/null || echo 'unknown')",
  "hostname": "$(hostname)",
  "backup_type": "full",
  "components": {
    "keydb": $([ -d "$BACKUP_DIR/$BACKUP_NAME/keydb" ] && echo "true" || echo "false"),
    "builds": $([ -d "$BACKUP_DIR/$BACKUP_NAME/builds" ] && echo "true" || echo "false"),
    "config": $([ -d "$BACKUP_DIR/$BACKUP_NAME/config" ] && echo "true" || echo "false")
  }
}
EOF
}

# Compress backup
compress_backup() {
    log "Compressing backup..."
    
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    
    # Remove uncompressed directory
    rm -rf "$BACKUP_NAME"
    
    # Calculate size
    SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
    log "Backup size: $SIZE"
}

# Upload to remote storage (optional)
upload_backup() {
    if [[ -n "${S3_BUCKET:-}" ]]; then
        log "Uploading to S3..."
        
        if command -v aws &> /dev/null; then
            aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "s3://$S3_BUCKET/spinforge-backups/" || warning "S3 upload failed"
        else
            warning "AWS CLI not installed, skipping S3 upload"
        fi
    fi
    
    if [[ -n "${RSYNC_DEST:-}" ]]; then
        log "Syncing to remote server..."
        rsync -avz "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "$RSYNC_DEST" || warning "Rsync failed"
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "spinforge_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
    
    # S3 cleanup (if configured)
    if [[ -n "${S3_BUCKET:-}" ]] && command -v aws &> /dev/null; then
        aws s3 ls "s3://$S3_BUCKET/spinforge-backups/" | while read -r line; do
            FILE_DATE=$(echo "$line" | awk '{print $1" "$2}')
            FILE_NAME=$(echo "$line" | awk '{print $4}')
            
            if [[ $(date -d "$FILE_DATE" +%s) -lt $(date -d "$RETENTION_DAYS days ago" +%s) ]]; then
                aws s3 rm "s3://$S3_BUCKET/spinforge-backups/$FILE_NAME"
            fi
        done
    fi
}

# Send notification (optional)
send_notification() {
    local status=$1
    local message=$2
    
    # Slack webhook (if configured)
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"SpinForge Backup $status: $message\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
    
    # Email notification (if configured)
    if [[ -n "${EMAIL_TO:-}" ]] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "SpinForge Backup $status" "$EMAIL_TO" || true
    fi
}

# Main backup process
main() {
    log "Starting SpinForge backup..."
    
    # Trap errors
    trap 'error "Backup failed at line $LINENO"' ERR
    
    check_permissions
    create_backup_dir
    backup_keydb
    backup_builds
    backup_config
    create_metadata
    compress_backup
    upload_backup
    cleanup_old_backups
    
    log "Backup completed successfully: ${BACKUP_NAME}.tar.gz"
    send_notification "SUCCESS" "Backup completed: ${BACKUP_NAME}.tar.gz"
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -d, --backup-dir DIR      Backup directory (default: /var/backups/spinforge)"
    echo "  -r, --retention DAYS      Retention period in days (default: 7)"
    echo "  -s, --s3-bucket BUCKET    S3 bucket for remote backup"
    echo "  -h, --help               Show this help message"
    echo
    echo "Environment variables:"
    echo "  BACKUP_DIR               Backup directory"
    echo "  DATA_DIR                 SpinForge data directory"
    echo "  RETENTION_DAYS           Backup retention period"
    echo "  S3_BUCKET               S3 bucket name"
    echo "  SLACK_WEBHOOK           Slack webhook URL"
    echo "  EMAIL_TO                Email address for notifications"
    echo
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -r|--retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -s|--s3-bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Run backup
main "$@"