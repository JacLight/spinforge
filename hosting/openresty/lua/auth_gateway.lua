-- SpinForge API Gateway Authentication Module
-- High-performance authentication with zero impact on non-protected routes

local redis = require "resty.redis"
local cjson = require "cjson"
local resty_sha256 = require "resty.sha256"
local str = require "resty.string"

-- Configuration
local REDIS_HOST = os.getenv("REDIS_HOST") or "spinforge-keydb"
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
        -- Default to no auth if Redis is down
        -- Also cache this to avoid repeated connection attempts
        auth_cache:set(cache_key, "0", 10) -- Short TTL for error case
        return false
    end
    
    local enabled, err = red:get("auth:" .. domain .. ":enabled")
    return_redis_connection(red)
    
    if err then
        ngx.log(ngx.ERR, "Failed to check auth enabled: ", err)
        auth_cache:set(cache_key, "0", 10) -- Short TTL for error case
        return false
    end
    
    -- Cache the result
    local is_enabled = enabled == "1"
    -- Use different TTLs: longer for "no auth" since it changes less frequently
    local ttl = is_enabled and CACHE_TTL or 300 -- 1 minute for enabled, 5 minutes for disabled
    auth_cache:set(cache_key, is_enabled and "1" or "0", ttl)
    
    return is_enabled
end

-- Get routes for domain (with caching) - Updated for route-based auth
local function get_routes(domain)
    local cache_key = "routes:" .. domain
    local cached = auth_cache:get(cache_key)
    
    if cached then
        return cjson.decode(cached)
    end
    
    local red, err = get_redis_connection()
    if not red then
        return nil
    end
    
    -- Check both new routes format and legacy paths format
    local routes_json, err = red:get("auth:" .. domain .. ":routes")
    if not routes_json or routes_json == ngx.null then
        -- Fallback to legacy paths format for backward compatibility
        routes_json, err = red:get("auth:" .. domain .. ":paths")
    end
    
    return_redis_connection(red)
    
    if err or not routes_json or routes_json == ngx.null then
        return nil
    end
    
    local routes = cjson.decode(routes_json)
    
    -- Cache for 60 seconds
    auth_cache:set(cache_key, routes_json, CACHE_TTL)
    
    return routes
end

-- Legacy alias
local get_path_rules = get_routes

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

-- Handle custom auth callback
local function handle_custom_auth_callback()
    local args = ngx.req.get_uri_args()
    local return_url = args.return_url
    local auth_token = args.token or args.auth_token
    
    -- Get cookies from query params (if auth service passes them)
    local cookies_to_set = {}
    
    -- Check for user data in query params
    for key, value in pairs(args) do
        if key ~= "return_url" and key ~= "token" and key ~= "auth_token" then
            -- Set as cookie (auth service should pass user data)
            table.insert(cookies_to_set, key .. "=" .. ngx.escape_uri(value) .. "; Path=/; HttpOnly; SameSite=Lax")
        end
    end
    
    -- Set auth session cookie if token provided
    if auth_token then
        table.insert(cookies_to_set, "auth_token=" .. auth_token .. "; Path=/; HttpOnly; SameSite=Lax")
    end
    
    -- Set all cookies
    if #cookies_to_set > 0 then
        ngx.header["Set-Cookie"] = cookies_to_set
    end
    
    -- Redirect to original URL or homepage
    ngx.redirect(return_url or "/")
end

