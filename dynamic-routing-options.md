# Dynamic Routing Options for 19k+ Sites

## Current Issue
- Caddy requires individual config files for each site
- Reloading Caddy with 19k sites would be slow and memory-intensive
- Need dynamic routing that reads from KeyDB without reloads

## Option 1: OpenResty (Nginx + Lua) ✅ RECOMMENDED
Already exists in the codebase at `_archive/lua/router.lua`

**Pros:**
- Reads routes directly from Redis/KeyDB
- No reloads needed - routes cached in shared memory
- Can handle millions of sites
- Battle-tested, used by Cloudflare, Kong, etc.

**Implementation:**
```nginx
location / {
    set $static_root '';
    set $spinlet_port '';
    set $framework '';
    
    access_by_lua_file /lua/router.lua;
    
    # Serve based on framework type
    if ($framework = "static") {
        rewrite ^ @serve_static last;
    }
    
    proxy_pass http://localhost:$spinlet_port;
}
```

## Option 2: Traefik with Redis Provider
**Pros:**
- Native Redis/KeyDB support for dynamic configuration
- Auto-discovery of services
- Built-in load balancing and health checks

**Cons:**
- More complex setup
- Different configuration format needed

**Example:**
```yaml
providers:
  redis:
    endpoints:
      - "keydb:16378"
    rootKey: "traefik"
```

## Option 3: HAProxy with Lua + Redis
**Pros:**
- High performance
- Lua scripting for Redis lookups
- Good for high-traffic sites

**Cons:**
- More complex Lua integration
- Less documentation

**Example:**
```lua
core.register_fetches("redis_lookup", function(txn)
    local host = txn.sf:req_fhdr("host")
    -- Redis lookup logic here
end)
```

## Option 4: Envoy Proxy with External Data Source
**Pros:**
- Modern, cloud-native
- Dynamic configuration via xDS APIs
- Used by service meshes

**Cons:**
- Steeper learning curve
- Requires control plane

## Option 5: Custom Caddy Plugin
**Pros:**
- Keep using Caddy
- Write Go plugin for Redis lookups

**Cons:**
- Requires Go development
- Need to maintain custom build

**Example plugin structure:**
```go
type RedisMiddleware struct {
    client *redis.Client
}

func (m *RedisMiddleware) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
    // Lookup host in Redis
    // Route accordingly
}
```

## Recommendation: Use OpenResty

The codebase already has OpenResty routing logic in `_archive/lua/router.lua` that:
1. Reads routes from KeyDB
2. Caches in shared memory for performance
3. Handles static sites and dynamic apps
4. Updates metrics
5. No reloads needed - just update KeyDB

To implement:
1. Replace Caddy with OpenResty in docker-compose.yml
2. Use the existing Lua routing logic
3. Update API to write routes to KeyDB instead of Caddy files