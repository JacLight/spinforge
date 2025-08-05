--[[
  SpinForge - Open Source Hosting Platform
  Copyright (c) 2025 Jacob Ajiboye
  
  This software is licensed under the MIT License.
  See the LICENSE file in the root directory for details.
--]]
-- SpinForge Flexible Router
-- Supports domain mapping, host header override, and wildcard routing

local redis = require "resty.redis"
local cjson = require "cjson"
local app_detector = require "app_detector"

-- Configuration
local ENABLE_HOST_HEADER_OVERRIDE = true
local ENABLE_WILDCARD_ROUTING = true
local DEFAULT_DOMAIN_SUFFIX = ".localhost"

-- Helper: Get Redis connection
local function get_redis_connection()
    local red = redis:new()
    red:set_timeout(1000)
    
    local ok, err = red:connect("keydb", 16378)
    if not ok then
        ngx.log(ngx.ERR, "Failed to connect to Redis: ", err)
        return nil, err
    end
    
    return red
end

-- Helper: Return Redis connection to pool
local function return_redis_connection(red)
    local ok, err = red:set_keepalive(10000, 100)
    if not ok then
        ngx.log(ngx.ERR, "Failed to set keepalive: ", err)
    end
end

-- Extract routing key from request
local function get_routing_key()
    local domain = ngx.var.host:gsub(":.*", "") -- Remove port
    
    -- Check for Host header override (useful for testing/development)
    if ENABLE_HOST_HEADER_OVERRIDE then
        local host_override = ngx.req.get_headers()["X-Host-Override"]
        if host_override then
            ngx.log(ngx.INFO, "Using host header override: ", host_override)
            return host_override
        end
    end
    
    return domain
end

-- Get route with multiple lookup strategies
local function get_route_multi_strategy(routing_key)
    local routes_cache = ngx.shared.routes_cache
    
    -- Strategy 1: Direct domain lookup
    local cache_key = "route:" .. routing_key
    local cached_route = routes_cache:get(cache_key)
    if cached_route then
        return cjson.decode(cached_route), "cache"
    end
    
    local red, err = get_redis_connection()
    if not red then
        return nil, err
    end
    
    -- Try direct domain lookup
    local route_key = "spinforge:routes:" .. routing_key
    local route_json, err = red:get(route_key)
    
    if route_json and route_json ~= ngx.null then
        routes_cache:set(cache_key, route_json, 60)
        return_redis_connection(red)
        return cjson.decode(route_json), "direct"
    end
    
    -- Strategy 2: Wildcard subdomain matching (*.example.com)
    if ENABLE_WILDCARD_ROUTING then
        local subdomain, base_domain = routing_key:match("^([^.]+)%.(.+)$")
        if subdomain and base_domain then
            -- Check for wildcard route
            local wildcard_key = "spinforge:routes:*." .. base_domain
            route_json, err = red:get(wildcard_key)
            
            if route_json and route_json ~= ngx.null then
                local route = cjson.decode(route_json)
                -- Add subdomain info to route
                route.matchedSubdomain = subdomain
                route.wildcardMatch = true
                routes_cache:set(cache_key, cjson.encode(route), 60)
                return_redis_connection(red)
                return route, "wildcard"
            end
        end
    end
    
    -- Strategy 3: Check aliases
    local alias_key = "spinforge:aliases:" .. routing_key
    local primary_domain, err = red:get(alias_key)
    
    if primary_domain and primary_domain ~= ngx.null then
        -- Recursive lookup with primary domain
        return_redis_connection(red)
        return get_route_multi_strategy(primary_domain)
    end
    
    -- Strategy 4: App name routing (e.g., myapp -> myapp.localhost)
    local app_name = routing_key:match("^([^.]+)$")
    if app_name and not routing_key:find("%.") then
        local auto_domain = app_name .. DEFAULT_DOMAIN_SUFFIX
        return_redis_connection(red)
        return get_route_multi_strategy(auto_domain)
    end
    
    return_redis_connection(red)
    return nil, "not found"
end

