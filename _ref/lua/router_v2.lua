--[[
  SpinForge - Open Source Hosting Platform
  Copyright (c) 2025 Jacob Ajiboye
  
  This software is licensed under the MIT License.
  See the LICENSE file in the root directory for details.
--]]
-- SpinForge OpenResty Router V2
-- Supports multiple domains pointing to same app (hosted or proxied)

local cjson = require "cjson"
local app_detector = require "app_detector"
local redis_conn = require "redis_connection"

-- Helper function to get Redis connection
local function get_redis_connection()
    return redis_conn.get_connection()
end

-- Helper function to return Redis connection to pool
local function return_redis_connection(red)
    return redis_conn.return_connection(red)
end

-- Get route from cache or Redis
local function get_route(domain)
    -- Check shared dict cache first
    local routes_cache = ngx.shared.routes_cache
    local cache_key = "route:" .. domain
    local cached_route = routes_cache:get(cache_key)
    
    if cached_route then
        return cjson.decode(cached_route)
    end
    
    -- Get from Redis
    local red, err = get_redis_connection()
    if not red then
        return nil, err
    end
    
    local route_key = "spinforge:routes:" .. domain
    local route_json, err = red:get(route_key)
    
    if err then
        return_redis_connection(red)
        return nil, err
    end
    
    if route_json == ngx.null or not route_json then
        return_redis_connection(red)
        return nil, "Route not found"
    end
    
    local route = cjson.decode(route_json)
    
    -- Get all domains for this spinlet (for caching)
    if route.spinletId then
        local domains_key = "spinforge:spinlets:" .. route.spinletId .. ":domains"
        local all_domains, err = red:smembers(domains_key)
        
        if not err and all_domains then
            route.allDomains = all_domains
            
            -- Cache route for all associated domains
            local route_str = cjson.encode(route)
            for _, d in ipairs(all_domains) do
                routes_cache:set("route:" .. d, route_str, 60)
            end
        end
    end
    
    return_redis_connection(red)
    return route
end

-- Get serving configuration (cached per spinlet, not per domain)
local function get_serving_config(route)
    local config_cache = ngx.shared.spinlets_cache
    local cache_key = "config:" .. route.spinletId
    local cached_config = config_cache:get(cache_key)
    
    if cached_config then
        return cjson.decode(cached_config)
    end
    
    -- Detect app type and get configuration
    local config = app_detector.get_serving_config(route)
    
    -- Cache configuration for all domains of this spinlet
    config_cache:set(cache_key, cjson.encode(config), 300) -- 5 minutes
    
    return config
end

-- Get spinlet state (for proxy apps only)
local function get_spinlet_state(spinlet_id)
    local spinlets_cache = ngx.shared.spinlets_cache
    local cache_key = "state:" .. spinlet_id
    local cached_state = spinlets_cache:get(cache_key)
    
    if cached_state then
        return cjson.decode(cached_state)
    end
    
    local red, err = get_redis_connection()
    if not red then
        return nil, err
    end
    
    local state_key = "spinforge:spinlets:" .. spinlet_id .. ":state"
    local state_json, err = red:get(state_key)
    
    if err then
        return_redis_connection(red)
        return nil, err
    end
    
    if state_json == ngx.null or not state_json then
        return_redis_connection(red)
        return nil, "Spinlet not found"
    end
    
    -- Cache for 5 seconds
    spinlets_cache:set(cache_key, state_json, 5)
    
    return_redis_connection(red)
    return cjson.decode(state_json)
end

-- Update metrics and last access
local function update_access_metrics(domain, spinlet_id, status)
    local metrics = ngx.shared.metrics
    
    -- Increment request count
    metrics:incr("requests:total", 1, 0)
    metrics:incr("requests:domain:" .. domain, 1, 0)
    metrics:incr("requests:spinlet:" .. spinlet_id, 1, 0)
    metrics:incr("requests:status:" .. status, 1, 0)
    
    -- Update Redis async
    ngx.timer.at(0, function()
        local red = get_redis_connection()
        if red then
            -- Update metrics
            red:hincrby("spinforge:metrics:requests", "total", 1)
            red:hincrby("spinforge:metrics:requests", domain, 1)
            red:hincrby("spinforge:spinlets:" .. spinlet_id .. ":metrics", "requests", 1)
            
            -- Update last access time
            red:hset("spinforge:spinlets:" .. spinlet_id .. ":state", "lastAccess", ngx.time())
            
            -- Update domain access stats
            local today = os.date("%Y-%m-%d")
            red:hincrby("spinforge:stats:" .. today, domain, 1)
            red:expire("spinforge:stats:" .. today, 86400 * 7) -- Keep for 7 days
            
            return_redis_connection(red)
        end
    end)
end

-- Wake up idle spinlet
local function wake_up_spinlet(spinlet_id)
    ngx.timer.at(0, function()
        local httpc = require("resty.http").new()
        httpc:request_uri("http://spinhub:8080/_admin/spinlets/" .. spinlet_id .. "/start", {
            method = "POST",
            headers = {
                ["X-Internal-Request"] = "true"
            }
        })
    end)
