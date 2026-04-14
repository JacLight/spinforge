--[[
  SpinForge - Consul upstream resolver
  Copyright (c) 2025 Jacob Ajiboye
  Licensed under the MIT License

  Looks up the current healthy address:port for a site from Consul's
  catalog/health API. Used by router.lua when site.orchestrator == "nomad"
  — the fallback for legacy dockerode-managed sites (which still have a
  hardcoded site.target) lives in router.lua unchanged.

  Consul service names match the NomadService.siteServiceName() shape:
    site-${slug(domain)}

  A tiny lua_shared_dict cache avoids hammering Consul on every request —
  entries live for 5 seconds (short so deploys are reflected fast, long
  enough to absorb a burst of requests on the same domain).
--]]

local cjson = require "cjson.safe"

local _M = {}

-- Shared dict for the upstream cache. Declared in nginx.conf as
--   lua_shared_dict consul_upstreams 10m;
-- If the dict is missing we degrade to an uncached lookup.
local function cache()
  return ngx.shared.consul_upstreams
end

local CACHE_TTL = 5  -- seconds

-- Parse CONSUL_HTTP_ADDR into host+port. Default is the docker gateway
-- where Consul agent lives on this host.
local function parse_consul_addr()
  local raw = os.getenv("CONSUL_HTTP_ADDR") or "http://172.18.0.1:8500"
  local host, port = raw:match("^https?://([^:/]+):?(%d*)")
  if not host then
    host = "172.18.0.1"; port = "8500"
  end
  if port == "" then port = "8500" end
  return host, tonumber(port)
end

local CONSUL_HOST, CONSUL_PORT = parse_consul_addr()

-- slug(domain) → service name. Must match NomadService.siteServiceName.
local function site_service_name(domain)
  if not domain then return nil end
  local s = string.lower(domain)
  s = ngx.re.gsub(s, "[^a-z0-9-]+", "-", "jo")
  s = ngx.re.gsub(s, "-+", "-", "jo")
  s = ngx.re.gsub(s, "^-|-$", "", "jo")
  return "site-" .. s
end

-- Internal: bare HTTP GET with ngx.socket.tcp — avoids needing resty.http
-- (which isn't shipped with the stock OpenResty image). Returns the
-- response body on 2xx or nil on any error.
local function http_get(host, port, path)
  local sock = ngx.socket.tcp()
  sock:settimeouts(1000, 1500, 1500)  -- connect, send, read
  local ok, err = sock:connect(host, port)
  if not ok then
    ngx.log(ngx.ERR, "consul_upstream: connect failed: ", err)
    return nil
  end
  -- Use HTTP/1.0 to avoid Transfer-Encoding: chunked. Our caller is fine
  -- with reading the entire body as a flat blob and we don't want to write
  -- a chunked-decoder for a tiny inline client.
  local req = table.concat({
    "GET " .. path .. " HTTP/1.0",
    "Host: " .. host .. ":" .. port,
    "Connection: close",
    "Accept: application/json",
    "", ""
  }, "\r\n")
  local _, send_err = sock:send(req)
  if send_err then
    ngx.log(ngx.ERR, "consul_upstream: send failed: ", send_err)
    sock:close()
    return nil
  end
  -- Read the status line and headers, then the body
  local status_line, rerr = sock:receive("*l")
  if not status_line then
    ngx.log(ngx.ERR, "consul_upstream: receive status failed: ", rerr)
    sock:close()
    return nil
  end
  local status = tonumber(status_line:match("HTTP/%d%.%d (%d+)"))
  -- Drain headers up to the blank line separator
  while true do
    local line = sock:receive("*l")
    if not line or line == "" then break end
  end
  local body = sock:receive("*a") or ""
  sock:close()
  if status ~= 200 then
    ngx.log(ngx.WARN, "consul_upstream: consul returned ", status, " for ", path)
    return nil
  end
  return body
end

-- Helper: treat empty string, nil, and cjson.null all as "missing"
local function nonempty(v)
  if v == nil then return nil end
  if type(v) == "userdata" then return nil end  -- cjson.null
  if v == "" then return nil end
  return v
end

-- Internal: ask Consul for the list of healthy allocations of a service.
-- Returns { "host:port", ... } or nil on failure.
local function fetch_healthy_endpoints(service_name)
  local path = "/v1/health/service/" .. service_name .. "?passing=true"
  local body = http_get(CONSUL_HOST, CONSUL_PORT, path)
  if not body then return nil end
  local parsed = cjson.decode(body)
  if not parsed then
    ngx.log(ngx.ERR, "consul_upstream: failed to parse Consul JSON for ", service_name)
    return nil
  end
  local endpoints = {}
  for _, entry in ipairs(parsed) do
    local svc = entry.Service or {}
    local host = nonempty(svc.Address) or nonempty((entry.Node or {}).Address)
    local port = svc.Port
    if host and port and port ~= 0 then
      table.insert(endpoints, host .. ":" .. tostring(port))
    end
  end
  return endpoints
end

--[[
  Public: resolve a domain to "host:port" via Consul. Returns nil if no
  healthy allocations exist (caller should 503 or fall through).

  Behaviour:
    * 5-second shared-dict cache keyed by service name
    * Round-robins the healthy endpoints across requests so multiple
      allocations share load without external config
--]]
function _M.resolve(domain)
  if not domain or domain == "" then return nil end
  local svc = site_service_name(domain)
  local dict = cache()

  local cached = dict and dict:get(svc)
  local endpoints
  if cached then
    endpoints = {}
    for ep in string.gmatch(cached, "[^,]+") do
      table.insert(endpoints, ep)
    end
  else
    endpoints = fetch_healthy_endpoints(svc)
    if endpoints and #endpoints > 0 and dict then
      dict:set(svc, table.concat(endpoints, ","), CACHE_TTL)
    end
  end

  if not endpoints or #endpoints == 0 then
    return nil
  end

  -- Per-request round-robin: use the request counter modulo #endpoints so
  -- successive requests spread across allocations.
  local idx = (ngx.var.connection_requests or 0) % #endpoints + 1
  return endpoints[idx]
end

-- Exposed for router.lua to prefix http:// or for tests.
function _M.service_name(domain)
  return site_service_name(domain)
end

return _M
