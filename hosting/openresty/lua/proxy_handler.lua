--[[
  SpinForge - Proxy Handler with Auto-Discovery
  Handles proxy failures and triggers container discovery
  Copyright (c) 2025 Jacob Ajiboye
  Licensed under the MIT License
--]]

local _M = {}
local container_discovery = require "container_discovery"
local redis = require "resty.redis"
local cjson = require "cjson"

-- Helper function to get Redis connection
local function get_redis_connection()
    local red = redis:new()
    red:set_timeout(1000) -- 1 second timeout
    
    local ok, err = red:connect("keydb", redis_port or 16378)
    if not ok then
        ngx.log(ngx.ERR, "Proxy Handler: Failed to connect to Redis: ", err)
        return nil, err
    end
    
    if redis_password and redis_password ~= "" then
        local ok, err = red:auth(redis_password)
        if not ok then
            ngx.log(ngx.ERR, "Proxy Handler: Failed to authenticate: ", err)
            return nil, err
        end
    end
    
    if redis_db and redis_db ~= 0 then
        local ok, err = red:select(redis_db)
        if not ok then
            ngx.log(ngx.ERR, "Proxy Handler: Failed to select DB: ", err)
            return nil, err
        end
    end
    
    return red
end

-- Function to handle proxy errors and trigger discovery
function _M.handle_proxy_error()
    local status = ngx.status
    local domain = ngx.ctx.original_domain or ngx.var.host
    
    -- Only trigger discovery for connection errors (502, 503, 504)
    if status ~= 502 and status ~= 503 and status ~= 504 then
        return
    end
    
    -- Check if we should try discovery
    if not ngx.ctx.may_need_discovery then
        return
    end
    
    ngx.log(ngx.WARN, "Proxy Handler: Proxy failed for domain: ", domain, " with status: ", status, ". Triggering discovery...")
    
    -- Attempt container discovery
    local container_info = container_discovery.discover_container(domain)
    
    if container_info and container_info.discovered then
        ngx.log(ngx.INFO, "Proxy Handler: Discovery successful for domain: ", domain)
        
        -- Update Redis with new container info
        local red = get_redis_connection()
        if red then
            -- Get existing site config
            local site_key = "site:" .. domain
            local existing_config, err = red:get(site_key)
            
            if existing_config and existing_config ~= ngx.null then
                local config = cjson.decode(existing_config)
                -- Update only the target, keep other settings
                config.target = container_info.target
                config.container_name = container_info.container_name
                config.last_discovered = ngx.now()
                
                local updated_json = cjson.encode(config)
                red:set(site_key, updated_json)
                
                ngx.log(ngx.INFO, "Proxy Handler: Updated Redis with new target: ", container_info.target)
                
                -- Clear the route cache to force reload
                local routes_cache = ngx.shared.routes_cache
                if routes_cache then
                    routes_cache:delete(site_key)
                end
                
                -- Return connection to pool
                red:set_keepalive(10000, 100)
                
                -- Send redirect to retry the request
                ngx.status = 307  -- Temporary redirect
                ngx.header["Location"] = ngx.var.request_uri
                ngx.header["X-Discovery-Triggered"] = "true"
                ngx.exit(307)
            else
                red:set_keepalive(10000, 100)
            end
        end
    else
        ngx.log(ngx.ERR, "Proxy Handler: Discovery failed for domain: ", domain)
    end
end

return _M