end

-- Serve static file with proper mime type
local function serve_static_file(config, uri)
    local file_path = config.static_root .. uri
    
    -- Security: prevent directory traversal
    if string.find(uri, "%.%.") then
        ngx.exit(403)
        return
    end
    
    -- Check if file exists
    local f = io.open(file_path, "r")
    if not f then
        -- Try fallback (for SPA apps)
        if config.fallback and uri ~= config.fallback then
            file_path = config.static_root .. config.fallback
            f = io.open(file_path, "r")
        end
        
        if not f then
            ngx.exit(404)
            return
        end
    end
    
    -- Read file content
    local content = f:read("*all")
    f:close()
    
    -- Set content type based on extension
    local ext = uri:match("%.([^.]+)$")
    if ext and config.mime_types["." .. ext] then
        ngx.header["Content-Type"] = config.mime_types["." .. ext]
    else
        ngx.header["Content-Type"] = "application/octet-stream"
    end
    
    -- Cache headers for static assets
    if ext and (ext == "js" or ext == "css" or ext == "png" or ext == "jpg" or ext == "svg") then
        ngx.header["Cache-Control"] = "public, max-age=31536000"
    else
        ngx.header["Cache-Control"] = "public, max-age=3600"
    end
    
    ngx.say(content)
end

-- Main routing logic
local domain = ngx.var.host:gsub(":.*", "") -- Remove port
local uri = ngx.var.uri

ngx.log(ngx.INFO, "Routing request for domain: ", domain, " URI: ", uri)

-- Get route information
local route, err = get_route(domain)
if not route then
    ngx.log(ngx.ERR, "Route not found for domain: ", domain, " Error: ", err)
    ngx.status = 404
    ngx.header["Content-Type"] = "text/html"
    ngx.say([[
        <!DOCTYPE html>
        <html>
        <head><title>404 - Domain Not Found</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>404 - Domain Not Found</h1>
            <p>No application is deployed at <strong>]] .. domain .. [[</strong></p>
            <p style="color: #666; margin-top: 20px;">
                If you recently deployed an application, please wait a moment and try again.
            </p>
        </body>
        </html>
    ]])
    ngx.exit(404)
    return
end

-- Get serving configuration
local config = get_serving_config(route)

-- Handle based on app type
if config.type == "hosted" then
    -- Serve static files directly
    serve_static_file(config, uri)
    update_access_metrics(domain, route.spinletId, ngx.status)
    
elseif config.type == "proxy" then
    -- Get spinlet state for proxy apps
    local spinlet_state, err = get_spinlet_state(route.spinletId)
    if not spinlet_state then
        ngx.log(ngx.ERR, "Spinlet not found: ", route.spinletId, " Error: ", err)
        ngx.status = 503
        ngx.exit(503)
        return
    end
    
    -- Check if spinlet is running
    if spinlet_state.state ~= "running" then
        if spinlet_state.state == "idle" then
            ngx.log(ngx.INFO, "Waking up idle spinlet: ", route.spinletId)
            wake_up_spinlet(route.spinletId)
            
            -- Return loading page
            ngx.header["Content-Type"] = "text/html"
            ngx.header["Retry-After"] = "2"
            ngx.status = 503
            ngx.say([[
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Application Starting...</title>
                    <meta http-equiv="refresh" content="2">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #3498db; 
                                  border-radius: 50%; width: 40px; height: 40px; 
                                  animation: spin 1s linear infinite; margin: 20px auto; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        .domains { margin-top: 30px; color: #666; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <h1>Application Starting</h1>
                    <div class="spinner"></div>
                    <p>Your application is waking up. This page will refresh automatically...</p>
                    ]] .. (route.allDomains and #route.allDomains > 1 and [[
                    <div class="domains">
                        <p>This application is also available at:</p>
                        <ul style="list-style: none; padding: 0;">
                        ]] .. table.concat(
                            (function()
                                local links = {}
                                for _, d in ipairs(route.allDomains) do
                                    if d ~= domain then
                                        table.insert(links, '<li><a href="http://' .. d .. '">' .. d .. '</a></li>')
                                    end
                                end
                                return links
                            end)(),
                            "\n"
                        ) .. [[
                        </ul>
                    </div>
                    ]] or "") .. [[
                </body>
                </html>
            ]])
            ngx.exit(503)
            return
        else
            ngx.log(ngx.ERR, "Spinlet not in valid state: ", route.spinletId, " State: ", spinlet_state.state)
            ngx.status = 503
            ngx.exit(503)
            return
        end
    end
    
    -- Proxy to running spinlet
    ngx.var.target = "http://localhost:" .. spinlet_state.port
    update_access_metrics(domain, route.spinletId, ngx.status)
    
else
    ngx.log(ngx.ERR, "Unknown app type: ", config.type)
    ngx.status = 500
    ngx.exit(500)
end