-- Main authentication handler
local function authenticate()
    local host = ngx.var.host
    local path = ngx.var.uri
    
    ngx.log(ngx.INFO, "Auth: Checking auth for domain: ", host, " path: ", path)
    
    -- Special handling for OAuth callback
    if path == "/_oauth/callback" then
        return handle_oauth_callback()
    end
    
    -- Special handling for custom auth callback
    if path == "/_auth/callback" then
        return handle_custom_auth_callback()
    end
    
    -- Quick check: is auth enabled for this domain?
    local auth_enabled = is_auth_enabled(host)
    
    ngx.log(ngx.INFO, "Auth: Auth enabled for ", host, ": ", auth_enabled and "yes" or "no")
    
    -- Set quick check cache for router to use (5 minute TTL for negative results)
    -- This prevents the router from even calling authenticate() for domains without auth
    local quick_check_key = "quick:" .. host
    if not auth_enabled then
        auth_cache:set(quick_check_key, "0", 300) -- Cache "no auth" for 5 minutes
        return -- No auth configured, pass through
    else
        auth_cache:set(quick_check_key, "1", 60) -- Cache "has auth" for 1 minute
    end
    
    -- Check if cache needs invalidation
    local red, err = get_redis_connection()
    if red then
        local invalid, err = red:get("auth:" .. host .. ":cache_invalid")
        if invalid == "1" then
            -- Clear cache for this domain
            auth_cache:delete("enabled:" .. host)
            auth_cache:delete("routes:" .. host)
            auth_cache:delete("paths:" .. host) -- Also clear old cache key
            red:del("auth:" .. host .. ":cache_invalid")
        end
        return_redis_connection(red)
    end
    
    -- Get routes (updated for route-based auth)
    local routes = get_routes(host)
    ngx.log(ngx.INFO, "Auth: Found ", routes and #routes or 0, " routes for ", host)
    
    if not routes or #routes == 0 then
        return -- No routes configured
    end
    
    -- Find matching route for current path
    local route = find_matching_rule(path, routes)
    if not route then
        ngx.log(ngx.INFO, "Auth: No matching route found for path: ", path)
        return -- Path not protected
    end
    
    ngx.log(ngx.INFO, "Auth: Found matching route for path: ", path, " auth type: ", route.authType)
    
    -- Check rate limit first (before auth)
    if route.rateLimit and not check_rate_limit(host, path, route) then
        ngx.status = ngx.HTTP_TOO_MANY_REQUESTS
        ngx.header["Retry-After"] = "60"
        ngx.say('{"error": "Rate limit exceeded"}')
        return ngx.exit(ngx.HTTP_TOO_MANY_REQUESTS)
    end
    
    -- Check authentication based on route type
    local authenticated = false
    
    if route.authType == "none" then
        authenticated = true
        ngx.log(ngx.INFO, "Auth: No auth required for this route")
    elseif route.authType == "apiKey" then
        -- Check for API key in header or query param
        local key = ngx.req.get_headers()["X-API-Key"] or
                   ngx.req.get_headers()["Authorization"] or
                   ngx.var.arg_api_key
        
        if key and key:sub(1, 7) == "Bearer " then
            key = key:sub(8)
        end
        
        authenticated = validate_api_key(host, key)
    elseif route.authType == "oauth" then
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
    elseif route.authType == "custom" then
        -- SMART AUTH: Automatically check query, headers, and cookies for auth tokens
        local config = route.customAuthConfig or {}
        -- Don't redeclare authenticated - use the outer scope variable
        local auth_data = {}
        
        ngx.log(ngx.INFO, "Auth: Custom auth check for ", host, " path: ", path)
        
        -- Helper function for case-insensitive key lookup
        local function find_key_ci(tbl, key)
            if not tbl or not key then return nil end
            -- First try exact match
            if tbl[key] then return tbl[key] end
            -- Then try case-insensitive match
            local lower_key = key:lower()
            for k, v in pairs(tbl) do
                if k:lower() == lower_key then
                    return v
                end
            end
            return nil
        end
        
        -- 1. FIRST CHECK COOKIES (for subsequent requests after initial auth)
        local token_cookie_name = (config.tokenCookieName or "auth_token"):gsub("-", "_")
        local cookie_var = "cookie_" .. token_cookie_name
        local auth_cookie = ngx.var[cookie_var]
        
        ngx.log(ngx.INFO, "Auth: Checking cookie '", token_cookie_name, "' (var: ", cookie_var, ") = ", auth_cookie or "NOT FOUND")
        
        -- Try direct cookie access as fallback
        if not auth_cookie then
            local cookie_header = ngx.var.http_cookie
            if cookie_header then
                for cookie in cookie_header:gmatch("([^;]+)") do
                    local name, value = cookie:match("^%s*([^=]+)=(.+)%s*$")
                    if name == token_cookie_name then
                        auth_cookie = value
                        ngx.log(ngx.INFO, "Auth: Found cookie via direct parsing: ", name, " = ", value)
                        break
                    end
                end
            end
        end
        
        if auth_cookie and auth_cookie ~= "" then
            authenticated = true
            ngx.log(ngx.INFO, "Auth: ✓ Authenticated via cookie: ", token_cookie_name)
        else
            -- Check mapped cookies
            if config.responseMappings then
                for _, mapping in ipairs(config.responseMappings) do
                    if mapping.cookieName then
                        local cookie_name = mapping.cookieName:gsub("-", "_")
                        local cookie_value = ngx.var["cookie_" .. cookie_name]
                        if cookie_value and cookie_value ~= "" then
                            authenticated = true
                            ngx.log(ngx.INFO, "Auth: ✓ Authenticated via mapped cookie: ", cookie_name)
                            break
                        end
                    end
                end
            end
        end
        
        -- 2. IF NOT AUTHENTICATED BY COOKIE, CHECK QUERY PARAMS (for auth service redirects)
        local args = ngx.req.get_uri_args()
        local found_in_query = false
        
        -- Only check query params if not already authenticated by cookie
        if not authenticated then
        
            -- Check for configured token parameter
            local token_param = config.tokenLocation and config.tokenLocation.paramName
            if token_param then
                local token_value = find_key_ci(args, token_param)
                if token_value then
                    found_in_query = true
                    auth_data["auth_token"] = token_value
                    ngx.log(ngx.INFO, "Auth: Found token in query param: ", token_param)
                end
            end
            
            -- Check for ALL configured response mappings (these define what to extract)
            if config.responseMappings then
                for _, mapping in ipairs(config.responseMappings) do
                    local value = find_key_ci(args, mapping.responsePath)
                    if value then
                        found_in_query = true
                        auth_data[mapping.responsePath] = value
                        
                        -- If this mapping is marked as the token, store it
                        if mapping.isToken or mapping.responsePath == (token_param or "") then
                            auth_data["auth_token"] = value
                        end
                    end
                end
            end
            
            -- If tokens found in query, set cookies and redirect to clean URL
            if found_in_query then
                local cookies_to_set = {}
                
                -- Set auth token cookie (already defined above)
                if auth_data["auth_token"] then
                    table.insert(cookies_to_set, token_cookie_name .. "=" .. ngx.escape_uri(auth_data["auth_token"]) .. "; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400")
                end
                
                -- Set mapped cookies
                if config.responseMappings then
                    for _, mapping in ipairs(config.responseMappings) do
                        if auth_data[mapping.responsePath] and mapping.cookieName then
                            local safe_cookie_name = mapping.cookieName:gsub("-", "_")
                            table.insert(cookies_to_set, safe_cookie_name .. "=" .. ngx.escape_uri(auth_data[mapping.responsePath]) .. "; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400")
                        end
                    end
                end
                
                ngx.header["Set-Cookie"] = cookies_to_set
                ngx.log(ngx.INFO, "Auth: Found tokens in query, setting cookies and redirecting")
                ngx.redirect(ngx.var.scheme .. "://" .. host .. path)
                return
            end
        end  -- End of "if not authenticated" block for query params
        
        -- 3. CHECK HEADERS (for API requests)
        if not authenticated and not found_in_query then
            local headers = ngx.req.get_headers()
            
            -- Check for configured header
            local header_name = config.tokenLocation and config.tokenLocation.headerName
            if header_name then
                local auth_header = find_key_ci(headers, header_name)
                if auth_header then
                    -- Remove prefix if configured
                    local prefix = config.tokenLocation.headerPrefix
                    if prefix and prefix ~= "" then
                        local prefix_len = #prefix
                        if auth_header:sub(1, prefix_len):lower() == prefix:lower() then
                            auth_header = auth_header:sub(prefix_len + 1):gsub("^%s+", "")
                        end
                    end
                    authenticated = true
                    ngx.log(ngx.INFO, "Auth: Authenticated via header: ", header_name)
                end
            end
            
            -- Also check response mappings for headers
            if not authenticated and config.responseMappings then
                for _, mapping in ipairs(config.responseMappings) do
                    local value = find_key_ci(headers, mapping.responsePath)
                    if value then
                        authenticated = true
                        break
                    end
                end
            end
        end
        
        -- All cookie checking has been moved to the beginning
        
        -- If still not authenticated, redirect to auth URL
        if not authenticated then
            -- Build redirect URL with return parameter - use only path to avoid double encoding
            local auth_url = config.authUrl or route.unauthorizedRedirect
            local current_url = ngx.var.scheme .. "://" .. host .. path
            local separator = auth_url:find("?") and "&" or "?"
            
            -- Encode the return URL
            local return_url = ngx.escape_uri(current_url)
            
            -- Redirect with return_url parameter
            local redirect_url = auth_url .. separator .. "return_url=" .. return_url
            
            ngx.log(ngx.INFO, "Auth: Not authenticated, redirecting to: ", redirect_url)
            ngx.redirect(redirect_url)
            return
        else
            ngx.log(ngx.INFO, "Auth: Successfully authenticated via custom auth")
        end
    elseif route.authType == "basic" then
        -- Check HTTP Basic Auth
        local auth_header = ngx.req.get_headers()["Authorization"]
        if auth_header and auth_header:sub(1, 6) == "Basic " then
            -- Decode and validate (simplified)
            authenticated = true
        end
    end
    
    -- Handle authentication failure
    if not authenticated then
        if route.unauthorizedRedirect then
            return ngx.redirect(route.unauthorizedRedirect)
        else
            -- Return error response
            ngx.status = ngx.HTTP_UNAUTHORIZED
            ngx.header["Content-Type"] = "application/json"
            
            ngx.say('{"error": "Unauthorized"}')
            return ngx.exit(ngx.HTTP_UNAUTHORIZED)
        end
    end
    
    -- Authentication successful, continue to backend
end

-- Export module
return {
    authenticate = authenticate
}