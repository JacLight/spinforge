--[[
  SpinForge - Open Source Hosting Platform
  Copyright (c) 2025 Jacob Ajiboye
  
  This software is licensed under the MIT License.
  See the LICENSE file in the root directory for details.
--]]
-- SpinForge Proxy Handler
-- Handles reverse proxy configurations

local cjson = require "cjson"

local M = {}

-- Parse proxy configuration from route
function M.get_proxy_config(route, uri)
    if not route.config or not route.config.proxy then
        return nil
    end
    
    local proxy_config = route.config.proxy
    
    -- Simple proxy to single target
    if type(proxy_config) == "string" then
        return {
            target = proxy_config,
            path = uri
        }
    end
    
    -- Complex proxy with path-specific rules
    if type(proxy_config) == "table" then
        -- Check if it's a single proxy config
        if proxy_config.target then
            return {
                target = proxy_config.target,
                path = uri,
                changeOrigin = proxy_config.changeOrigin,
                preserveHostHeader = proxy_config.preserveHostHeader,
                headers = proxy_config.headers,
                stripPath = proxy_config.stripPath
            }
        end
        
        -- Path-specific proxy rules
        for path_prefix, config in pairs(proxy_config) do
            if string.sub(uri, 1, #path_prefix) == path_prefix then
                local target_path = uri
                
                -- Strip path prefix if configured
                if config.stripPath then
                    target_path = string.sub(uri, #path_prefix + 1)
                    if target_path == "" then
                        target_path = "/"
                    end
                end
                
                return {
                    target = config.target or config,
                    path = target_path,
                    changeOrigin = config.changeOrigin,
                    preserveHostHeader = config.preserveHostHeader,
                    headers = config.headers,
                    matchedPrefix = path_prefix
                }
            end
        end
    end
    
    return nil
end

-- Set proxy headers
function M.set_proxy_headers(proxy_config, original_host)
    -- Standard proxy headers
    ngx.req.set_header("X-Real-IP", ngx.var.remote_addr)
    ngx.req.set_header("X-Forwarded-For", ngx.var.proxy_add_x_forwarded_for)
    ngx.req.set_header("X-Forwarded-Proto", ngx.var.scheme)
    ngx.req.set_header("X-Forwarded-Host", original_host)
    
    -- Change origin if needed (for CORS)
    if proxy_config.changeOrigin then
        local target_host = proxy_config.target:match("://([^/]+)")
        if target_host then
            ngx.req.set_header("Host", target_host)
        end
    elseif not proxy_config.preserveHostHeader then
        -- Default: pass original host
        ngx.req.set_header("Host", original_host)
    end
    
    -- Custom headers
    if proxy_config.headers then
        for header, value in pairs(proxy_config.headers) do
            ngx.req.set_header(header, value)
        end
    end
end

-- Load balancing logic
function M.get_balanced_target(targets, method)
    if not targets or #targets == 0 then
        return nil
    end
    
    if #targets == 1 then
        return targets[1]
    end
    
    -- Simple round-robin using shared memory
    local targets_cache = ngx.shared.spinlets_cache
    local key = "lb:counter:" .. ngx.var.host
    local counter = targets_cache:incr(key, 1, 0)
    
    local index = (counter % #targets) + 1
    return targets[index]
end

-- Health check for targets
function M.is_target_healthy(target)
    local health_cache = ngx.shared.routes_cache
    local key = "health:" .. target
    local status = health_cache:get(key)
    
    -- If no health status cached, assume healthy
    if not status then
        return true
    end
    
    return status == "healthy"
end

-- Get healthy target from list
function M.get_healthy_target(targets)
    -- Try each target until we find a healthy one
    for _, target in ipairs(targets) do
        if M.is_target_healthy(target) then
            return target
        end
    end
    
    -- If all are unhealthy, return first one anyway
    ngx.log(ngx.WARN, "All proxy targets unhealthy, using first target")
    return targets[1]
end

-- Handle WebSocket upgrade
function M.handle_websocket_upgrade()
    local headers = ngx.req.get_headers()
    
    if headers["upgrade"] and headers["upgrade"]:lower() == "websocket" then
        ngx.req.set_header("Upgrade", headers["upgrade"])
        ngx.req.set_header("Connection", "upgrade")
        return true
    end
    
    return false
end

-- Rewrite location headers in responses
function M.rewrite_location_header(proxy_config)
    local location = ngx.header["Location"]
    
    if location and proxy_config.target then
        -- Replace proxy target with original host
        local original_host = ngx.var.host
        local target_host = proxy_config.target:match("://([^/]+)")
        
        if target_host and original_host then
            location = location:gsub(target_host, original_host)
            ngx.header["Location"] = location
        end
    end
end

return M