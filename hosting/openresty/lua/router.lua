--[[
  SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
  Copyright (c) 2025 Jacob Ajiboye
  
  This software is licensed under the MIT License.
  See the LICENSE file in the root directory for details.
--]]
-- SpinForge Dynamic Router
-- Reads host mappings from Redis/KeyDB
-- Version: 2.1.0 - 2025-08-05 - Added domain name normalization

local redis = require "resty.redis"
local cjson = require "cjson"
local logger = require "logger"
local utils = require "utils"
local container_discovery = require "container_discovery"

-- Try to load auth gateway module
local auth_gateway = nil
local ok, auth_module = pcall(require, "auth_gateway")
if ok then
    auth_gateway = auth_module
end

-- Helper function to get Redis connection
local function get_redis_connection()
    local red = redis:new()
    red:set_timeout(1000) -- 1 second timeout
    
    -- Use the actual container name for Redis connection
    local redis_host = _G.redis_host or os.getenv("REDIS_HOST") or "spinforge-keydb"
    local ok, err = red:connect(redis_host, redis_port)
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

-- Run authentication check ONLY if auth module is available AND domain might have auth
-- We do a quick cache check first to avoid the overhead for most domains
if auth_gateway and auth_gateway.authenticate then
    -- Check if this domain potentially has auth (quick cache check)
    local auth_cache = ngx.shared.auth_cache
    local quick_check_key = "quick:" .. host
    local has_auth = auth_cache:get(quick_check_key)
    
    -- Only run auth if:
    -- 1. We haven't checked this domain before (has_auth is nil), OR
    -- 2. We know this domain has auth enabled (has_auth == "1")
    if has_auth == nil or has_auth == "1" then
        auth_gateway.authenticate()
    end
    -- If has_auth == "0", we skip auth entirely (cached negative result)
end

-- Special diagnostic endpoint for load balancers
if ngx.var.uri == "/_spinforge/diagnostic" then
    ngx.header["Content-Type"] = "application/json"
    
    local site, err = get_site_config(host)
    if not site then
        ngx.status = 404
        ngx.say(cjson.encode({error = "Site not found", host = host}))
        return ngx.exit(404)
    end
    
    if site.type ~= "loadbalancer" then
        ngx.status = 400
        ngx.say(cjson.encode({error = "Not a load balancer", type = site.type}))
        return ngx.exit(400)
    end
    
    local backends = site.backendConfigs or site.backends or site.upstreams or {}
    local diagnostic = {
        host = host,
        type = site.type,
        backend_count = #backends,
        backends = {},
        routing_rules = site.routingRules or {},
        sticky_cookie_name = "spinforge_backend_" .. host:gsub("%.", "_")
    }
    
    for i, backend in ipairs(backends) do
        if type(backend) == "table" then
            table.insert(diagnostic.backends, {
                index = i,
                url = backend.url,
                label = backend.label,
                isLocal = backend.isLocal,
                healthCheck = backend.healthCheck
            })
        else
            table.insert(diagnostic.backends, {
                index = i,
                url = backend
            })
        end
    end
    
    ngx.status = 200
    ngx.say(cjson.encode(diagnostic))
    return ngx.exit(200)
end

-- Test routing endpoint
if ngx.var.uri == "/_spinforge/test-routing" then
    ngx.header["Content-Type"] = "application/json"
    
    local site, err = get_site_config(host)
    if not site or site.type ~= "loadbalancer" then
        ngx.status = 400
        ngx.say(cjson.encode({error = "Not a load balancer"}))
        return ngx.exit(400)
    end
    
    -- Test with current request parameters
    local test_result = {
        host = host,
        cookies = {},
        query_params = {},
        headers = {},
        matched_rule = nil,
        routing_decision = nil
    }
    
    -- Collect request info
    local headers = ngx.req.get_headers()
    for k, v in pairs(headers) do
        if k:lower():match("^x%-") or k:lower() == "cookie" then
            test_result.headers[k] = v
        end
    end
    
    local args = ngx.req.get_uri_args()
    for k, v in pairs(args) do
        test_result.query_params[k] = v
    end
    
    -- Parse cookies
    local cookie_header = ngx.var.http_cookie
    if cookie_header then
        for cookie in cookie_header:gmatch("([^;]+)") do
            local name, value = cookie:match("^%s*([^=]+)=(.+)%s*$")
            if name then
                test_result.cookies[name] = value
            end
        end
    end
    
    ngx.status = 200
    ngx.say(cjson.encode(test_result))
    return ngx.exit(200)
