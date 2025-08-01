-- SpinForge Dynamic Router
-- Reads host mappings from Redis/KeyDB

local redis = require "resty.redis"
local cjson = require "cjson"
local logger = require "logger"

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

-- Get site configuration by domain
local function get_site_config(domain)
    -- Check cache first
    local routes_cache = ngx.shared.routes_cache
    local cache_key = "site:" .. domain
    local cached_config = routes_cache:get(cache_key)
    
    if cached_config then
        ngx.log(ngx.DEBUG, "Cache hit for domain: ", domain)
        return cjson.decode(cached_config)
    end
    
    -- Get from Redis
    local red, err = get_redis_connection()
    if not red then
        return nil, err
    end
    
    -- Get site configuration directly by domain
    local site_key = "site:" .. domain
    local site_json, err = red:get(site_key)
    
    if err then
        return_redis_connection(red)
        return nil, err
    end
    
    -- If not found, check if it's an alias
    if site_json == ngx.null or not site_json then
        ngx.log(ngx.DEBUG, "Site not found, checking aliases for: ", domain)
        
        -- Check if this domain is an alias
        local alias_key = "alias:" .. domain
        local primary_domain, err = red:get(alias_key)
        
        if err then
            return_redis_connection(red)
            return nil, err
        end
        
        if primary_domain and primary_domain ~= ngx.null then
            ngx.log(ngx.INFO, "Found alias mapping: ", domain, " -> ", primary_domain)
            
            -- Get the site config for the primary domain
            site_key = "site:" .. primary_domain
            site_json, err = red:get(site_key)
            
            if err then
                return_redis_connection(red)
                return nil, err
            end
        end
    end
    
    if site_json == ngx.null or not site_json then
        return_redis_connection(red)
        return nil, "Site not found for domain: " .. domain
    end
    
    -- Cache for 60 seconds
    routes_cache:set(cache_key, site_json, 60)
    
    return_redis_connection(red)
    return cjson.decode(site_json)
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

-- Skip if we've already processed this request
if ngx.ctx.route_processed then
    return
end

-- Log the incoming request
ngx.log(ngx.DEBUG, "Router: Processing request for host: ", host)

-- Handle special cases
if host == "localhost" or host:match("^%d+%.%d+%.%d+%.%d+") then
    ngx.log(ngx.ERR, "Router: Direct access or IP access: ", host)
    ngx.var.route_type = ""
    return
end

ngx.log(ngx.DEBUG, "Router: Routing request for domain: ", host)

-- Look up site by the domain from Host header
local site, err = get_site_config(host)

if not site then
    ngx.log(ngx.ERR, "Router: Site not found for domain: ", host, " Error: ", err or "no error")
    ngx.var.route_type = ""
    update_metrics(host, 404)
    return
end

ngx.log(ngx.DEBUG, "Router: Found site config: ", cjson.encode(site))

-- Store the domain for logging
ngx.ctx.domain = host
ngx.ctx.route_processed = true
ngx.log(ngx.DEBUG, "Router: Set ngx.ctx.domain to: ", host)

-- Route based on type
if site.type == "static" then
    -- Use static_path from config if available, otherwise use filesystem-friendly domain
    if site.static_path and site.static_path ~= ngx.null then
        ngx.var.target_root = site.static_path
    else
        -- Use the primary domain for the folder name (from site config, not the host header)
        -- This ensures aliases work correctly
        local folder_name = site.domain:gsub("%.", "_")
        ngx.var.target_root = "/var/www/static/" .. folder_name
    end
    ngx.var.route_type = "static"
    ngx.log(ngx.DEBUG, "Router: Serving static site from: ", ngx.var.target_root)
elseif site.type == "proxy" then
    ngx.var.route_type = "proxy"
    ngx.var.proxy_target = site.target or site.upstream
    ngx.log(ngx.INFO, "Proxying to: ", ngx.var.proxy_target)
else
    ngx.log(ngx.WARN, "Unknown site type: ", site.type)
    ngx.var.route_type = ""
end

update_metrics(host, ngx.var.route_type == "" and 404 or 200)

-- Log the request asynchronously
local logger = require "logger"
local request_data = {
    domain = host,
    method = ngx.var.request_method,
    uri = ngx.var.uri,
    status = ngx.var.route_type == "" and 404 or 200,
    bytes = 0, -- Will be updated in log phase
    start_time = ngx.req.start_time(),
    remote_addr = ngx.var.remote_addr,
    user_agent = ngx.var.http_user_agent,
    referer = ngx.var.http_referer
}

-- Use a timer to log asynchronously
local ok, err = ngx.timer.at(0, function(premature)
    if not premature then
        logger.log_request_data(request_data)
    end
end)

if not ok then
    ngx.log(ngx.ERR, "Failed to create logging timer: ", err)
end