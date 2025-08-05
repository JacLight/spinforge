--[[
  SpinForge - Open Source Hosting Platform
  Copyright (c) 2025 Jacob Ajiboye
  
  This software is licensed under the MIT License.
  See the LICENSE file in the root directory for details.
--]]
-- SpinForge OpenResty Router
-- Direct Redis-based routing without SpinHub proxy

local redis = require "resty.redis"
local cjson = require "cjson"

-- Helper function to get Redis connection
local function get_redis_connection()
    local red = redis:new()
    red:set_timeout(1000) -- 1 second timeout
    
    local ok, err = red:connect("keydb", 16378)
    if not ok then
        ngx.log(ngx.ERR, "Failed to connect to Redis: ", err)
        return nil, err
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

-- Get route from cache or Redis
local function get_route(domain)
    -- Check shared dict cache first
    local routes_cache = ngx.shared.routes_cache
    local cached_route = routes_cache:get(domain)
    
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
    
    -- Cache for 60 seconds
    routes_cache:set(domain, route_json, 60)
    
    return_redis_connection(red)
    return cjson.decode(route_json)
end

-- Get spinlet state from Redis
local function get_spinlet_state(spinlet_id)
    -- Check cache first
    local spinlets_cache = ngx.shared.spinlets_cache
    local cached_state = spinlets_cache:get(spinlet_id)
    
    if cached_state then
        return cjson.decode(cached_state)
    end
    
    -- Get from Redis
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
    
    -- Cache for 5 seconds (short because state changes frequently)
    spinlets_cache:set(spinlet_id, state_json, 5)
    
    return_redis_connection(red)
    return cjson.decode(state_json)
end

-- Update metrics
local function update_metrics(domain, spinlet_id, status)
    local metrics = ngx.shared.metrics
    
    -- Increment request count
    metrics:incr("requests:total", 1, 0)
    metrics:incr("requests:domain:" .. domain, 1, 0)
    metrics:incr("requests:spinlet:" .. spinlet_id, 1, 0)
    metrics:incr("requests:status:" .. status, 1, 0)
    
    -- Update in Redis periodically (async)
    ngx.timer.at(0, function()
        local red = get_redis_connection()
        if red then
            red:hincrby("spinforge:metrics:requests", "total", 1)
            red:hincrby("spinforge:metrics:requests", domain, 1)
            red:hincrby("spinforge:spinlets:" .. spinlet_id .. ":metrics", "requests", 1)
            return_redis_connection(red)
        end
    end)
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
    ngx.exit(404)
    return
end

-- For static sites, set the root directory
if route.framework == "static" then
    ngx.var.static_root = route.buildPath
    ngx.var.framework = "static"
    update_metrics(domain, route.spinletId, ngx.status)
    return
end

-- For dynamic apps, get spinlet state
local spinlet_state, err = get_spinlet_state(route.spinletId)
if not spinlet_state then
    ngx.log(ngx.ERR, "Spinlet not found: ", route.spinletId, " Error: ", err)
    ngx.status = 503
    ngx.exit(503)
    return
end

-- Check if spinlet is running
if spinlet_state.state ~= "running" then
    -- Try to wake up idle spinlet
    if spinlet_state.state == "idle" then
        ngx.log(ngx.INFO, "Waking up idle spinlet: ", route.spinletId)
        
        -- Send wake-up request to SpinHub (async)
        ngx.timer.at(0, function()
            local httpc = require("resty.http").new()
            httpc:request_uri("http://spinhub:8080/_admin/spinlets/" .. route.spinletId .. "/start", {
                method = "POST",
                headers = {
                    ["X-Internal-Request"] = "true"
                }
            })
        end)
        
        -- Return a friendly loading page
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
                </style>
            </head>
            <body>
                <h1>Application Starting</h1>
                <div class="spinner"></div>
                <p>Your application is waking up. This page will refresh automatically...</p>
            </body>
            </html>
        ]])
        ngx.exit(503)
        return
    else
        ngx.log(ngx.ERR, "Spinlet not running: ", route.spinletId, " State: ", spinlet_state.state)
        ngx.status = 503
        ngx.exit(503)
        return
    end
end

-- Set proxy target
ngx.var.spinlet_port = spinlet_state.port
ngx.var.framework = route.framework

-- Update last access time (async)
ngx.timer.at(0, function()
    local red = get_redis_connection()
    if red then
        red:hset("spinforge:spinlets:" .. route.spinletId .. ":state", "lastAccess", ngx.time())
        return_redis_connection(red)
    end
end)

update_metrics(domain, route.spinletId, ngx.status)