--[[
  SpinForge - Open Source Hosting Platform
  Copyright (c) 2025 Jacob Ajiboye
  
  This software is licensed under the MIT License.
  See the LICENSE file in the root directory for details.
--]]
-- SpinForge Web Root Router
-- Serves static content from /web_root and proxies dynamic apps

local redis = require "resty.redis"
local cjson = require "cjson"
local proxy_handler = require "proxy_handler"

-- Configuration
local WEB_ROOT = "/web_root"
local ENABLE_HOST_HEADER_OVERRIDE = true
local DEFAULT_INDEX_FILES = {"index.html", "index.htm", "default.html"}

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
    
    -- Check for Host header override
    if ENABLE_HOST_HEADER_OVERRIDE then
        local host_override = ngx.req.get_headers()["X-Host-Override"]
        if host_override then
            ngx.log(ngx.INFO, "Using host header override: ", host_override)
            return host_override
        end
    end
    
    return domain
end

-- Get route information from Redis
local function get_route(domain)
    local routes_cache = ngx.shared.routes_cache
    local cache_key = "route:" .. domain
    local cached_route = routes_cache:get(cache_key)
    
    if cached_route then
        return cjson.decode(cached_route)
    end
    
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
    routes_cache:set(cache_key, route_json, 60)
    
    return_redis_connection(red)
    return cjson.decode(route_json)
end

-- Determine web root path based on route
local function get_web_root_path(route)
    -- Path structure: /web_root/{customerId}/{appName}/
    local customer_id = route.customerId
    local app_name = route.spinletId:match("^([^-]+)") or route.spinletId
    
    return WEB_ROOT .. "/" .. customer_id .. "/" .. app_name
end

-- Check if file exists
local function file_exists(path)
    local f = io.open(path, "r")
    if f then
        f:close()
        return true
    end
    return false
end

-- Find index file
local function find_index_file(dir_path)
    for _, index_file in ipairs(DEFAULT_INDEX_FILES) do
        local full_path = dir_path .. "/" .. index_file
        if file_exists(full_path) then
            return index_file
        end
    end
    return nil
end

-- Get MIME type from file extension
local function get_mime_type(filename)
    local ext = filename:match("%.([^.]+)$")
    if not ext then return "application/octet-stream" end
    
    local mime_types = {
        html = "text/html",
        htm = "text/html",
        css = "text/css",
        js = "application/javascript",
        json = "application/json",
        xml = "application/xml",
        txt = "text/plain",
        png = "image/png",
        jpg = "image/jpeg",
        jpeg = "image/jpeg",
        gif = "image/gif",
        svg = "image/svg+xml",
        ico = "image/x-icon",
        woff = "font/woff",
        woff2 = "font/woff2",
        ttf = "font/ttf",
        eot = "application/vnd.ms-fontobject",
        mp4 = "video/mp4",
        webm = "video/webm",
        mp3 = "audio/mpeg",
        pdf = "application/pdf",
        zip = "application/zip"
    }
    
    return mime_types[ext:lower()] or "application/octet-stream"
end

-- Update access metrics
local function update_metrics(domain, customer_id, app_name, status)
    local metrics = ngx.shared.metrics
    
    metrics:incr("requests:total", 1, 0)
    metrics:incr("requests:domain:" .. domain, 1, 0)
    metrics:incr("requests:customer:" .. customer_id, 1, 0)
    metrics:incr("requests:app:" .. app_name, 1, 0)
    metrics:incr("requests:status:" .. status, 1, 0)
    
    -- Async update to Redis
    ngx.timer.at(0, function()
        local red = get_redis_connection()
        if red then
            red:hincrby("spinforge:metrics:requests", "total", 1)
            red:hincrby("spinforge:metrics:customers:" .. customer_id, "requests", 1)
            return_redis_connection(red)
        end
    end)
end

-- Main routing logic
local domain = get_routing_key()
local uri = ngx.var.uri

ngx.log(ngx.INFO, "Web root routing - Domain: ", domain, " URI: ", uri)

