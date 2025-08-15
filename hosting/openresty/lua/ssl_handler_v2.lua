-- SSL Certificate Handler for SpinForge with Redis caching
-- Version: 3.0.0 - 2025-08-05 - High-performance with Redis caching
local ssl = require "ngx.ssl"
local redis = require "resty.redis"
local utils = require "utils"

-- Get SNI hostname
local server_name = ssl.server_name()
if not server_name then
    ngx.log(ngx.WARN, "SSL: No SNI hostname provided")
    return
end

ngx.log(ngx.INFO, "SSL: Processing certificate for hostname: ", server_name)

-- Connect to Redis
local red = redis:new()
red:set_timeouts(1000, 1000, 1000)

local redis_host = os.getenv("REDIS_HOST") or "spinforge-keydb"
local redis_port = tonumber(os.getenv("REDIS_PORT")) or 16378
local redis_password = os.getenv("REDIS_PASSWORD")
local redis_db = tonumber(os.getenv("REDIS_DB")) or 1

local ok, err = red:connect(redis_host, redis_port)
if not ok then
    ngx.log(ngx.ERR, "SSL: Failed to connect to Redis: ", err)
    return
end

-- Authenticate if password is set
if redis_password and redis_password ~= "" then
    local ok, err = red:auth(redis_password)
    if not ok then
        ngx.log(ngx.ERR, "SSL: Failed to authenticate with Redis: ", err)
        return
    end
end

-- Select database
if redis_db and redis_db ~= 0 then
    local ok, err = red:select(redis_db)
    if not ok then
        ngx.log(ngx.ERR, "SSL: Failed to select Redis database: ", err)
        return
    end
end

-- Check if site has SSL enabled
local site_key = "site:" .. server_name
local site_res, err = red:get(site_key)

if not site_res or site_res == ngx.null then
    -- Check aliases
    local alias_key = "alias:" .. server_name
    local alias_res, err = red:get(alias_key)
    if alias_res and alias_res ~= ngx.null then
        server_name = alias_res
        site_key = "site:" .. server_name
        site_res, err = red:get(site_key)
    end
end

if not site_res or site_res == ngx.null then
    ngx.log(ngx.INFO, "SSL: Site not found in Redis for: ", server_name)
    red:set_keepalive(10000, 100)
    return
end

local cjson = require "cjson"
local site = cjson.decode(site_res)

if not site.ssl_enabled then
    ngx.log(ngx.INFO, "SSL: SSL not enabled for domain: ", server_name)
    red:set_keepalive(10000, 100)
    return
end

-- Check for cached certificate in Redis
local cert_cache_key = "ssl:cert:" .. server_name
local key_cache_key = "ssl:key:" .. server_name

local cert_data = red:get(cert_cache_key)
local key_data = red:get(key_cache_key)

if cert_data == ngx.null or key_data == ngx.null then
    -- Certificate not in cache, try to load from filesystem
    local cert_path = "/etc/letsencrypt/live/" .. server_name .. "/fullchain.pem"
    local key_path = "/etc/letsencrypt/live/" .. server_name .. "/privkey.pem"
    
    -- Try to read certificate files
    local cert_file = io.open(cert_path, "r")
    local key_file = io.open(key_path, "r")
    
    if not cert_file or not key_file then
        ngx.log(ngx.WARN, "SSL: Certificate files not found for: ", server_name)
        red:set_keepalive(10000, 100)
        return
    end
    
    cert_data = cert_file:read("*a")
    cert_file:close()
    
    key_data = key_file:read("*a")
    key_file:close()
    
    -- Cache the certificate in Redis with 1 hour TTL
    red:setex(cert_cache_key, 3600, cert_data)
    red:setex(key_cache_key, 3600, key_data)
    
    ngx.log(ngx.INFO, "SSL: Certificate cached in Redis for: ", server_name)
else
    ngx.log(ngx.INFO, "SSL: Certificate loaded from cache for: ", server_name)
end

-- Return connection to pool
red:set_keepalive(10000, 100)

-- Clear the default certificate
local ok, err = ssl.clear_certs()
if not ok then
    ngx.log(ngx.ERR, "SSL: Failed to clear default cert: ", err)
    return
end

-- Set certificate
local cert_der, err = ssl.cert_pem_to_der(cert_data)
if not cert_der then
    ngx.log(ngx.ERR, "SSL: Failed to convert cert to DER: ", err)
    return
end

ok, err = ssl.set_der_cert(cert_der)
if not ok then
    ngx.log(ngx.ERR, "SSL: Failed to set cert: ", err)
    return
end

-- Set private key
local key_der, err = ssl.priv_key_pem_to_der(key_data)
if not key_der then
    ngx.log(ngx.ERR, "SSL: Failed to convert key to DER: ", err)
    return
end

ok, err = ssl.set_der_priv_key(key_der)
if not ok then
    ngx.log(ngx.ERR, "SSL: Failed to set private key: ", err)
    return
end

ngx.log(ngx.INFO, "SSL: Certificate loaded successfully for: ", server_name)