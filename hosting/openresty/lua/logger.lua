local redis = require "resty.redis"
local cjson = require "cjson"

local _M = {}

-- Get Redis connection
local function get_redis_connection()
    local red = redis:new()
    red:set_timeouts(1000, 1000, 1000) -- 1 second timeout
    
    -- Use the same connection settings as router.lua
    local ok, err = red:connect("172.18.0.2", redis_port or 16378)
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

-- Return Redis connection to pool
local function return_redis_connection(red)
    local ok, err = red:set_keepalive(10000, 100)
    if not ok then
        ngx.log(ngx.ERR, "Failed to set keepalive: ", err)
    end
end

-- Log request to Redis using pre-captured data
function _M.log_request_data(request_data)
    if not request_data or not request_data.domain then
        ngx.log(ngx.ERR, "Logger: No request data or domain provided")
        return
    end
    
    local domain = request_data.domain
    ngx.log(ngx.DEBUG, "Logger: Logging request for domain: ", domain)
    
    local red, err = get_redis_connection()
    if not red then
        ngx.log(ngx.ERR, "Logger: Failed to get Redis connection: ", err)
        return
    end
    
    -- Prepare log entry
    local log_entry = {
        timestamp = ngx.now() * 1000, -- milliseconds
        method = request_data.method,
        path = request_data.uri,
        status = request_data.status,
        bytes = request_data.bytes,
        responseTime = (ngx.now() - request_data.start_time) * 1000, -- milliseconds
        ip = request_data.remote_addr,
        userAgent = request_data.user_agent,
        referer = request_data.referer
    }
    
    -- Convert to JSON
    local ok, json_log = pcall(cjson.encode, log_entry)
    if not ok then
        ngx.log(ngx.ERR, "Failed to encode log entry")
        return_redis_connection(red)
        return
    end
    
    -- Store in Redis list (keep last 1000 entries)
    local logs_key = "logs:" .. domain
    red:lpush(logs_key, json_log)
    red:ltrim(logs_key, 0, 999)
    
    -- Update metrics
    local metrics_key = "metrics:" .. domain
    red:hincrby(metrics_key, "totalRequests", 1)
    red:hincrby(metrics_key, "totalBandwidth", log_entry.bytes)
    red:hset(metrics_key, "lastAccessed", ngx.now() * 1000)
    
    -- Track unique visitors (simple IP-based)
    local visitors_key = "visitors:" .. domain .. ":" .. os.date("%Y%m%d")
    red:sadd(visitors_key, ngx.var.remote_addr)
    red:expire(visitors_key, 86400 * 7) -- Keep for 7 days
    
    -- Update unique visitor count
    local visitor_count = red:scard(visitors_key)
    red:hset(metrics_key, "uniqueVisitors", visitor_count)
    
    ngx.log(ngx.DEBUG, "Logger: Successfully logged metrics for domain: ", domain)
    
    return_redis_connection(red)
end

-- Get subdomain from host
function _M.get_subdomain()
    local host = ngx.var.host
    if not host then
        return nil
    end
    
    -- Check if we have a resolved subdomain in ngx.ctx
    if ngx.ctx.resolved_subdomain then
        return ngx.ctx.resolved_subdomain
    end
    
    -- Extract subdomain from host
    local subdomain = host:match("^([^.]+)")
    return subdomain
end

return _M