local redis = require "resty.redis"
local cjson = require "cjson"

local _M = {}

-- Get Redis connection
local function get_redis_connection()
    local red = redis:new()
    red:set_timeouts(1000, 1000, 1000) -- 1 second timeout
    
    local ok, err = red:connect("keydb", 6379)
    if not ok then
        ngx.log(ngx.ERR, "Failed to connect to Redis: ", err)
        return nil, err
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

-- Log request to Redis
function _M.log_request(subdomain)
    if not subdomain then
        return
    end
    
    local red, err = get_redis_connection()
    if not red then
        return
    end
    
    -- Prepare log entry
    local log_entry = {
        timestamp = ngx.now() * 1000, -- milliseconds
        method = ngx.var.request_method,
        path = ngx.var.uri,
        status = ngx.var.status,
        bytes = tonumber(ngx.var.body_bytes_sent) or 0,
        responseTime = (ngx.now() - ngx.req.start_time()) * 1000, -- milliseconds
        ip = ngx.var.remote_addr,
        userAgent = ngx.var.http_user_agent,
        referer = ngx.var.http_referer
    }
    
    -- Convert to JSON
    local ok, json_log = pcall(cjson.encode, log_entry)
    if not ok then
        ngx.log(ngx.ERR, "Failed to encode log entry")
        return_redis_connection(red)
        return
    end
    
    -- Store in Redis list (keep last 1000 entries)
    local logs_key = "logs:" .. subdomain
    red:lpush(logs_key, json_log)
    red:ltrim(logs_key, 0, 999)
    
    -- Update metrics
    local metrics_key = "metrics:" .. subdomain
    red:hincrby(metrics_key, "totalRequests", 1)
    red:hincrby(metrics_key, "totalBandwidth", log_entry.bytes)
    red:hset(metrics_key, "lastAccessed", ngx.now() * 1000)
    
    -- Track unique visitors (simple IP-based)
    local visitors_key = "visitors:" .. subdomain .. ":" .. os.date("%Y%m%d")
    red:sadd(visitors_key, ngx.var.remote_addr)
    red:expire(visitors_key, 86400 * 7) -- Keep for 7 days
    
    -- Update unique visitor count
    local visitor_count = red:scard(visitors_key)
    red:hset(metrics_key, "uniqueVisitors", visitor_count)
    
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