end

-- Log the incoming request
ngx.log(ngx.DEBUG, "Router: Processing request for host: ", host)

-- No special handling needed - just look up the domain

ngx.log(ngx.DEBUG, "Router: Routing request for domain: ", host)

-- Look up site by the domain from Host header
local site, err = get_site_config(host)

if not site then
    -- Check if it's a Redis connection error
    if err and (err:find("connection refused") or err:find("timeout")) then
        ngx.status = 503
        ngx.header["Content-Type"] = "text/html"
        ngx.say([[
<!DOCTYPE html>
<html>
<head>
    <title>Service Temporarily Unavailable</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #e74c3c; }
        .error-details { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px auto; max-width: 600px; }
    </style>
</head>
<body>
    <h1>Service Temporarily Unavailable</h1>
    <div class="error-details">
        <p>We're experiencing technical difficulties. Please try again in a moment.</p>
        <p><small>If this problem persists, please contact support.</small></p>
    </div>
</body>
</html>
        ]])
        return ngx.exit(503)
    end
    
    -- No site configured - serve default landing page
    ngx.log(ngx.INFO, "Router: No site configured for domain: ", host, ", serving default page")
    ngx.var.route_type = "static"
    ngx.var.target_root = os.getenv("STATIC_ROOT") or "/data/static"
    update_metrics(host, 404)
    return
end

ngx.log(ngx.DEBUG, "Router: Found site config: ", cjson.encode(site))

-- Store the domain for logging (in both ctx and var for persistence across internal redirects)
ngx.ctx.domain = host
ngx.var.request_domain = host
ngx.ctx.route_processed = true
ngx.log(ngx.DEBUG, "Router: Set ngx.ctx.domain to: ", host)

-- Check for SSL redirect (only on HTTP, not HTTPS)
if ngx.var.scheme == "http" and site.config and site.config.sslRedirect then
    ngx.log(ngx.INFO, "SSL redirect enabled for domain: ", host)
    -- Don't redirect Let's Encrypt challenges
    if not ngx.var.uri:match("^/%.well%-known/acme%-challenge/") then
        local redirect_url = "https://" .. host .. ngx.var.request_uri
        ngx.redirect(redirect_url, 301)
        return ngx.exit(301)
    end
end

-- Route based on type
if site.type == "static" then
    -- Use static_path from config if available, otherwise use filesystem-friendly domain
    if site.static_path and site.static_path ~= ngx.null then
        ngx.var.target_root = site.static_path
    else
        -- Use the primary domain for the folder name (from site config, not the host header)
        -- This ensures aliases work correctly
        local folder_name = utils.domain_to_folder(site.domain)
        ngx.var.target_root = (os.getenv("STATIC_ROOT") or "/data/static") .. "/" .. folder_name
    end
    ngx.var.route_type = "static"
    ngx.log(ngx.INFO, "Router: Serving static site from: ", ngx.var.target_root, " for domain: ", host)
elseif site.type == "proxy" then
    -- Check if transparent proxy is enabled
    if site.transparent_proxy then
        ngx.var.route_type = "transparent_proxy"
    else
        ngx.var.route_type = "proxy"
    end
    
    local target = site.target or site.upstream
    
    -- Check if target uses container name or IP
    -- If it's an IP, verify it's reachable, otherwise trigger discovery
    if target and target:match("172%.%d+%.%d+%.%d+") then
        -- It's an IP address, let's verify it's still valid
        -- We'll let the proxy handler deal with connection failures
        -- and trigger discovery if needed
        ngx.ctx.may_need_discovery = true
        ngx.ctx.original_domain = host
    end
    
    ngx.var.proxy_target = target
    -- Pass preserve_host setting to nginx
    if site.preserve_host then
        ngx.var.preserve_host = "1"
    end
    ngx.log(ngx.INFO, "Proxying to: ", ngx.var.proxy_target, " preserve_host: ", site.preserve_host or false, " transparent: ", site.transparent_proxy or false)
elseif site.type == "container" then
    -- Container sites work like proxy sites
    ngx.var.route_type = "proxy"
    -- Resolve DNS for container
    if site.target then
        local resolved_target = dns_resolver.resolve_target(site.target)
        ngx.var.proxy_target = resolved_target
    else
        ngx.var.proxy_target = site.target
    end
    ngx.log(ngx.INFO, "Proxying to container: ", ngx.var.proxy_target)
