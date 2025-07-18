# SpinForge KeyDB Schema Reference

This document provides a comprehensive reference for all KeyDB data structures used in SpinForge.

## Table of Contents
1. [Naming Conventions](#naming-conventions)
2. [Core Data Structures](#core-data-structures)
3. [Telemetry Schema](#telemetry-schema)
4. [Operations Guide](#operations-guide)
5. [Example Queries](#example-queries)

## Naming Conventions

All keys follow the pattern: `spinforge:{category}:{subcategory}:{identifier}`

- Use colons (`:`) as separators
- Lowercase for categories
- IDs can be mixed case
- Timestamps in Unix epoch format

## Core Data Structures

### 1. Routing & Domain Mapping

#### Domain to Spinlet Mapping
```redis
KEY: spinforge:routes:{domain}
TYPE: JSON
TTL: None (persistent)
EXAMPLE:
{
  "spinletId": "spin-abc123",
  "customerId": "cust-123", 
  "buildVersion": "v42",
  "buildPath": "/spinforge/builds/cust-123/v42",
  "framework": "remix",
  "created": 1737115200,
  "updated": 1737115200,
  "config": {
    "memory": "512MB",
    "cpu": "0.5",
    "env": ["NODE_ENV=production"]
  }
}
```

#### Customer Domain Registry
```redis
KEY: spinforge:customer:{customerId}:domains
TYPE: SET
TTL: None
EXAMPLE: ["example.com", "www.example.com", "api.example.com"]
```

### 2. Spinlet State Management

#### Active Spinlets Registry
```redis
KEY: spinforge:active
TYPE: ZSET (Sorted Set)
TTL: None
SCORE: Last access timestamp
MEMBER: spinletId
USAGE: Track active Spinlets for cleanup
```

#### Spinlet Instance Details
```redis
KEY: spinforge:spinlets:{spinletId}
TYPE: HASH
TTL: 24 hours after stopped
FIELDS:
  pid           - Process ID (number)
  port          - Assigned port (number)
  customerId    - Customer identifier (string)
  startTime     - Unix timestamp (number)
  lastAccess    - Unix timestamp (number)
  state         - running|idle|stopping|stopped
  requests      - Total request count (number)
  errors        - Total error count (number)
  memory        - Current memory usage in bytes (number)
  cpu           - Current CPU percentage (float)
  host          - Host machine identifier (string)
```

#### Port Management
```redis
KEY: spinforge:ports:allocated
TYPE: HASH
FIELD: port number
VALUE: spinletId
EXAMPLE: { "3001": "spin-abc123", "3002": "spin-def456" }

KEY: spinforge:ports:pool
TYPE: LIST
PURPOSE: Available ports ready for allocation
EXAMPLE: ["3003", "3004", "3005"]
```

### 3. Customer Management

#### Customer Profile
```redis
KEY: spinforge:customers:{customerId}
TYPE: JSON
TTL: None
EXAMPLE:
{
  "id": "cust-123",
  "name": "Acme Corporation",
  "email": "admin@acme.com",
  "tier": "pro",
  "status": "active",
  "created": 1737000000,
  "limits": {
    "memory": "2GB",
    "cpu": "2.0",
    "spinlets": 10,
    "requests_per_minute": 1000,
    "bandwidth_gb": 100
  },
  "usage": {
    "current_spinlets": 3,
    "current_memory": "1.2GB"
  }
}
```

## Telemetry Schema

### 1. Request Metrics

#### Per-Minute Metrics
```redis
KEY: spinforge:metrics:requests:{spinletId}:{timestamp}
TYPE: HASH
TTL: 1 hour
FIELDS:
  count         - Request count (number)
  errors        - Error count (number)  
  latency_p50   - 50th percentile latency in ms
  latency_p95   - 95th percentile latency in ms
  latency_p99   - 99th percentile latency in ms
  bytes_in      - Total bytes received
  bytes_out     - Total bytes sent
```

#### Aggregated Daily Metrics
```redis
KEY: spinforge:metrics:daily:{spinletId}:{date}
TYPE: HASH
TTL: 30 days
DATE FORMAT: YYYYMMDD
FIELDS:
  requests      - Total requests
  errors        - Total errors
  uptime        - Seconds of uptime
  cold_starts   - Number of cold starts
  compute_ms    - Total compute milliseconds
  bytes_in      - Total bytes received
  bytes_out     - Total bytes sent
```

### 2. Resource Metrics

#### Resource Snapshots
```redis
KEY: spinforge:metrics:resources:{spinletId}:{timestamp}
TYPE: HASH
TTL: 7 days
INTERVAL: 5 minutes
FIELDS:
  cpu_percent       - CPU usage percentage (float)
  memory_bytes      - Memory usage in bytes
  memory_percent    - Memory usage percentage
  disk_read_bytes   - Disk read bytes since last snapshot
  disk_write_bytes  - Disk write bytes since last snapshot
  net_rx_bytes      - Network received bytes
  net_tx_bytes      - Network transmitted bytes
  open_connections  - Number of open connections
```

### 3. Usage Tracking

#### Monthly Usage Summary
```redis
KEY: spinforge:usage:{customerId}:{year}:{month}
TYPE: HASH
TTL: None (billing data)
FIELDS:
  compute_seconds   - Total compute time
  requests          - Total requests
  errors            - Total errors
  bandwidth_in      - Total bandwidth in (bytes)
  bandwidth_out     - Total bandwidth out (bytes)
  storage_bytes     - Average storage used
  unique_ips        - Unique visitor count (HLL)
  cold_starts       - Total cold starts
  peak_spinlets     - Max concurrent Spinlets
```

#### Real-time Counters
```redis
KEY: spinforge:counters:{customerId}:{date}:requests
TYPE: String (atomic counter)
TTL: 48 hours

KEY: spinforge:counters:{customerId}:{date}:errors  
TYPE: String (atomic counter)
TTL: 48 hours
```

### 4. Leaderboards & Analytics

#### Top Spinlets by Requests
```redis
KEY: spinforge:top:spinlets:requests:{date}
TYPE: ZSET
TTL: 7 days
SCORE: Request count
MEMBER: spinletId
```

#### Top Customers by Usage
```redis
KEY: spinforge:top:customers:compute:{month}
TYPE: ZSET
TTL: 90 days
SCORE: Compute seconds
MEMBER: customerId
```

### 5. Audit & Events

#### Audit Log Stream
```redis
KEY: spinforge:audit
TYPE: STREAM
TTL: None (permanent)
FIELDS:
  timestamp     - Unix timestamp
  event         - Event type (spinlet_start, spinlet_stop, etc)
  customerId    - Customer ID
  spinletId     - Spinlet ID (if applicable)
  userId        - User who triggered event
  ip            - Source IP address
  details       - JSON object with event-specific data
```

#### Event Types
- `spinlet_start` - Spinlet process started
- `spinlet_stop` - Spinlet process stopped
- `spinlet_crash` - Spinlet crashed
- `domain_add` - Domain added
- `domain_remove` - Domain removed
- `build_start` - Build initiated
- `build_complete` - Build finished
- `build_failed` - Build failed
- `customer_create` - New customer
- `customer_update` - Customer modified
- `limit_exceeded` - Resource limit hit

## Operations Guide

### Health Checks

```redis
# Check system health
PING

# Get active Spinlet count
ZCARD spinforge:active

# Get Spinlets idle for > 5 minutes
ZRANGEBYSCORE spinforge:active -inf {5_minutes_ago}

# Check memory usage
INFO memory
```

### Cleanup Operations

```redis
# Remove inactive Spinlets
ZREMRANGEBYSCORE spinforge:active -inf {cutoff_timestamp}

# Clean up old metrics (handled by TTL automatically)

# Manually expire a Spinlet
DEL spinforge:spinlets:{spinletId}
ZREM spinforge:active {spinletId}
```

### Monitoring Queries

```redis
# Get current request rate
GET spinforge:counters:global:{date}:requests

# Get top 10 Spinlets by requests today
ZREVRANGE spinforge:top:spinlets:requests:{date} 0 9 WITHSCORES

# Get customer's current usage
HGETALL spinforge:usage:{customerId}:{year}:{month}

# Stream recent audit events
XREAD COUNT 100 STREAMS spinforge:audit $
```

## Example Queries

### 1. Route a Request
```redis
# Get routing info for domain
GET spinforge:routes:example.com

# Check if Spinlet is active
ZSCORE spinforge:active spin-abc123

# Get Spinlet details
HGETALL spinforge:spinlets:spin-abc123

# Update last access time
ZADD spinforge:active {now} spin-abc123
```

### 2. Start a New Spinlet
```redis
# Allocate a port
LPOP spinforge:ports:pool
HSET spinforge:ports:allocated 3001 spin-abc123

# Register Spinlet
HSET spinforge:spinlets:spin-abc123 \
  pid 12345 \
  port 3001 \
  customerId cust-123 \
  startTime {now} \
  state running

# Add to active set
ZADD spinforge:active {now} spin-abc123

# Log audit event
XADD spinforge:audit * \
  timestamp {now} \
  event spinlet_start \
  spinletId spin-abc123 \
  customerId cust-123
```

### 3. Collect Metrics
```redis
# Record request metrics (every minute)
HINCRBY spinforge:metrics:requests:spin-abc123:{timestamp} count 1
HSET spinforge:metrics:requests:spin-abc123:{timestamp} latency_p50 23

# Update daily aggregates
HINCRBY spinforge:metrics:daily:spin-abc123:{date} requests 1

# Update customer usage
HINCRBY spinforge:usage:cust-123:{year}:{month} requests 1
```

### 4. Shutdown Idle Spinlet
```redis
# Update state
HSET spinforge:spinlets:spin-abc123 state stopping

# Return port to pool
RPUSH spinforge:ports:pool 3001
HDEL spinforge:ports:allocated 3001

# Remove from active set
ZREM spinforge:active spin-abc123

# Log event
XADD spinforge:audit * \
  timestamp {now} \
  event spinlet_stop \
  spinletId spin-abc123 \
  reason idle_timeout
```

## Best Practices

1. **Use transactions** for atomic operations:
   ```redis
   MULTI
   HSET spinforge:spinlets:xyz state stopped
   ZREM spinforge:active xyz
   EXEC
   ```

2. **Set appropriate TTLs** to prevent data growth

3. **Use pipelining** for bulk operations

4. **Monitor key patterns** with `SCAN` command

5. **Regular backups** using BGSAVE

6. **Use Redis Cluster** for high availability

---

Last Updated: January 17, 2025
Version: 1.0.0