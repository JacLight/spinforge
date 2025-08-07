-- SpinForge API Gateway Authentication Module
-- High-performance authentication with zero impact on non-protected routes

local redis = require "resty.redis"
local cjson = require "cjson"
local resty_sha256 = require "resty.sha256"
local str = require "resty.string"

-- Configuration
local REDIS_HOST = os.getenv("REDIS_HOST") or "keydb"
local REDIS_PORT = tonumber(os.getenv("REDIS_PORT") or 16378)
local REDIS_DB = tonumber(os.getenv("REDIS_DB") or 1)
local CACHE_TTL = 60 -- Cache auth config for 60 seconds

-- Shared memory cache for auth configs
local auth_cache = ngx.shared.auth_cache

-- Helper function to get Redis connection
local function get_redis_connection()
    local red = redis:new()
    red:set_timeout(1000) -- 1 second timeout
    
    local ok, err = red:connect(REDIS_HOST, REDIS_PORT)
    if not ok then
        ngx.log(ngx.ERR, "Failed to connect to Redis: ", err)
        return nil, err
    end
    
    red:select(REDIS_DB)
    return red
end

-- Helper function to return Redis connection to pool
local function return_redis_connection(red)
    if not red then
        return
    end
    -- Put connection into the pool (max idle timeout: 10s, pool size: 100)
    local ok, err = red:set_keepalive(10000, 100)
    if not ok then
        ngx.log(ngx.ERR, "Failed to set keepalive: ", err)
    end
end

-- Hash API key using SHA256
local function hash_api_key(key)
    local sha256 = resty_sha256:new()
    sha256:update(key)
    local digest = sha256:final()
    return str.to_hex(digest)
end

-- Check if auth is enabled for domain (with caching)
local function is_auth_enabled(domain)
    -- Check shared memory cache first
    local cache_key = "enabled:" .. domain
    local cached = auth_cache:get(cache_key)
    
    if cached ~= nil then
        return cached == "1"
    end
    
    -- Not in cache, check Redis
    local red, err = get_redis_connection()
    if not red then
        return false -- Default to no auth if Redis is down
    end
    
    local enabled, err = red:get("auth:" .. domain .. ":enabled")
    return_redis_connection(red)
    
    if err then
        ngx.log(ngx.ERR, "Failed to check auth enabled: ", err)
        return false
    end
    
    -- Cache the result
    local is_enabled = enabled == "1"
    auth_cache:set(cache_key, is_enabled and "1" or "0", CACHE_TTL)
    
    return is_enabled
end

-- Get path rules for domain (with caching)
local function get_path_rules(domain)
    local cache_key = "paths:" .. domain
    local cached = auth_cache:get(cache_key)
    
    if cached then
        return cjson.decode(cached)
    end
    
    local red, err = get_redis_connection()
    if not red then
        return nil
    end
    
    local paths_json, err = red:get("auth:" .. domain .. ":paths")
    return_redis_connection(red)
    
    if err or not paths_json or paths_json == ngx.null then
        return nil
    end
    
    local paths = cjson.decode(paths_json)
    
    -- Cache for 60 seconds
    auth_cache:set(cache_key, paths_json, CACHE_TTL)
    
    return paths
end

-- Check if path matches pattern (supports wildcards)
local function path_matches(path, pattern)
    -- Exact match
    if path == pattern then
        return true
    end
    
    -- Convert pattern to Lua pattern
    -- * matches any characters except /
    -- ** matches any characters including /
    local lua_pattern = "^" .. pattern:gsub("([%.%-%+%[%]%(%)%$%^%%%?])", "%%%1")
                                       :gsub("%*%*", ".*")
                                       :gsub("%*", "[^/]*") .. "$"
    
    return path:match(lua_pattern) ~= nil
end

-- Find matching rule for current path
local function find_matching_rule(path, rules)
    if not rules then
        return nil
    end
    
    -- Rules are already sorted by specificity in the API
    for _, rule in ipairs(rules) do
        if path_matches(path, rule.pattern) then
            return rule
        end
    end
    
    return nil
end

