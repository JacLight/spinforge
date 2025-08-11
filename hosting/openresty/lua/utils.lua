-- Shared utilities for SpinForge OpenResty
local _M = {}

-- Convert domain name to filesystem-friendly format
-- Replaces dots with underscores for folder names
function _M.domain_to_folder(domain)
    return domain:gsub("%.", "_")
end

-- Convert folder name back to domain format
-- Replaces underscores with dots
function _M.folder_to_domain(folder)
    return folder:gsub("_", ".")
end

-- Get all possible certificate paths for a domain
-- Returns a table of paths to check in order
function _M.get_cert_paths(domain)
    local paths = {}
    
    -- First try with the actual domain name (standard Let's Encrypt path)
    table.insert(paths, {
        cert = "/etc/letsencrypt/live/" .. domain .. "/fullchain.pem",
        key = "/etc/letsencrypt/live/" .. domain .. "/privkey.pem",
        name = domain
    })
    
    -- Then try with underscores (in case cert was generated with folder name)
    local folder_name = _M.domain_to_folder(domain)
    if folder_name ~= domain then
        table.insert(paths, {
            cert = "/etc/letsencrypt/live/" .. folder_name .. "/fullchain.pem",
            key = "/etc/letsencrypt/live/" .. folder_name .. "/privkey.pem",
            name = folder_name
        })
    end
    
    return paths
end

return _M