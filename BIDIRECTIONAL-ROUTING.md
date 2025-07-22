# Bidirectional Domain and Service Path Mapping

SpinForge now supports bidirectional mapping between public domains and local service paths, making it easy to access and manage applications using either identifier.

## Key Concepts

### Service Path

The local URL where a spinlet is accessible within the system.

- Format: `localhost:port` (e.g., `localhost:40000`)
- Automatically assigned when a spinlet starts
- Remains constant for the spinlet's lifetime

### Domains

The public URLs that route to the spinlet.

- Format: Standard domain names (e.g., `mynext.com`, `app.example.com`)
- Multiple domains can point to one spinlet
- Dynamically managed through the route system

## Data Structure

The enhanced `SpinletState` now includes:

```typescript
interface SpinletState {
  spinletId: string;
  customerId: string;
  port: number;
  servicePath: string; // e.g., "localhost:40000"
  domains: string[]; // e.g., ["mynext.com", "www.mynext.com"]
  // ... other fields
}
```

## API Endpoints

### Find Spinlet by Service Path or Domain

```bash
GET /_admin/spinlets/find/:pathOrDomain
```

Examples:

```bash
# Find by service path
curl http://localhost:9004/_admin/spinlets/find/localhost:40000

# Find by domain
curl http://localhost:9004/_admin/spinlets/find/mynext.com
```

### Add Route (Automatically Updates Domains)

When you add a route, the domain is automatically added to the spinlet's domain list:

```bash
POST /_admin/routes
{
  "domain": "mynext.com",
  "spinletId": "spin-123",
  "customerId": "cust-456",
  "buildPath": "/app",
  "framework": "nextjs"
}
```

### Remove Route (Automatically Updates Domains)

When you remove a route, the domain is automatically removed from the spinlet's domain list:

```bash
DELETE /_admin/routes/mynext.com
```

## Redis Storage Structure

The system maintains several Redis keys for efficient lookups:

### Primary Storage

- `spinforge:spinlets:{spinletId}` - Complete spinlet state
- `routes:{domain}` - Route configuration

### Reverse Mappings

- `spinforge:servicepath:{servicePath}` → `spinletId`
- `spinforge:domain:{domain}` → `spinletId`

## Usage Examples

### 1. Deploy an App and Access It

```bash
# Deploy app
curl -X POST http://localhost:9004/_admin/routes \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "myapp.localhost",
    "spinletId": "spin-myapp",
    "customerId": "customer-123",
    "buildPath": "/path/to/myapp",
    "framework": "express"
  }'

# Get spinlet info by domain
curl http://localhost:9004/_admin/spinlets/find/myapp.local

# Response includes servicePath
{
  "spinletId": "spin-myapp",
  "servicePath": "localhost:30001",
  "domains": ["myapp.localhost"],
  ...
}

# Now you can access the app directly via servicePath
curl http://localhost:30001
```

### 2. Add Multiple Domains to One App

```bash
# Add www subdomain
curl -X POST http://localhost:9004/_admin/routes \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "www.myapp.localhost",
    "spinletId": "spin-myapp",
    ...
  }'

# Check spinlet state
curl http://localhost:9004/_admin/spinlets/find/localhost:30001

# Response shows both domains
{
  "spinletId": "spin-myapp",
  "servicePath": "localhost:30001",
  "domains": ["myapp.localhost", "www.myapp.localhost"],
  ...
}
```

### 3. Find App by Any Identifier

```bash
# All of these return the same spinlet:
curl http://localhost:9004/_admin/spinlets/find/localhost:30001
curl http://localhost:9004/_admin/spinlets/find/myapp.local
curl http://localhost:9004/_admin/spinlets/find/www.myapp.local
```

## Benefits

1. **Development Access**: Access apps directly via `localhost:port` without domain configuration
2. **Debugging**: Easily find which port an app is running on
3. **Flexibility**: Query spinlets by any identifier
4. **Multi-Domain Support**: Track all domains pointing to a spinlet
5. **Reverse Proxy Bypass**: Direct access for testing and debugging

## Implementation Details

### SpinletManager Methods

```typescript
// Update domains for a spinlet
await spinletManager.updateDomains(spinletId, ["domain1.com", "domain2.com"]);

// Find spinlet by service path
const spinletId = await spinletManager.findByServicePath("localhost:40000");

// Find spinlet by domain
const spinletId = await spinletManager.findByDomain("mynext.com");

// Get state by either identifier
const state = await spinletManager.getStateByServicePathOrDomain(
  "localhost:40000"
);
const state = await spinletManager.getStateByServicePathOrDomain("mynext.com");
```

### Automatic Cleanup

When a spinlet is stopped, all reverse mappings are automatically cleaned up:

- Service path mapping is removed
- All domain mappings are removed
- Redis keys are deleted

## Best Practices

1. **Use Service Path for Internal Access**: When debugging or testing, use the service path for direct access
2. **Use Domains for Public Access**: Route public traffic through domains via Nginx
3. **Monitor Domain Changes**: The audit log tracks all domain additions and removals
4. **Check Before Adding**: Validate domains aren't already in use before adding routes

## Troubleshooting

### Domain Not Found

```bash
# Check if domain is registered
curl http://localhost:9004/_admin/routes

# Check spinlet state
curl http://localhost:9004/_admin/spinlets/find/yourdomain.com
```

### Service Path Not Accessible

```bash
# Verify spinlet is running
curl http://localhost:9004/_admin/spinlets/{spinletId}

# Check if port is open
nc -zv localhost {port}
```

### Multiple Domains Issue

```bash
# List all domains for a spinlet
curl http://localhost:9004/_admin/spinlets/{spinletId} | jq '.domains'

# Remove unwanted domain
curl -X DELETE http://localhost:9004/_admin/routes/{unwanted-domain}
```