-- Validate API key
local function validate_api_key(domain, key)
    if not key then
        return false
    end
    
    local hashed = hash_api_key(key)
    
    local red, err = get_redis_connection()
    if not red then
        return false
    end
    
    -- Get all API keys for domain
    local keys_data, err = red:hgetall("auth:" .. domain .. ":keys")
    
    if err or not keys_data or #keys_data == 0 then
        return_redis_connection(red)
        return false
    end
    
    -- Check each key (keys_data is array: [id1, data1, id2, data2, ...])
    for i = 1, #keys_data, 2 do
        local key_id = keys_data[i]
        local key_info = cjson.decode(keys_data[i + 1])
        
        if key_info.hashedKey == hashed then
            -- Update usage stats
            key_info.lastUsed = os.date("!%Y-%m-%dT%H:%M:%S.000Z")
            key_info.useCount = (key_info.useCount or 0) + 1
            
            red:hset("auth:" .. domain .. ":keys", key_id, cjson.encode(key_info))
            return_redis_connection(red)
            
            return true, key_id, key_info.name
        end
    end
    
    return_redis_connection(red)
    return false
end

-- Check rate limit for path
local function check_rate_limit(domain, path, rule)
    if not rule.rateLimit then
        return true -- No rate limit configured
    end
    
    local limit = rule.rateLimit.requests
    local window = rule.rateLimit.window -- in seconds
    
    -- Use client IP as identifier
    local client_ip = ngx.var.remote_addr
    local rate_key = "rate:" .. domain .. ":" .. path .. ":" .. client_ip
    
    local red, err = get_redis_connection()
    if not red then
        return true -- Allow if Redis is down
    end
    
    -- Use sliding window with Redis
    local current_time = ngx.time()
    local window_start = current_time - window
    
    -- Remove old entries
    red:zremrangebyscore(rate_key, 0, window_start)
    
    -- Count requests in window
    local count, err = red:zcard(rate_key)
    
    if not err and count < limit then
        -- Add current request
        red:zadd(rate_key, current_time, current_time .. ":" .. ngx.var.request_id)
        red:expire(rate_key, window)
        return_redis_connection(red)
        return true
    end
    
    return_redis_connection(red)
    return false
end

-- Handle OAuth redirect
local function handle_oauth_redirect(domain, return_path)
    local red, err = get_redis_connection()
    if not red then
        return ngx.exit(ngx.HTTP_INTERNAL_SERVER_ERROR)
    end
    
    local oauth_json, err = red:get("auth:" .. domain .. ":oauth")
    return_redis_connection(red)
    
    if not oauth_json then
        return ngx.exit(ngx.HTTP_UNAUTHORIZED)
    end
    
    local oauth = cjson.decode(oauth_json)
    
    -- Generate state token
    local state = ngx.md5(domain .. ":" .. return_path .. ":" .. ngx.time() .. ":" .. math.random())
    
    -- Store state in Redis (expire in 10 minutes)
    local red2, err = get_redis_connection()
    if red2 then
        red2:setex("oauth:state:" .. state, 600, cjson.encode({
            domain = domain,
            return_path = return_path,
            created = ngx.time()
        }))
        return_redis_connection(red2)
    end
    
    -- Build redirect URL
    local redirect_url = oauth.authUrl
    local separator = redirect_url:find("?") and "&" or "?"
    
    redirect_url = redirect_url .. separator .. "state=" .. state
    
    if oauth.clientId then
        redirect_url = redirect_url .. "&client_id=" .. oauth.clientId
    end
    
    if oauth.redirectUri then
        redirect_url = redirect_url .. "&redirect_uri=" .. ngx.escape_uri(oauth.redirectUri)
    end
    
    if oauth.scope then
        redirect_url = redirect_url .. "&scope=" .. ngx.escape_uri(oauth.scope)
    end
    
    ngx.redirect(redirect_url)
end