elseif site.type == "loadbalancer" then
    ngx.var.route_type = "proxy"  -- Use proxy type for handling
    
    -- Get backend URLs from various possible fields
    local all_backends = site.backendConfigs or site.backends or site.upstreams
    
    if not all_backends or #all_backends == 0 then
        ngx.log(ngx.ERR, "No backends configured for load balancer")
        ngx.var.route_type = ""
        return
    end
    
    -- Filter out disabled backends
    local backends = {}
    for i, backend in ipairs(all_backends) do
        local is_enabled = true
        if type(backend) == "table" and backend.enabled == false then
            is_enabled = false
        end
        
        if is_enabled then
            table.insert(backends, backend)
        else
            ngx.log(ngx.INFO, "Backend #", i, " is disabled, skipping")
        end
    end
    
    if #backends == 0 then
        ngx.log(ngx.ERR, "All backends are disabled for load balancer")
        ngx.var.route_type = ""
        return
    end
    
    local selected_backend
    local backend_index
    local backend_config
    
    -- Define sticky cookie name once for the entire request
    local sticky_cookie_name = "spinforge_backend_" .. utils.domain_to_folder(host)
    
    -- First, check for explicit label parameter (for testing/debugging)
    local label_param = ngx.var.arg_label
    if label_param then
        -- Try to route to backend with matching label
        for idx, backend in ipairs(backends) do
            if type(backend) == "table" and backend.label == label_param then
                backend_index = idx
                ngx.log(ngx.INFO, "ROUTING DECISION: Direct label routing to '", label_param, "' -> Backend #", idx)
                ngx.header["X-SpinForge-Route-Method"] = "label-parameter"
                ngx.header["X-SpinForge-Route-Backend"] = label_param
                ngx.header["X-SpinForge-Route-Backend-Index"] = tostring(idx)
            end
        end
        
        if not backend_index then
            ngx.log(ngx.WARN, "ROUTING WARNING: Label parameter '", label_param, "' not found")
            -- Continue with normal routing
        end
    end
    
    -- Next, check routing rules for A/B testing (if no label parameter matched)
    if site.routingRules and #site.routingRules > 0 then
        -- Sort rules by priority (higher priority first)
        local sorted_rules = {}
        for _, rule in ipairs(site.routingRules) do
            table.insert(sorted_rules, rule)
        end
        table.sort(sorted_rules, function(a, b)
            return (a.priority or 0) > (b.priority or 0)
        end)
        
        -- Evaluate each rule
        for _, rule in ipairs(sorted_rules) do
            local value_to_check
            
            -- Get the value based on rule type
            if rule.type == "cookie" then
                value_to_check = ngx.var["cookie_" .. rule.name]
            elseif rule.type == "query" then
                value_to_check = ngx.var["arg_" .. rule.name]
            elseif rule.type == "header" then
                value_to_check = ngx.var["http_" .. rule.name:gsub("-", "_"):lower()]
            end
            
            if value_to_check then
                local matches = false
                
                -- Check if value matches based on match type
                if rule.matchType == "exact" then
                    matches = (value_to_check == rule.value)
                elseif rule.matchType == "prefix" then
                    matches = value_to_check:sub(1, #rule.value) == rule.value
                elseif rule.matchType == "regex" then
                    matches = ngx.re.match(value_to_check, rule.value, "jo") ~= nil
                end
                
                if matches then
                    -- Find backend with matching label
                    for idx, backend in ipairs(backends) do
                        if type(backend) == "table" and backend.label == rule.targetLabel then
                            backend_index = idx
                            ngx.log(ngx.INFO, "ROUTING DECISION: Rule matched! ", 
                                    "Type=", rule.type, 
                                    " Name=", rule.name, 
                                    " Value=", value_to_check,
                                    " Pattern=", rule.value,
                                    " MatchType=", rule.matchType,
                                    " -> Backend #", idx, " (", rule.targetLabel, ")")
                            
                            -- Set a header to track which rule matched (useful for debugging)
                            ngx.header["X-SpinForge-Route-Rule"] = rule.type .. ":" .. rule.name
                            ngx.header["X-SpinForge-Route-Backend"] = rule.targetLabel
                            break
                        end
                    end
                    
                    if backend_index then
                        break -- Stop evaluating rules once we have a match
                    else
                        ngx.log(ngx.WARN, "ROUTING WARNING: Rule matched but no backend with label '", 
                                rule.targetLabel, "' found")
                    end
                end
            end
        end
    end
    
    -- If no routing rule or label parameter matched, check for sticky session cookie
    if not backend_index and not label_param then
        local cookie_value = ngx.var["cookie_" .. sticky_cookie_name]
        
        if cookie_value and tonumber(cookie_value) then
            -- Use sticky session if cookie exists and is valid
            local sticky_index = tonumber(cookie_value)
            if sticky_index >= 1 and sticky_index <= #backends then
                backend_index = sticky_index
                ngx.log(ngx.INFO, "ROUTING DECISION: Using sticky session backend #", backend_index)
                ngx.header["X-SpinForge-Route-Method"] = "sticky-session"
                ngx.header["X-SpinForge-Route-Backend-Index"] = tostring(backend_index)
            else
                -- Invalid cookie value, fall back to round-robin
                cookie_value = nil
                ngx.log(ngx.WARN, "ROUTING WARNING: Invalid sticky session cookie value: ", cookie_value)
            end
        end
    end
    
    if not backend_index then
        -- No routing rule or sticky session, use round-robin
        local lb_counter = ngx.shared.routes_cache
        local counter_key = "lb:" .. host
        local current = lb_counter:incr(counter_key, 1, 0)
        backend_index = (current % #backends) + 1
        
        ngx.log(ngx.INFO, "ROUTING DECISION: Using round-robin, selected backend #", backend_index)
        ngx.header["X-SpinForge-Route-Method"] = "round-robin"
        ngx.header["X-SpinForge-Route-Backend-Index"] = tostring(backend_index)
        
        -- Set sticky session cookie (default 1 hour, configurable)
        local sticky_duration = site.stickySessionDuration or 3600
        if sticky_duration > 0 then
            ngx.header["Set-Cookie"] = sticky_cookie_name .. "=" .. backend_index .. 
                "; Path=/; Max-Age=" .. sticky_duration .. "; HttpOnly; SameSite=Lax"
        end
    end
    
    -- Handle both simple array and backendConfigs format
    local backend_config
    if type(backends[backend_index]) == "string" then
        selected_backend = backends[backend_index]
        backend_config = { url = selected_backend, isLocal = false }
    elseif type(backends[backend_index]) == "table" and backends[backend_index].url then
        backend_config = backends[backend_index]
        selected_backend = backend_config.url
    else
        ngx.log(ngx.ERR, "Invalid backend configuration at index ", backend_index)
        ngx.var.route_type = ""
        return
    end
    
    -- Handle local backends differently
    if backend_config.isLocal then
        ngx.log(ngx.INFO, "Load balancing to LOCAL backend #", backend_index, ": ", selected_backend)
        
        -- For local backends, we need to internally redirect to that domain
        -- Set the Host header to the local domain
        ngx.req.set_header("Host", selected_backend)
        
        -- Clear the proxy_target and route_type to trigger a new lookup
        ngx.var.route_type = ""
        ngx.ctx.route_processed = false
        
        -- Re-run the router for the new host
        host = selected_backend
        site, err = get_site_config(host)
        
        if not site then
            ngx.log(ngx.ERR, "Local backend not found: ", host)
            ngx.status = 502
            ngx.say("Local backend not available")
            return ngx.exit(502)
        end
        
        -- Process the local site normally
        if site.type == "static" then
            if site.static_path and site.static_path ~= ngx.null then
                ngx.var.target_root = site.static_path
            else
                local folder_name = site.domain:gsub("%.", "_")
                ngx.var.target_root = (os.getenv("STATIC_ROOT") or "/data/static") .. "/" .. folder_name
            end
            ngx.var.route_type = "static"
        elseif site.type == "proxy" then
            ngx.var.route_type = "proxy"
            ngx.var.proxy_target = site.target or site.upstream
        else
            ngx.log(ngx.ERR, "Local backend has unsupported type: ", site.type)
            ngx.status = 502
            ngx.say("Local backend configuration error")
            return ngx.exit(502)
        end
        
        ngx.log(ngx.INFO, "Routed to local backend: ", host, " type: ", site.type)
    else
        -- External backend - use normal proxy
        ngx.var.proxy_target = selected_backend
        ngx.log(ngx.INFO, "Load balancing to EXTERNAL backend #", backend_index, ": ", selected_backend)
    end
else
    ngx.log(ngx.WARN, "Unknown site type: ", site.type)
    ngx.var.route_type = ""
end

update_metrics(host, ngx.var.route_type == "" and 404 or 200)