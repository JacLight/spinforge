--[[
  SpinForge DNS Resolver with Retry and Fallback
  Provides reliable DNS resolution for internal services
--]]

local _M = {}

-- DNS resolution cache
local dns_cache = {}
local cache_ttl = 60  -- Cache for 60 seconds

-- Known internal services with multiple resolution methods
local internal_services = {
    ["admin-ui"] = {
        "spinforge-admin-ui",
        "admin-ui", 
        "spinforge_admin-ui_1"
    },
    ["website"] = {
        "spinforge-website",
        "website",
        "spinforge_website_1"
    },
    ["api"] = {
        "spinforge-api",
        "api",
        "spinforge_api_1"
    },
    ["keydb"] = {
        "spinforge-keydb",
        "keydb",
        "spinforge_keydb_1"
    },
    ["openresty"] = {
        "spinforge-openresty",
        "openresty",
        "spinforge_openresty_1"
    },
    ["mcp-server"] = {
        "spinforge-mcp",
        "mcp-server",
        "spinforge_mcp-server_1"
    }
}

-- Try to resolve a hostname with retries
function _M.resolve_with_retry(hostname, max_retries)
    max_retries = max_retries or 3
    
    -- Check cache first
    local cache_key = hostname
    local cached = dns_cache[cache_key]
    if cached and cached.expires > ngx.now() then
        ngx.log(ngx.DEBUG, "DNS cache hit for: ", hostname, " -> ", cached.ip)
        return cached.ip
    end
    
    -- Try to resolve with retries
    local resolver = require "resty.dns.resolver"
    
    for attempt = 1, max_retries do
        local r, err = resolver:new{
            nameservers = {"127.0.0.11", "8.8.8.8"},  -- Docker DNS first, then Google
            retrans = 2,  -- Number of retransmissions
            timeout = 2000,  -- 2 second timeout
        }
        
        if not r then
            ngx.log(ngx.ERR, "Failed to instantiate resolver: ", err)
            if attempt < max_retries then
                ngx.sleep(0.1 * attempt)  -- Exponential backoff
            end
        else
            local answers, err = r:query(hostname, { qtype = r.TYPE_A })
            if answers then
                for i, ans in ipairs(answers) do
                    if ans.address then
                        -- Cache the result
                        dns_cache[cache_key] = {
                            ip = ans.address,
                            expires = ngx.now() + cache_ttl
                        }
                        ngx.log(ngx.INFO, "DNS resolved: ", hostname, " -> ", ans.address)
                        return ans.address
                    end
                end
            else
                ngx.log(ngx.WARN, "DNS query failed for ", hostname, ": ", err)
                if attempt < max_retries then
                    ngx.sleep(0.1 * attempt)
                end
            end
        end
    end
    
    return nil
end

-- Get the best hostname for a service
function _M.get_service_hostname(service_name)
    -- Check if it's a known internal service
    local variants = internal_services[service_name]
    if variants then
        -- Try each variant
        for _, hostname in ipairs(variants) do
            local ip = _M.resolve_with_retry(hostname, 2)
            if ip then
                return hostname, ip
            end
        end
    end
    
    -- Try the name as-is
    local ip = _M.resolve_with_retry(service_name, 3)
    if ip then
        return service_name, ip
    end
    
    return nil, nil
end

-- Parse target URL and resolve hostname
function _M.resolve_target(target)
    if not target then
        return target
    end
    
    -- Parse the URL
    local protocol, hostname, port, path = target:match("^(https?)://([^:/]+):?(%d*)(.*)$")
    if not protocol or not hostname then
        return target
    end
    
    -- Default ports
    if port == "" then
        port = (protocol == "https") and "443" or "80"
    end
    
    -- Try to get IP for hostname
    local resolved_host, ip = _M.get_service_hostname(hostname)
    
    if ip then
        -- Return URL with IP address
        local resolved_target = protocol .. "://" .. ip .. ":" .. port .. (path or "")
        ngx.log(ngx.INFO, "Resolved target: ", target, " -> ", resolved_target)
        return resolved_target
    else
        ngx.log(ngx.WARN, "Could not resolve hostname: ", hostname, ", using original target")
        return target
    end
end

return _M