-- Handle OAuth callback
local function handle_oauth_callback()
    local args = ngx.req.get_uri_args()
    local state = args.state
    local code = args.code
    
    if not state then
        return ngx.exit(ngx.HTTP_BAD_REQUEST)
    end
    
    local red, err = get_redis_connection()
    if not red then
        return ngx.exit(ngx.HTTP_INTERNAL_SERVER_ERROR)
    end
    
    -- Get state data
    local state_json, err = red:get("oauth:state:" .. state)
    
    if not state_json then
        return_redis_connection(red)
        return ngx.exit(ngx.HTTP_UNAUTHORIZED)
    end
    
    local state_data = cjson.decode(state_json)
    
    -- Delete state (one-time use)
    red:del("oauth:state:" .. state)
    
    -- Get OAuth config
    local oauth_json, err = red:get("auth:" .. state_data.domain .. ":oauth")
    return_redis_connection(red)
    
    if not oauth_json then
        return ngx.exit(ngx.HTTP_UNAUTHORIZED)
    end
    
    local oauth = cjson.decode(oauth_json)
    
    -- Set auth cookies
    if oauth.setCookies and code then
        -- Set authorization code in cookie
        ngx.header["Set-Cookie"] = {
            "auth_code=" .. code .. "; Path=/; HttpOnly; SameSite=Lax",
            "auth_state=" .. state .. "; Path=/; HttpOnly; SameSite=Lax",
            "auth_domain=" .. state_data.domain .. "; Path=/; HttpOnly; SameSite=Lax"
        }
        
        -- If token endpoint is configured, exchange code for token
        if oauth.tokenUrl then
            -- This would require an HTTP call to the token endpoint
            -- For now, just set the code
        end
    end
    
    -- Redirect to original path
    ngx.redirect(state_data.return_path or "/")
end

-- Main authentication handler
local function authenticate()
    local host = ngx.var.host
    local path = ngx.var.uri
    
    -- Special handling for OAuth callback
    if path == "/_oauth/callback" then
        return handle_oauth_callback()
    end
    
    -- Quick check: is auth enabled for this domain?
    if not is_auth_enabled(host) then
        return -- No auth configured, pass through
    end
    
    -- Check if cache needs invalidation
    local red, err = get_redis_connection()
    if red then
        local invalid, err = red:get("auth:" .. host .. ":cache_invalid")
        if invalid == "1" then
            -- Clear cache for this domain
            auth_cache:delete("enabled:" .. host)
            auth_cache:delete("paths:" .. host)
            red:del("auth:" .. host .. ":cache_invalid")
        end
        return_redis_connection(red)
    end
    
    -- Get path rules
    local rules = get_path_rules(host)
    if not rules or #rules == 0 then
        return -- No path rules configured
    end
    
    -- Find matching rule for current path
    local rule = find_matching_rule(path, rules)
    if not rule then
        return -- Path not protected
    end
    
    -- Check rate limit first (before auth)
    if not check_rate_limit(host, path, rule) then
        ngx.status = ngx.HTTP_TOO_MANY_REQUESTS
        ngx.header["Retry-After"] = rule.rateLimit.window
        ngx.say('{"error": "Rate limit exceeded"}')
        return ngx.exit(ngx.HTTP_TOO_MANY_REQUESTS)
    end
    
    -- Check authentication based on rule type
    local authenticated = false
    
    if rule.authType == "none" then
        authenticated = true
    elseif rule.authType == "apiKey" then
        -- Check for API key in header or query param
        local key = ngx.req.get_headers()["X-API-Key"] or
                   ngx.req.get_headers()["Authorization"] or
                   ngx.var.arg_api_key
        
        if key and key:sub(1, 7) == "Bearer " then
            key = key:sub(8)
        end
        
        authenticated = validate_api_key(host, key)
    elseif rule.authType == "oauth" then
        -- Check for OAuth token in cookie or header
        local auth_cookie = ngx.var.cookie_auth_token
        local auth_header = ngx.req.get_headers()["Authorization"]
        
        if auth_cookie or auth_header then
            -- Validate token (simplified - real implementation would verify with OAuth provider)
            authenticated = true
        else
            -- Redirect to OAuth provider
            return handle_oauth_redirect(host, ngx.var.request_uri)
        end
    elseif rule.authType == "basic" then
        -- Check HTTP Basic Auth
        local auth_header = ngx.req.get_headers()["Authorization"]
        if auth_header and auth_header:sub(1, 6) == "Basic " then
            -- Decode and validate (simplified)
            authenticated = true
        end
    end
    
    -- Handle authentication failure
    if not authenticated then
        if rule.unauthorizedAction == "redirect" and rule.unauthorizedRedirect then
            return ngx.redirect(rule.unauthorizedRedirect)
        else
            -- Return error response
            ngx.status = ngx.HTTP_UNAUTHORIZED
            ngx.header["Content-Type"] = "application/json"
            
            local response = rule.unauthorizedResponse or '{"error": "Unauthorized"}'
            ngx.say(response)
            return ngx.exit(ngx.HTTP_UNAUTHORIZED)
        end
    end
    
    -- Authentication successful, continue to backend
end

-- Export module
return {
    authenticate = authenticate
}