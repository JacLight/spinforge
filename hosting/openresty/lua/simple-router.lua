--[[
  SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
  Copyright (c) 2025 Jacob Ajiboye
  
  This software is licensed under the MIT License.
  See the LICENSE file in the root directory for details.
--]]
-- Simple router for testing
local host = ngx.var.host:lower()
local subdomain = host:match("^([^.]+)")

ngx.log(ngx.INFO, "Host: ", host, " Subdomain: ", subdomain)

-- For any test-* subdomain, serve static files
if subdomain and subdomain:match("^test%-") then
    ngx.var.target_root = "/var/www/static/" .. subdomain
    ngx.var.route_type = "static"
    ngx.log(ngx.INFO, "Serving static site: ", subdomain)
else
    ngx.var.route_type = ""
    ngx.log(ngx.INFO, "Unknown subdomain: ", subdomain or "none")
end