-- Get route information
local route, err = get_route(domain)
if not route then
    ngx.status = 404
    ngx.header["Content-Type"] = "text/html"
    ngx.say([[
<!DOCTYPE html>
<html>
<head>
    <title>404 - Domain Not Found</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
               text-align: center; padding: 50px; background: #f5f5f5; }
        .container { background: white; padding: 40px; border-radius: 10px; 
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
        h1 { color: #333; margin-bottom: 20px; }
        p { color: #666; line-height: 1.6; }
        .domain { background: #f0f0f0; padding: 10px 20px; border-radius: 5px; 
                 display: inline-block; margin: 10px 0; font-family: monospace; }
    </style>
</head>
<body>
    <div class="container">
        <h1>404 - Domain Not Found</h1>
        <p>No application is deployed at:</p>
        <div class="domain">]] .. domain .. [[</div>
        <p>Please check the domain name and try again.</p>
    </div>
</body>
</html>
    ]])
    ngx.exit(404)
    return
end

-- Check for reverse proxy configuration first
local proxy_config = proxy_handler.get_proxy_config(route, uri)
if proxy_config then
    -- This is a reverse proxy request
    ngx.log(ngx.INFO, "Reverse proxy request to: ", proxy_config.target)
    
    -- Set proxy headers
    proxy_handler.set_proxy_headers(proxy_config, domain)
    
    -- Handle WebSocket upgrade if needed
    proxy_handler.handle_websocket_upgrade()
    
    -- Set the target URL
    ngx.var.target = proxy_config.target .. proxy_config.path
    ngx.var.framework = "reverse-proxy"
    
    -- Update metrics
    local app_name = route.spinletId:match("^([^-]+)") or route.spinletId
    update_metrics(domain, route.customerId, app_name, 200)
    
    return
end

-- Determine if this is a static or dynamic app
local framework = route.framework or "static"
local is_static = framework == "static" or framework == "react" or framework == "vue" or framework == "angular"

-- For Next.js, check if it's a static export
if framework == "nextjs" and route.config and route.config.output == "export" then
    is_static = true
end

-- Pure reverse proxy (no local files)
if framework == "reverse-proxy" then
    ngx.status = 502
    ngx.header["Content-Type"] = "text/html"
    ngx.say([[
<!DOCTYPE html>
<html>
<head>
    <title>Proxy Configuration Error</title>
</head>
<body>
    <h1>502 - Proxy Configuration Error</h1>
    <p>Reverse proxy is not properly configured for this domain.</p>
</body>
</html>
    ]])
    ngx.exit(502)
    return
end

-- Handle static content
if is_static then
    local web_root_path = get_web_root_path(route)
    local file_path = web_root_path .. uri
    
    -- Security: prevent directory traversal
    if string.find(uri, "%.%.") then
        ngx.exit(403)
        return
    end
    
    -- Handle directory requests
    if string.sub(uri, -1) == "/" then
        local index_file = find_index_file(web_root_path .. uri)
        if index_file then
            file_path = web_root_path .. uri .. index_file
        else
            ngx.exit(404)
            return
        end
    end
    
    -- Check if file exists
    if not file_exists(file_path) then
        -- Try SPA fallback (for React, Vue, Angular)
        if framework ~= "static" then
            local fallback_path = web_root_path .. "/index.html"
            if file_exists(fallback_path) then
                file_path = fallback_path
            else
                ngx.exit(404)
                return
            end
        else
            ngx.exit(404)
            return
        end
    end
    
    -- Serve the file
    ngx.var.static_root = web_root_path
    ngx.var.framework = "static"
    
    -- Set content type
    ngx.header["Content-Type"] = get_mime_type(file_path)
    
    -- Set cache headers
    local ext = file_path:match("%.([^.]+)$")
    if ext and (ext == "js" or ext == "css" or ext:match("^(png|jpg|jpeg|gif|svg|woff2?)$")) then
        ngx.header["Cache-Control"] = "public, max-age=31536000, immutable"
    else
        ngx.header["Cache-Control"] = "public, max-age=3600"
    end
    
    -- Update metrics
    local app_name = route.spinletId:match("^([^-]+)") or route.spinletId
    update_metrics(domain, route.customerId, app_name, 200)
    
    -- Let nginx serve the file
    ngx.exec("@serve_static", ngx.var.args)
    
else
    -- Dynamic app - check if spinlet is running
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
        ngx.status = 503
        ngx.header["Content-Type"] = "text/html"
        ngx.say([[
<!DOCTYPE html>
<html>
<head>
    <title>Application Offline</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
               text-align: center; padding: 50px; background: #f5f5f5; }
        .container { background: white; padding: 40px; border-radius: 10px; 
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
        h1 { color: #333; }
        .status { background: #fff3cd; color: #856404; padding: 15px; 
                 border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Application Offline</h1>
        <div class="status">
            This application is currently ]] .. (spinlet_state and spinlet_state.state or "unavailable") .. [[
        </div>
        <p>Please try again later or contact support if the issue persists.</p>
    </div>
</body>
</html>
        ]])
        ngx.exit(503)
        return
    end
    
    -- Proxy to running spinlet
    ngx.var.target = "http://localhost:" .. spinlet_state.port
    ngx.var.framework = "proxy"
    
    -- Update metrics
    local app_name = route.spinletId:match("^([^-]+)") or route.spinletId
    update_metrics(domain, route.customerId, app_name, ngx.status)
end