-- SpinForge Dynamic Router
-- Reads host mappings from Redis/KeyDB

local redis = require "resty.redis"
local cjson = require "cjson"

-- Helper function to get Redis connection
local function get_redis_connection()
    local red = redis:new()
    red:set_timeout(1000) -- 1 second timeout
    
    -- Use IP address for now, DNS resolution issue in container
    local ok, err = red:connect("172.18.0.2", redis_port)
    if not ok then
        ngx.log(ngx.ERR, "Failed to connect to Redis: ", err)
        return nil, err
    end
    
    -- Authenticate if password is set
    if redis_password and redis_password ~= "" then
        local ok, err = red:auth(redis_password)
        if not ok then
            ngx.log(ngx.ERR, "Failed to authenticate: ", err)
            return nil, err
        end
    end
    
    -- Select database
    if redis_db and redis_db ~= 0 then
        local ok, err = red:select(redis_db)
        if not ok then
            ngx.log(ngx.ERR, "Failed to select DB: ", err)
            return nil, err
        end
    end
    
    return red
end

-- Helper function to return Redis connection to pool
local function return_redis_connection(red)
    local ok, err = red:set_keepalive(10000, 100)
    if not ok then
        ngx.log(ngx.ERR, "Failed to set keepalive: ", err)
    end
end

-- Get vhost configuration from cache or Redis
local function get_vhost_config(subdomain)
    -- Check shared dict cache first
    local routes_cache = ngx.shared.routes_cache
    local cached_config = routes_cache:get(subdomain)
    
    if cached_config then
        ngx.log(ngx.DEBUG, "Cache hit for: ", subdomain)
        return cjson.decode(cached_config)
    end
    
    -- Get from Redis
    local red, err = get_redis_connection()
    if not red then
        return nil, err
    end
    
    -- Get vhost configuration
    local vhost_key = "vhost:" .. subdomain
    local vhost_json, err = red:get(vhost_key)
    
    if err then
        return_redis_connection(red)
        return nil, err
    end
    
    if vhost_json == ngx.null or not vhost_json then
        return_redis_connection(red)
        return nil, "Vhost not found"
    end
    
    -- Cache for 60 seconds
    routes_cache:set(subdomain, vhost_json, 60)
    
    return_redis_connection(red)
    return cjson.decode(vhost_json)
end

-- Update metrics
local function update_metrics(domain, status)
    local metrics = ngx.shared.metrics
    
    -- Increment request count
    metrics:incr("requests:total", 1, 0)
    metrics:incr("requests:domain:" .. domain, 1, 0)
    metrics:incr("requests:status:" .. status, 1, 0)
end

-- Main routing logic
local host = ngx.var.host:lower()
local subdomain = host:match("^([^.]+)")

-- Handle special cases
if not subdomain or host == "localhost" or host:match("^%d+%.%d+%.%d+%.%d+") then
    ngx.log(ngx.INFO, "Direct access or IP access: ", host)
    ngx.var.route_type = ""
    return
end

ngx.log(ngx.INFO, "Routing request for subdomain: ", subdomain)

-- Get vhost configuration
local vhost, err = get_vhost_config(subdomain)
if not vhost then
    ngx.log(ngx.WARN, "Vhost not found for subdomain: ", subdomain, " Error: ", err)
    ngx.var.route_type = ""
    update_metrics(host, 404)
    return
end

-- Route based on type
if vhost.type == "static" then
    ngx.var.target_root = "/var/www/static/" .. subdomain
    ngx.var.route_type = "static"
    ngx.log(ngx.INFO, "Serving static site from: ", ngx.var.target_root)
elseif vhost.type == "proxy" then
    -- For future implementation
    ngx.var.route_type = "proxy"
    ngx.var.proxy_target = vhost.upstream
else
    ngx.log(ngx.WARN, "Unknown vhost type: ", vhost.type)
    ngx.var.route_type = ""
end

update_metrics(host, ngx.var.route_type == "" and 404 or 200)