-- SSL Certificate Handler for SpinForge
-- Version: 2.0.0 - 2025-08-03 - Simplified ssl_enabled only
local ssl = require "ngx.ssl"
local redis = require "resty.redis"

-- Get SNI hostname
local server_name = ssl.server_name()
if not server_name then
    ngx.log(ngx.WARN, "SSL: No SNI hostname provided")
    return
end

ngx.log(ngx.INFO, "SSL: Processing certificate for hostname: ", server_name)

-- Connect to Redis to check if domain has SSL enabled
local red = redis:new()
red:set_timeouts(1000, 1000, 1000)

local ok, err = red:connect(redis_host or "keydb", redis_port or 16378)
if not ok then
    ngx.log(ngx.ERR, "SSL: Failed to connect to Redis: ", err)
    return
end

-- Check if this domain has SSL enabled
local site_key = "site:" .. server_name
local res, err = red:get(site_key)

local ssl_enabled = false
local cert_path, key_path

if res and res ~= ngx.null then
    local cjson = require "cjson"
    local site = cjson.decode(res)
    ssl_enabled = site.ssl_enabled or false
    ngx.log(ngx.INFO, "SSL: Site found, ssl_enabled = ", tostring(ssl_enabled))
else
    -- Check if it's an alias
    local alias_key = "alias:" .. server_name
    res, err = red:get(alias_key)
    if res and res ~= ngx.null then
        -- Get the main domain and check its SSL status
        site_key = "site:" .. res
        local site_res, err = red:get(site_key)
        if site_res and site_res ~= ngx.null then
            local cjson = require "cjson"
            local site = cjson.decode(site_res)
            ssl_enabled = site.ssl_enabled or false
            
            if ssl_enabled then
                -- Use the main domain's certificate
                server_name = res
                ngx.log(ngx.INFO, "SSL: Alias found, using main domain: ", server_name)
            end
        end
    else
        ngx.log(ngx.INFO, "SSL: Site not found in Redis for: ", server_name)
    end
end

red:close()

if not ssl_enabled then
    ngx.log(ngx.INFO, "SSL: SSL not enabled for domain: ", server_name)
    return
end

-- Check if certificate exists
cert_path = "/etc/letsencrypt/live/" .. server_name .. "/fullchain.pem"
key_path = "/etc/letsencrypt/live/" .. server_name .. "/privkey.pem"

-- Try to open certificate file
local f = io.open(cert_path, "r")
if not f then
    ngx.log(ngx.WARN, "SSL: No certificate found at: ", cert_path)
    return
end
f:close()

-- Read certificate and key
local cert_file = io.open(cert_path, "r")
local cert_data = cert_file:read("*a")
cert_file:close()

local key_file = io.open(key_path, "r")
local key_data = key_file:read("*a")
key_file:close()

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