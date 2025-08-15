--[[
  SpinForge - Container Static IP Mappings
  Maps container names to their static IPs configured in docker-compose.yml
  This is for internal container-to-container communication only
  Copyright (c) 2025 Jacob Ajiboye
  Licensed under the MIT License
--]]

local _M = {}

-- Static IP mappings for SpinForge core services
-- These are configured in docker-compose.yml
_M.container_ips = {
    ["spinforge-keydb"] = {
        ip = "172.18.0.10",
        port = 16378
    },
    ["spinforge-openresty"] = {
        ip = "172.18.0.11",
        ports = {80, 443, 8081}
    },
    ["spinforge-api"] = {
        ip = "172.18.0.12",
        port = 8080
    },
    ["spinforge-certbot"] = {
        ip = "172.18.0.13"
    },
    ["spinforge-admin-ui"] = {
        ip = "172.18.0.14",
        port = 80
    },
    ["spinforge-website"] = {
        ip = "172.18.0.15",
        port = 3000
    }
}

-- Function to get static IP for a container
function _M.get_container_ip(container_name)
    local config = _M.container_ips[container_name]
    if config then
        return config.ip, config.port or config.ports
    end
    return nil, nil
end

return _M