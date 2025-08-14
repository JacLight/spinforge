--[[
  SpinForge - Container Discovery Module
  Discovers container information by domain label
  Copyright (c) 2025 Jacob Ajiboye
  Licensed under the MIT License
--]]

local _M = {}
local cjson = require "cjson"

-- Function to execute docker inspect and get container info
local function docker_inspect_by_label(domain)
    -- Use io.popen to execute docker command
    -- Look for containers with label spinforge.domain=<domain>
    local cmd = string.format('docker ps --filter "label=spinforge.domain=%s" --format "{{json .}}"', domain)
    local handle = io.popen(cmd)
    
    if not handle then
        ngx.log(ngx.ERR, "Container Discovery: Failed to execute docker command")
        return nil
    end
    
    local result = handle:read("*a")
    handle:close()
    
    if result and result ~= "" then
        -- Parse the JSON output
        local ok, container_info = pcall(cjson.decode, result)
        if ok and container_info then
            ngx.log(ngx.INFO, "Container Discovery: Found container for domain: ", domain)
            return container_info
        end
    end
    
    ngx.log(ngx.WARN, "Container Discovery: No container found for domain: ", domain)
    return nil
end

-- Function to get container IP by name
local function get_container_ip(container_name)
    local cmd = string.format('docker inspect %s --format "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"', container_name)
    local handle = io.popen(cmd)
    
    if not handle then
        return nil
    end
    
    local ip = handle:read("*a")
    handle:close()
    
    if ip then
        ip = ip:gsub("%s+", "") -- Remove whitespace
        if ip ~= "" then
            ngx.log(ngx.INFO, "Container Discovery: Container ", container_name, " has IP: ", ip)
            return ip
        end
    end
    
    return nil
end

-- Main discovery function
function _M.discover_container(domain)
    ngx.log(ngx.INFO, "Container Discovery: Attempting to discover container for domain: ", domain)
    
    -- First try to find container by label
    local container = docker_inspect_by_label(domain)
    
    if not container then
        -- Try alternative approaches
        -- 1. Check if domain matches a known container pattern
        -- For example: admin.spinforge.dev -> spinforge-admin-ui
        local patterns = {
            ["admin%.spinforge%.dev"] = "spinforge-admin-ui",
            ["api%.spinforge%.dev"] = "spinforge-api",
            ["vscode%.spinforge%.dev"] = "spinforge-vscode-spinforge-dev",
        }
        
        for pattern, container_name in pairs(patterns) do
            if domain:match(pattern) then
                ngx.log(ngx.INFO, "Container Discovery: Found pattern match for domain: ", domain, " -> ", container_name)
                
                -- Get container IP
                local ip = get_container_ip(container_name)
                if ip then
                    -- Determine port based on container type
                    local port = 80 -- Default port
                    if container_name == "spinforge-api" then
                        port = 8080
                    elseif container_name:match("vscode") then
                        port = 3000
                    end
                    
                    local target = string.format("http://%s:%d", ip, port)
                    ngx.log(ngx.INFO, "Container Discovery: Resolved target: ", target)
                    
                    return {
                        container_name = container_name,
                        container_ip = ip,
                        target = target,
                        discovered = true
                    }
                end
            end
        end
    end
    
    -- If container found by label, extract details
    if container then
        local container_name = container.Names
        local ip = get_container_ip(container_name)
        
        if ip then
            -- Extract port from container labels or use default
            local port = container.Labels and container.Labels["spinforge.port"] or 80
            local target = string.format("http://%s:%s", ip, port)
            
            return {
                container_name = container_name,
                container_ip = ip,
                target = target,
                discovered = true
            }
        end
    end
    
    ngx.log(ngx.WARN, "Container Discovery: Could not discover container for domain: ", domain)
    return nil
end

-- Function to update Redis with discovered container info
function _M.update_redis_cache(domain, container_info, redis_connection)
    if not container_info or not container_info.discovered then
        return false
    end
    
    ngx.log(ngx.INFO, "Container Discovery: Updating Redis cache for domain: ", domain)
    
    -- Create or update site configuration
    local site_config = {
        domain = domain,
        type = "proxy",
        target = container_info.target,
        container_name = container_info.container_name,
        enabled = true,
        auto_discovered = true,
        updated_at = ngx.now()
    }
    
    local site_json = cjson.encode(site_config)
    local site_key = "site:" .. domain
    
    local ok, err = redis_connection:set(site_key, site_json)
    if not ok then
        ngx.log(ngx.ERR, "Container Discovery: Failed to update Redis: ", err)
        return false
    end
    
    -- Set TTL for auto-discovered entries (5 minutes)
    redis_connection:expire(site_key, 300)
    
    ngx.log(ngx.INFO, "Container Discovery: Successfully updated Redis cache for domain: ", domain)
    return true
end

return _M