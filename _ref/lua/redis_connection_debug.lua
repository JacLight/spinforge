--[[
  SpinForge - Open Source Hosting Platform
  Copyright (c) 2025 Jacob Ajiboye
  
  This software is licensed under the MIT License.
  See the LICENSE file in the root directory for details.
--]]
-- Common Redis connection module for SpinForge with debug logging
-- Reads connection details from environment variables

local redis = require "resty.redis"

local _M = {}

-- Get Redis connection
function _M.get_connection()
    local red = redis:new()
    red:set_timeout(1000) -- 1 second timeout
    
    -- Get Redis connection details from environment variables or use defaults
    -- In OpenResty, we need to use ngx.var to access environment variables
    local redis_host = ngx.var.REDIS_HOST or os.getenv("REDIS_HOST") or "keydb"
    local redis_port = tonumber(ngx.var.REDIS_PORT or os.getenv("REDIS_PORT")) or 16378
    
    ngx.log(ngx.INFO, "Connecting to Redis at " .. redis_host .. ":" .. redis_port)
    
    local ok, err = red:connect(redis_host, redis_port)
    if not ok then
        ngx.log(ngx.ERR, "Failed to connect to Redis at " .. redis_host .. ":" .. redis_port .. ": ", err)
        return nil, err
    end
    
    -- Optional: Set Redis password if provided
    local redis_pass = ngx.var.REDIS_PASSWORD or os.getenv("REDIS_PASSWORD")
    ngx.log(ngx.INFO, "Redis password from ngx.var: ", ngx.var.REDIS_PASSWORD or "nil")
    ngx.log(ngx.INFO, "Redis password from env: ", os.getenv("REDIS_PASSWORD") or "nil")
    ngx.log(ngx.INFO, "Using Redis password: ", redis_pass and "***" or "none")
    
    if redis_pass and redis_pass ~= "" then
        ngx.log(ngx.INFO, "Authenticating with Redis...")
        local res, err = red:auth(redis_pass)
        if not res then
            ngx.log(ngx.ERR, "Failed to authenticate with Redis: ", err)
            return nil, err
        end
        ngx.log(ngx.INFO, "Redis authentication successful")
    else
        ngx.log(ngx.INFO, "No Redis password configured")
    end
    
    return red
end

-- Return Redis connection to pool
function _M.return_connection(red)
    if not red then
        return
    end
    
    -- Put connection into the connection pool
    local ok, err = red:set_keepalive(10000, 100)
    if not ok then
        ngx.log(ngx.ERR, "Failed to set keepalive: ", err)
    end
end

return _M