--[[
  SpinForge - Open Source Hosting Platform
  Copyright (c) 2025 Jacob Ajiboye
  
  This software is licensed under the MIT License.
  See the LICENSE file in the root directory for details.
--]]
-- SpinForge App Type Detector
-- Detects whether an app should be hosted (static) or proxied (dynamic)

local cjson = require "cjson"

local M = {}

-- Framework configurations
local frameworks = {
    -- Static hosting (served directly by OpenResty)
    static = {
        type = "hosted",
        patterns = {
            "/index.html",
            "/index.htm",
            "/"
        },
        mime_types = {
            [".html"] = "text/html",
            [".css"] = "text/css",
            [".js"] = "application/javascript",
            [".json"] = "application/json",
            [".png"] = "image/png",
            [".jpg"] = "image/jpeg",
            [".svg"] = "image/svg+xml",
            [".ico"] = "image/x-icon",
            [".woff"] = "font/woff",
            [".woff2"] = "font/woff2"
        }
    },
    
    -- React/Vue/Angular (built static files)
    react = {
        type = "hosted",
        build_dir = "build",
        fallback = "/index.html"
    },
    
    vue = {
        type = "hosted", 
        build_dir = "dist",
        fallback = "/index.html"
    },
    
    angular = {
        type = "hosted",
        build_dir = "dist",
        fallback = "/index.html"
    },
    
    -- Next.js can be both static and dynamic
    nextjs = {
        type = "hybrid",
        static_dir = ".next/static",
        public_dir = "public",
        server_port = true, -- Requires Node.js server
        detect = function(build_path)
            -- Check if it's static export or server-side
            local f = io.open(build_path .. "/.next/BUILD_ID", "r")
            if f then
                f:close()
                -- Check for static export
                local export_f = io.open(build_path .. "/out/index.html", "r")
                if export_f then
                    export_f:close()
                    return "hosted", build_path .. "/out"
                end
                return "proxy" -- Server-side Next.js
            end
            return "proxy"
        end
    },
    
    -- Proxy-only frameworks (require backend server)
    express = {
        type = "proxy",
        default_port = 3000
    },
    
    fastify = {
        type = "proxy",
        default_port = 3000
    },
    
    nestjs = {
        type = "proxy",
        default_port = 3000
    },
    
    remix = {
        type = "proxy",
        default_port = 3000
    },
    
    django = {
        type = "proxy",
        default_port = 8000
    },
    
    flask = {
        type = "proxy",
        default_port = 5000
    },
    
    rails = {
        type = "proxy",
        default_port = 3000
    },
    
    -- Remix can also be static with adapter
    ["remix-static"] = {
        type = "hosted",
        build_dir = "public/build",
        fallback = "/index.html"
    }
}

-- Detect app type based on files in build directory
function M.detect_type(build_path, declared_framework)
    local framework_config = frameworks[declared_framework]
    
    if not framework_config then
        -- Try to auto-detect
        return M.auto_detect(build_path)
    end
    
    -- Handle hybrid frameworks
    if framework_config.type == "hybrid" and framework_config.detect then
        local detected_type, static_path = framework_config.detect(build_path)
        return detected_type, static_path
    end
    
    -- Return configured type
    if framework_config.type == "hosted" then
        local static_path = build_path
        if framework_config.build_dir then
            static_path = build_path .. "/" .. framework_config.build_dir
        end
        return "hosted", static_path, framework_config
    end
    
    return "proxy", nil, framework_config
end

-- Auto-detect based on file structure
function M.auto_detect(build_path)
    -- Check for common static site indicators
    local static_indicators = {
        "/index.html",
        "/index.htm",
        "/dist/index.html",
        "/build/index.html",
        "/out/index.html",
        "/public/index.html"
    }
    
    for _, indicator in ipairs(static_indicators) do
        local f = io.open(build_path .. indicator, "r")
        if f then
            f:close()
            local dir = indicator:match("^(.*)/index%.html?$") or ""
            return "hosted", build_path .. dir
        end
    end
    
    -- Check for Node.js indicators
    local node_indicators = {
        "/package.json",
        "/server.js",
        "/index.js",
        "/app.js"
    }
    
    for _, indicator in ipairs(node_indicators) do
        local f = io.open(build_path .. indicator, "r")
        if f then
            f:close()
            return "proxy"
        end
    end
    
    -- Default to static if no clear indicators
    return "hosted", build_path
end

-- Get serving configuration based on app type
function M.get_serving_config(route)
    local app_type, static_path, framework_config = M.detect_type(
        route.buildPath, 
        route.framework
    )
    
    local config = {
        type = app_type,
        framework = route.framework,
        spinletId = route.spinletId,
        customerId = route.customerId
    }
    
    if app_type == "hosted" then
        config.static_root = static_path or route.buildPath
        config.fallback = framework_config and framework_config.fallback or "/index.html"
        config.mime_types = framework_config and framework_config.mime_types or frameworks.static.mime_types
    else
        -- Proxy configuration - spinlet must be running
        config.requires_spinlet = true
        config.default_port = framework_config and framework_config.default_port or 3000
    end
    
    return config
end

return M