-- Get all domains and aliases for a spinlet
local function get_all_domains_for_spinlet(spinlet_id)
    local red, err = get_redis_connection()
    if not red then
        return {}
    end
    
    -- Get primary domains
    local domains_key = "spinforge:spinlets:" .. spinlet_id .. ":domains"
    local domains, err = red:smembers(domains_key)
    
    if err or not domains then
        domains = {}
    end
    
    -- Get aliases
    local aliases_key = "spinforge:spinlets:" .. spinlet_id .. ":aliases"
    local aliases, err = red:smembers(aliases_key)
    
    if not err and aliases then
        for _, alias in ipairs(aliases) do
            table.insert(domains, alias)
        end
    end
    
    return_redis_connection(red)
    return domains
end

-- Enhanced serving configuration
local function get_serving_config(route)
    local config_cache = ngx.shared.spinlets_cache
    local cache_key = "config:" .. route.spinletId
    local cached_config = config_cache:get(cache_key)
    
    if cached_config then
        local config = cjson.decode(cached_config)
        -- Add runtime routing info
        config.wildcardMatch = route.wildcardMatch
        config.matchedSubdomain = route.matchedSubdomain
        return config
    end
    
    local config = app_detector.get_serving_config(route)
    
    -- Add custom headers for wildcard matches
    if route.wildcardMatch then
        config.customHeaders = {
            ["X-Matched-Subdomain"] = route.matchedSubdomain,
            ["X-Wildcard-Match"] = "true"
        }
    end
    
    config_cache:set(cache_key, cjson.encode(config), 300)
    return config
end

-- Serve static with subdomain awareness
local function serve_static_file(config, uri)
    local file_path = config.static_root .. uri
    
    -- For wildcard matches, check subdomain-specific paths first
    if config.matchedSubdomain then
        local subdomain_path = config.static_root .. "/" .. config.matchedSubdomain .. uri
        local f = io.open(subdomain_path, "r")
        if f then
            file_path = subdomain_path
            f:close()
        end
    end
    
    -- Security check
    if string.find(uri, "%.%.") then
        ngx.exit(403)
        return
    end
    
    local f = io.open(file_path, "r")
    if not f then
        -- Try fallback
        if config.fallback and uri ~= config.fallback then
            file_path = config.static_root .. config.fallback
            f = io.open(file_path, "r")
        end
        
        if not f then
            ngx.exit(404)
            return
        end
    end
    
    local content = f:read("*all")
    f:close()
    
    -- Set mime type
    local ext = uri:match("%.([^.]+)$")
    if ext and config.mime_types["." .. ext] then
        ngx.header["Content-Type"] = config.mime_types["." .. ext]
    end
    
    -- Add custom headers if configured
    if config.customHeaders then
        for k, v in pairs(config.customHeaders) do
            ngx.header[k] = v
        end
    end
    
    ngx.say(content)
end

-- Update metrics with routing strategy info
local function update_metrics_with_strategy(domain, spinlet_id, strategy, status)
    local metrics = ngx.shared.metrics
    
    metrics:incr("requests:total", 1, 0)
    metrics:incr("requests:domain:" .. domain, 1, 0)
    metrics:incr("requests:spinlet:" .. spinlet_id, 1, 0)
    metrics:incr("requests:strategy:" .. strategy, 1, 0)
    metrics:incr("requests:status:" .. status, 1, 0)
    
    ngx.timer.at(0, function()
        local red = get_redis_connection()
        if red then
            red:hincrby("spinforge:metrics:routing_strategies", strategy, 1)
            red:hset("spinforge:spinlets:" .. spinlet_id .. ":state", "lastAccess", ngx.time())
            return_redis_connection(red)
        end
    end)
end

-- Main routing logic
local routing_key = get_routing_key()
local uri = ngx.var.uri

ngx.log(ngx.INFO, "Routing request - Key: ", routing_key, " URI: ", uri)

-- Get route with flexible strategies
local route, strategy = get_route_multi_strategy(routing_key)
if not route then
    ngx.status = 404
    ngx.header["Content-Type"] = "text/html"
    ngx.say([[
        <!DOCTYPE html>
        <html>
        <head><title>404 - Application Not Found</title></head>
        <body style="font-family: Arial, sans-serif; padding: 50px;">
            <h1>Application Not Found</h1>
            <p>No application is deployed at <strong>]] .. routing_key .. [[</strong></p>
            
            <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 5px;">
                <h3>Routing Information:</h3>
                <ul style="text-align: left;">
                    <li>Requested Host: ]] .. ngx.var.host .. [[</li>
                    <li>Routing Key: ]] .. routing_key .. [[</li>
                    <li>Request URI: ]] .. uri .. [[</li>
                    ]] .. (ENABLE_HOST_HEADER_OVERRIDE and [[
                    <li>Host Override: ]] .. (ngx.req.get_headers()["X-Host-Override"] or "none") .. [[</li>
                    ]] or "") .. [[
                </ul>
                
                <p style="margin-top: 20px; color: #666;">
                    <strong>Tip:</strong> You can override the host using the X-Host-Override header for testing.
                </p>
            </div>
        </body>
        </html>
    ]])
    ngx.exit(404)
    return
end

ngx.log(ngx.INFO, "Route found via strategy: ", strategy, " for spinlet: ", route.spinletId)

-- Get serving configuration
local config = get_serving_config(route)

-- Get all associated domains for display
route.allDomains = get_all_domains_for_spinlet(route.spinletId)

-- Handle based on app type
if config.type == "hosted" then
    serve_static_file(config, uri)
    update_metrics_with_strategy(routing_key, route.spinletId, strategy, ngx.status)
    
elseif config.type == "proxy" then
    -- Get spinlet state
    local spinlets_cache = ngx.shared.spinlets_cache
    local state_key = "state:" .. route.spinletId
    local cached_state = spinlets_cache:get(state_key)
    local spinlet_state = cached_state and cjson.decode(cached_state) or nil
    
    if not spinlet_state then
        local red = get_redis_connection()
        if red then
            local state_json = red:get("spinforge:spinlets:" .. route.spinletId .. ":state")
            if state_json and state_json ~= ngx.null then
                spinlet_state = cjson.decode(state_json)
                spinlets_cache:set(state_key, state_json, 5)
            end
            return_redis_connection(red)
        end
    end
    
    if not spinlet_state or spinlet_state.state ~= "running" then
        -- Handle idle/stopped spinlets
        ngx.status = 503
        ngx.header["Content-Type"] = "text/html"
        ngx.say([[
            <!DOCTYPE html>
            <html>
            <head><title>Application Offline</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>Application Temporarily Offline</h1>
                <p>The application is currently ]] .. (spinlet_state and spinlet_state.state or "unavailable") .. [[</p>
                
                ]] .. (route.allDomains and #route.allDomains > 0 and [[
                <div style="margin-top: 30px;">
                    <p>This application is accessible via:</p>
                    <ul style="list-style: none; padding: 0;">
                    ]] .. table.concat(
                        (function()
                            local links = {}
                            for _, d in ipairs(route.allDomains) do
                                table.insert(links, '<li>' .. d .. '</li>')
                            end
                            return links
                        end)(),
                        "\n"
                    ) .. [[
                    </ul>
                </div>
                ]] or "") .. [[
                
                <p style="margin-top: 30px; color: #666;">
                    Routing Strategy: <strong>]] .. strategy .. [[</strong>
                </p>
            </body>
            </html>
        ]])
        ngx.exit(503)
        return
    end
    
    -- Proxy to spinlet with custom headers
    ngx.req.set_header("X-Forwarded-Host", ngx.var.host)
    ngx.req.set_header("X-Original-Host", routing_key)
    ngx.req.set_header("X-Routing-Strategy", strategy)
    
    if config.customHeaders then
        for k, v in pairs(config.customHeaders) do
            ngx.req.set_header(k, v)
        end
    end
    
    ngx.var.target = "http://localhost:" .. spinlet_state.port
    update_metrics_with_strategy(routing_key, route.spinletId, strategy, ngx.status)
end