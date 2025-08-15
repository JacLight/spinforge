/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Version: 2.0.0 - 2025-08-03 - Simplified ssl_enabled only (no nested ssl object)
 */
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const multer = require("multer");
const AdmZip = require("adm-zip");
const tar = require("tar");
const redisClient = require("../utils/redis");
const { execAsync } = require("../utils/docker");
const { STATIC_ROOT, UPLOADS_ROOT } = require("../utils/constants");
const { checkStaticFiles } = require("../utils/site-helpers");
const { addRouteAuth } = require("../route-helper/auth-gateway-helper");

// Configure upload directory
const UPLOAD_TEMP_DIR = UPLOADS_ROOT;

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
  fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  dest: UPLOAD_TEMP_DIR,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.zip', '.tar', '.tar.gz', '.tgz'];
    const allowedMimes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-tar',
      'application/gzip',
      'application/x-gzip',
      'application/x-compressed-tar'
    ];
    
    const hasValidExt = allowedExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext));
    const hasValidMime = allowedMimes.includes(file.mimetype);
    
    if (hasValidExt || hasValidMime) {
      cb(null, true);
    } else {
      cb(new Error("Only zip, tar, or tar.gz files are allowed"));
    }
  },
});

// List all sites with file checks and search
router.get("/", async (req, res) => {
  try {
    // Get search parameters
    const search = req.query.search || "";
    const customer = req.query.customer || "";
    const type = req.query.type || "";
    const limit = parseInt(req.query.limit) || 0;
    const offset = parseInt(req.query.offset) || 0;

    const keys = await redisClient.keys("site:*");
    const sites = [];

    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        try {
          let site = JSON.parse(data);

          // Check if static files exist
          site = checkStaticFiles(site);

          // Apply search filter
          if (search) {
            const searchLower = search.toLowerCase();
            const matchesSearch =
              site.domain.toLowerCase().includes(searchLower) ||
              (site.domain || "").toLowerCase().includes(searchLower) ||
              (site.customerId || "").toLowerCase().includes(searchLower);

            if (!matchesSearch) continue;
          }

          // Apply customer filter
          if (customer && site.customerId !== customer) {
            continue;
          }

          // Apply type filter
          if (type && site.type !== type) {
            continue;
          }

          sites.push(site);
        } catch (e) {
          console.error(`Error parsing site data for ${key}:`, e);
        }
      }
    }

    // Sort by creation date (newest first)
    sites.sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt || 0);
      const dateB = new Date(b.created_at || b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    // Apply pagination if requested
    let paginatedSites = sites;
    if (limit > 0) {
      paginatedSites = sites.slice(offset, offset + limit);
    }

    // Return results with metadata
    res.json({
      data: paginatedSites,
      total: sites.length,
      limit: limit || sites.length,
      offset: offset,
      hasMore: limit > 0 && offset + limit < sites.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get virtual host details
router.get("/:domain", async (req, res) => {
  try {
    const data = await redisClient.get(`site:${req.params.domain}`);
    if (!data) {
      return res.status(404).json({ error: "Site not found" });
    }
    let site = JSON.parse(data);

    // Check if static files exist
    site = checkStaticFiles(site);

    res.json(site);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create virtual host
router.post("/", async (req, res) => {
  try {
    const site = req.body;
    const authConfig = site.authConfig;
    delete site.authConfig;

    // Validate required fields
    if (!site.domain || !site.type) {
      return res.status(400).json({ error: "Domain and type are required" });
    }

    // Check if exists
    const exists = await redisClient.exists(`site:${site.domain}`);
    if (exists) {
      return res.status(409).json({ error: "Site already exists" });
    }

    // Set defaults
    site.enabled = site.enabled !== false;
    site.ssl_enabled = site.ssl_enabled || false;
    site.createdAt = new Date().toISOString();
    site.updatedAt = site.createdAt;

    // Validate and clean proxy target
    if (site.type === "proxy" && site.target) {
      site.target = site.target.trim();
      if (!site.target.match(/^https?:\/\//)) {
        return res
          .status(400)
          .json({ error: "Proxy target must start with http:// or https://" });
      }
    }

    // Handle Load Balancer configuration
    if (site.type === "loadbalancer") {
      // Ensure backends array exists and is valid
      if (
        !site.backends ||
        !Array.isArray(site.backends) ||
        site.backends.length === 0
      ) {
        return res.status(400).json({
          error: "Load balancer requires at least one backend server",
        });
      }

      // Validate each backend
      site.backends = site.backends.map((backend, index) => ({
        url: backend.url || "",
        label: backend.label || `backend-${index + 1}`,
        weight: backend.weight || 1,
        enabled: backend.enabled !== false,
        isLocal: backend.isLocal || false,
        healthCheck: backend.healthCheck || {
          path: "/health",
          interval: 10,
          timeout: 5,
          unhealthyThreshold: 3,
          healthyThreshold: 2,
        },
      }));

      // Set default sticky session if not provided
      site.stickySessionDuration = site.stickySessionDuration || 0;
      console.log(
        `Load balancer configuration for ${site.domain}:`,
        JSON.stringify(site.backends, null, 2)
      );
    }

    // Handle Docker Compose deployment
    if (site.type === "container" && site.composeConfig) {
      try {
        // Parse the YAML to create a compose deployment
        const composeYaml = site.composeConfig;
        const composeData = yaml.load(composeYaml);

        // Deploy using compose manager
        // const result = await composeManager.deployCompose(site.domain, composeData);

        // Store the result in the site object
        // site.composeProject = result.projectName;
        // site.containers = result.containers;
        // site.services = result.services;

        console.log(`Compose deployment successful for ${site.domain}`);
      } catch (error) {
        console.error("Compose deployment failed:", error);
        return res.status(500).json({
          error: "Compose deployment failed",
          details: error.message,
        });
      }
    }
    // Handle simple container deployment
    else if (site.type === "container" && site.containerConfig) {
      try {
        const containerName = `spinforge-${site.domain.replace(/\./g, "-")}`;
        const config = site.containerConfig;

        // Build docker run command
        let dockerCmd = `docker run -d --name ${containerName}`;
        dockerCmd += ` --network spinforge_spinforge`;
        dockerCmd += ` --restart ${config.restartPolicy || "unless-stopped"}`;

        // Add TTY and stdin support for interactive containers
        dockerCmd += ` -t`;

        // Add default terminal environment variables
        dockerCmd += ` -e TERM=xterm-256color`;
        dockerCmd += ` -e LANG=C.UTF-8`;
        dockerCmd += ` -e LC_ALL=C.UTF-8`;

        // Don't expose port - container will be accessed internally through network

        // Add environment variables - handle both object and array formats
        if (config.env) {
          console.log(
            "Environment variables found during creation:",
            JSON.stringify(config.env, null, 2)
          );
          if (Array.isArray(config.env) && config.env.length > 0) {
            // Old array format [{key, value}]
            console.log(
              "Processing as array format with",
              config.env.length,
              "items"
            );
            config.env.forEach((env) => {
              if (env.key && env.value !== undefined) {
                console.log(`  Adding env var: ${env.key}=${env.value}`);
                dockerCmd += ` -e "${env.key}=${env.value}"`;
              }
            });
          } else if (
            typeof config.env === "object" &&
            !Array.isArray(config.env) &&
            Object.keys(config.env).length > 0
          ) {
            // New object format {KEY: value}
            console.log(
              "Processing as object format with",
              Object.keys(config.env).length,
              "keys"
            );
            Object.entries(config.env).forEach(([key, value]) => {
              if (key && value !== undefined) {
                console.log(`  Adding env var: ${key}=${value}`);
                dockerCmd += ` -e "${key}=${value}"`;
              }
            });
          }
        }

        // Add volume mounts
        if (config.volumes && config.volumes.length > 0) {
          config.volumes.forEach((vol) => {
            dockerCmd += ` -v "${vol.host}:${vol.container}"`;
          });
        }

        // Add resource limits
        if (config.memoryLimit) {
          dockerCmd += ` --memory="${config.memoryLimit}"`;
        }
        if (config.cpuLimit) {
          dockerCmd += ` --cpus="${config.cpuLimit}"`;
        }

        // Add labels for metadata
        dockerCmd += ` --label spinforge.domain="${site.domain}"`;
        dockerCmd += ` --label spinforge.type="container"`;
        dockerCmd += ` --label spinforge.created="${site.createdAt}"`;

        // Add the image
        dockerCmd += ` ${config.image}`;

        // Add command override if specified
        if (config.command) {
          dockerCmd += ` ${config.command}`;
        }

        console.log("Deploying container:", dockerCmd);

        // Execute docker run
        const { stdout, stderr } = await execAsync(dockerCmd);
        const containerId = stdout.trim();

        // Store container ID in site config
        site.containerId = containerId;
        site.containerName = containerName;

        // Wait a moment for container to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Use container name for internal routing (more reliable than IP)
        site.target = `http://${containerName}:${config.port}`;
        
        console.log(`Container deployed: ${containerName} -> ${site.target}`);
      } catch (error) {
        console.error("Container deployment failed:", error);
        return res.status(500).json({
          error: "Container deployment failed",
          details: error.message,
        });
      }
    }

    // Save to Redis - domain is the key!
    await redisClient.set(`site:${site.domain}`, JSON.stringify(site));

    // Handle aliases - each alias points to the primary domain
    if (site.aliases && site.aliases.length > 0) {
      for (const alias of site.aliases) {
        await redisClient.set(`alias:${alias}`, site.domain);
      }
    }

    // Handle additional endpoints for containers
    if (
      site.type === "container" &&
      site.additionalEndpoints &&
      site.additionalEndpoints.length > 0
    ) {
      for (const endpoint of site.additionalEndpoints) {
        if (endpoint.enabled && endpoint.domain && endpoint.port) {
          // Create a proxy route for each additional endpoint
          const endpointRoute = {
            type: "proxy",
            domain: endpoint.domain,
            target: `http://${site.containerName || site.containerId}:${
              endpoint.port
            }`,
            enabled: true,
            parentSite: site.domain,
            isAdditionalEndpoint: true,
            createdAt: site.createdAt,
            updatedAt: site.createdAt,
          };

          await redisClient.set(
            `site:${endpoint.domain}`,
            JSON.stringify(endpointRoute)
          );
          console.log(
            `Registered additional endpoint: ${endpoint.domain} -> ${site.containerName}:${endpoint.port}`
          );
        }
      }
    }

    // Handle auth configuration for the main domain and aliases
    if (authConfig) {
      try {
        // Configure auth for main domain
        if (authConfig.enabled && authConfig.routes) {
          for (const route of authConfig.routes) {
            await addRouteAuth(site.domain, route);
          }
        }
        
        // Configure auth for aliases
        if (site.aliases && site.aliases.length > 0) {
          for (const alias of site.aliases) {
            if (authConfig.routes) {
              for (const route of authConfig.routes) {
                await addRouteAuth(alias, route);
              }
            }
          }
        }
        
        // Configure auth for additional endpoints
        if (site.additionalEndpoints) {
          for (const endpoint of site.additionalEndpoints) {
            if (endpoint.enabled && endpoint.domain && authConfig.routes) {
              for (const route of authConfig.routes) {
                await addRouteAuth(endpoint.domain, route);
              }
            }
          }
        }
        
        console.log(`Auth configuration applied for ${site.domain}`);
      } catch (error) {
        console.error("Failed to configure auth:", error);
        // Don't fail the entire site creation, just log the error
        console.error("Site created but auth configuration failed:", error.message);
      }
    }
    res.status(201).json({ message: "Site created", domain: site.domain });
  } catch (error) {
    console.error("Failed to create site:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update virtual host
router.put("/:domain", async (req, res) => {
  try {
    const domain = req.params.domain;
    const updates = req.body;

    // Get existing site
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: "Site not found" });
    }

    const site = JSON.parse(data);

    // Apply updates
    Object.assign(site, updates);
    site.updatedAt = new Date().toISOString();

    // Handle additional endpoints for containers
    if (site.type === "container" && updates.additionalEndpoints) {
      // Validate additional endpoints format
      if (!Array.isArray(updates.additionalEndpoints)) {
        return res
          .status(400)
          .json({ error: "Additional endpoints must be an array" });
      }

      // Store additional endpoints with the site
      site.additionalEndpoints = updates.additionalEndpoints.map(
        (endpoint) => ({
          domain: endpoint.domain,
          port: endpoint.port,
          path: endpoint.path || "/",
          enabled: endpoint.enabled !== false,
        })
      );
    }

    // Validate and clean proxy target on updates
    if (site.type === "proxy" && site.target) {
      site.target = site.target.trim();
      if (!site.target.match(/^https?:\/\//)) {
        return res
          .status(400)
          .json({ error: "Proxy target must start with http:// or https://" });
      }
    }

    // Handle Load Balancer backend updates
    if (site.type === "loadbalancer" && updates.backends) {
      // Validate backends
      if (!Array.isArray(updates.backends)) {
        return res.status(400).json({ error: "Backends must be an array" });
      }

      site.backends = updates.backends.map((backend, index) => ({
        url: backend.url || "",
        label: backend.label || `backend-${index + 1}`,
        weight: backend.weight || 1,
        enabled: backend.enabled !== false,
        isLocal: backend.isLocal || false,
        healthCheck: backend.healthCheck || {
          path: "/health",
          interval: 10,
          timeout: 5,
          unhealthyThreshold: 3,
          healthyThreshold: 2,
        },
      }));

      console.log(
        `Updated load balancer backends for ${domain}:`,
        JSON.stringify(site.backends, null, 2)
      );
    }

    // Check if container configuration changed and needs rebuild
    const oldSite = JSON.parse(data);
    const containerConfigChanged =
      site.type === "container" &&
      updates.containerConfig &&
      JSON.stringify(oldSite.containerConfig) !==
        JSON.stringify(site.containerConfig);

    // Clean up old additional endpoints first
    if (oldSite.additionalEndpoints && oldSite.additionalEndpoints.length > 0) {
      for (const oldEndpoint of oldSite.additionalEndpoints) {
        if (oldEndpoint.domain) {
          // Check if this endpoint still exists in the new configuration
          const stillExists =
            site.additionalEndpoints &&
            site.additionalEndpoints.some(
              (ep) => ep.domain === oldEndpoint.domain
            );

          if (!stillExists) {
            await redisClient.del(`site:${oldEndpoint.domain}`);
            console.log(`Removed old endpoint: ${oldEndpoint.domain}`);
          }
        }
      }
    }

    // Save to Redis first
    await redisClient.set(`site:${domain}`, JSON.stringify(site));

    // Register additional endpoints as separate routes
    if (site.additionalEndpoints && site.additionalEndpoints.length > 0) {
      for (const endpoint of site.additionalEndpoints) {
        if (endpoint.enabled && endpoint.domain && endpoint.port) {
          // Create a proxy route for each additional endpoint
          const endpointRoute = {
            type: "proxy",
            domain: endpoint.domain,
            target: `http://${site.containerName || site.containerId}:${
              endpoint.port
            }`,
            enabled: true,
            parentSite: domain,
            isAdditionalEndpoint: true,
            createdAt: site.createdAt,
            updatedAt: new Date().toISOString(),
          };

          await redisClient.set(
            `site:${endpoint.domain}`,
            JSON.stringify(endpointRoute)
          );
          console.log(
            `Registered additional endpoint: ${endpoint.domain} -> ${site.containerName}:${endpoint.port}`
          );
        }
      }
    }

    // Handle container rebuild if configuration changed
    if (containerConfigChanged && site.containerName) {
      try {
        console.log(
          `Container configuration changed for ${domain}, rebuilding...`
        );

        // Check if container exists and is running
        let containerRunning = false;
        try {
          const { stdout: status } = await execAsync(
            `docker inspect -f '{{.State.Running}}' ${site.containerName}`
          );
          containerRunning = status.trim() === "true";
        } catch (e) {
          // Container doesn't exist or error checking
          console.log("Container not found or error checking status");
        }

        // Stop and remove old container if it exists
        try {
          await execAsync(`docker stop ${site.containerName}`);
          await execAsync(`docker rm ${site.containerName}`);
          console.log(`Removed old container: ${site.containerName}`);
        } catch (e) {
          // Container might not exist, continue
          console.log("Container cleanup skipped:", e.message);
        }

        // Rebuild container with new configuration
        const config = site.containerConfig;
        
        // Log image change if it occurred
        if (oldSite.containerConfig && oldSite.containerConfig.image !== config.image) {
          console.log(`Image changed from ${oldSite.containerConfig.image} to ${config.image}`);
          
          // Pull the new image first
          try {
            console.log(`Pulling new image: ${config.image}`);
            await execAsync(`docker pull ${config.image}`);
            console.log(`Successfully pulled image: ${config.image}`);
          } catch (pullError) {
            console.log(`Warning: Could not pull image ${config.image}, will try to use local`, pullError.message);
          }
        }
        
        let dockerCmd = `docker run -d --name ${site.containerName}`;
        dockerCmd += ` --network spinforge_spinforge`;
        dockerCmd += ` --restart ${config.restartPolicy || "unless-stopped"}`;
        dockerCmd += ` -t`;
        dockerCmd += ` -e TERM=xterm-256color`;
        dockerCmd += ` -e LANG=C.UTF-8`;
        dockerCmd += ` -e LC_ALL=C.UTF-8`;

        // Add environment variables - handle both object and array formats
        if (config.env) {
          console.log(
            "Environment variables found during creation:",
            JSON.stringify(config.env, null, 2)
          );
          if (Array.isArray(config.env) && config.env.length > 0) {
            // Old array format [{key, value}]
            console.log(
              "Processing as array format with",
              config.env.length,
              "items"
            );
            config.env.forEach((env) => {
              if (env.key && env.value !== undefined) {
                console.log(`  Adding env var: ${env.key}=${env.value}`);
                dockerCmd += ` -e "${env.key}=${env.value}"`;
              }
            });
          } else if (
            typeof config.env === "object" &&
            !Array.isArray(config.env) &&
            Object.keys(config.env).length > 0
          ) {
            // New object format {KEY: value}
            console.log(
              "Processing as object format with",
              Object.keys(config.env).length,
              "keys"
            );
            Object.entries(config.env).forEach(([key, value]) => {
              if (key && value !== undefined) {
                console.log(`  Adding env var: ${key}=${value}`);
                dockerCmd += ` -e "${key}=${value}"`;
              }
            });
          }
        }

        // Add volume mounts
        if (config.volumes && config.volumes.length > 0) {
          config.volumes.forEach((vol) => {
            dockerCmd += ` -v "${vol.host}:${vol.container}"`;
          });
        }

        // Add resource limits
        if (config.memoryLimit) {
          dockerCmd += ` --memory="${config.memoryLimit}"`;
        }
        if (config.cpuLimit) {
          dockerCmd += ` --cpus="${config.cpuLimit}"`;
        }

        // Add labels
        dockerCmd += ` --label spinforge.domain="${site.domain}"`;
        dockerCmd += ` --label spinforge.type="container"`;
        dockerCmd += ` --label spinforge.updated="${site.updatedAt}"`;

        // Add the image
        dockerCmd += ` ${config.image}`;

        // Add command override if specified
        if (config.command) {
          dockerCmd += ` ${config.command}`;
        }

        console.log("Recreating container with command:", dockerCmd);
        const { stdout, stderr } = await execAsync(dockerCmd);
        const containerId = stdout.trim();

        // Update container ID
        site.containerId = containerId;

        // Wait for container to start
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Use container name for internal routing (more reliable than IP)
        site.target = `http://${site.containerName}:${config.port}`;
        
        // Save updated site with new container info
        await redisClient.set(`site:${domain}`, JSON.stringify(site));

        console.log(
          `Container rebuilt successfully: ${site.containerName} -> ${site.target}`
        );
      } catch (error) {
        console.error("Container rebuild failed:", error);
        // Don't fail the entire update, but log the error
        return res.status(500).json({
          error: "Configuration updated but container rebuild failed",
          details: error.message,
        });
      }
    }

    // Handle alias updates
    if (updates.aliases !== undefined) {
      // Clear old aliases
      const oldAliases = JSON.parse(data).aliases || [];
      for (const alias of oldAliases) {
        await redisClient.del(`alias:${alias}`);
      }
      // Add new aliases
      if (site.aliases && site.aliases.length > 0) {
        for (const alias of site.aliases) {
          await redisClient.set(`alias:${alias}`, domain);
        }
      }
    }

    // If domain/aliases were updated and this is a static site, update deploy.json
    if ((updates.domain || updates.aliases) && site.type === "static") {
      const staticPath =
        site.static_path ||
        path.join(STATIC_ROOT, site.domain.replace(/[^a-zA-Z0-9.-]/g, "-"));
      const deployJsonPath = path.join(staticPath, "deploy.json");

      try {
        if (fs.existsSync(deployJsonPath)) {
          // Read existing deploy.json
          const deployData = JSON.parse(
            fs.readFileSync(deployJsonPath, "utf8")
          );
          // Update domain and aliases
          if (updates.domain !== undefined) {
            deployData.domain = site.domain;
          }
          if (updates.aliases !== undefined) {
            deployData.aliases = site.aliases || [];
          }
          // Write back
          fs.writeFileSync(deployJsonPath, JSON.stringify(deployData, null, 2));
          console.log(`Updated deploy.json for ${domain}`);
        }
      } catch (e) {
        console.error(`Error updating deploy.json for ${domain}:`, e);
        // Don't fail the whole update if deploy.json update fails
      }
    }

    res.json({ message: "Site updated", domain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete virtual host
router.delete("/:domain", async (req, res) => {
  try {
    const domain = req.params.domain;

    // Get site to clean up domain mappings
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: "Site not found" });
    }

    const site = JSON.parse(data);

    // Clear all domain mappings for this site
    if (site.domain) {
      await redisClient.del(`domain:${site.domain}`);
    }
    if (site.aliases) {
      for (const alias of site.aliases) {
        await redisClient.del(`domain:${alias}`);
      }
    }

    // Handle container cleanup
    if (site.type === "container") {
      // Clean up additional endpoints first
      if (site.additionalEndpoints && site.additionalEndpoints.length > 0) {
        for (const endpoint of site.additionalEndpoints) {
          if (endpoint.domain) {
            try {
              await redisClient.del(`site:${endpoint.domain}`);
              console.log(`Deleted additional endpoint: ${endpoint.domain}`);
            } catch (error) {
              console.error(
                `Failed to delete endpoint ${endpoint.domain}:`,
                error
              );
            }
          }
        }
      }

      // Check if it's a compose deployment
      if (site.composeProject) {
        try {
          console.log(`Stopping compose project: ${site.composeProject}`);
          // await composeManager.stopCompose(domain);
        } catch (error) {
          console.error("Compose cleanup failed:", error);
          // Continue with deletion even if cleanup fails
        }
      } else if (site.containerName) {
        try {
          console.log(`Stopping and removing container: ${site.containerName}`);
          await execAsync(`docker stop ${site.containerName}`);
          await execAsync(`docker rm ${site.containerName}`);
        } catch (error) {
          console.error("Container cleanup failed:", error);
          // Continue with deletion even if container cleanup fails
        }
      }
    }

    // Delete from Redis
    await redisClient.del(`site:${domain}`);

    res.json({ message: "Site deleted", domain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload static site from zip file
router.post('/:domain/upload', upload.single('file'), async (req, res) => {
  try {
    const domain = req.params.domain;

    // Check if site exists and is static type
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      // Clean up uploaded file
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: "Site not found" });
    }

    const site = JSON.parse(data);
    if (site.type !== "static") {
      // Clean up uploaded file
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: "Site is not a static type" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`Processing upload for ${domain}:`);
    console.log(`- Uploaded file: ${req.file.path} (${req.file.size} bytes)`);
    console.log(`- Original name: ${req.file.originalname}`);

    try {
      // Use filesystem-friendly folder name (dots replaced with underscores)
      const folderName = domain.replace(/\./g, "_");
      const staticPath = path.join(STATIC_ROOT, folderName);

      console.log(`- Target directory: ${staticPath}`);

      // Create directory if it doesn't exist
      if (!fs.existsSync(staticPath)) {
        fs.mkdirSync(staticPath, { recursive: true });
      }
      
      // Handle merge vs replace mode
      const replaceMode = req.body.replaceMode === 'replace';
      
      if (replaceMode) {
        // Clear existing content in replace mode
        console.log('Replace mode: clearing existing content');
        const files = fs.readdirSync(staticPath);
        for (const file of files) {
          const filePath = path.join(staticPath, file);
          if (fs.statSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        }
      } else {
        console.log('Merge mode: keeping existing content, new files will overwrite');
      }

      // Determine file type and extract accordingly
      const fileName = req.file.originalname.toLowerCase();
      const isZip = fileName.endsWith('.zip');
      const isTar = fileName.endsWith('.tar') || fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz');
      
      let extractedCount = 0;
      let commonPrefix = "";

      if (isZip) {
        // Extract zip file
        const zip = new AdmZip(req.file.path);
        const zipEntries = zip.getEntries();

        // Analyze zip structure
        const entryPaths = zipEntries.map((e) => e.entryName);
        console.log(`Zip contains ${entryPaths.length} entries`);

        // Find the main content directory (ignore __MACOSX and other system folders)
        const contentEntries = zipEntries.filter(
          (e) =>
            !e.entryName.startsWith("__MACOSX/") &&
            !e.entryName.startsWith(".DS_Store") &&
            !e.isDirectory
        );

        if (contentEntries.length > 0) {
          // Check if all content files share a common directory
          const firstFilePath = contentEntries[0].entryName;
          const firstSlashIndex = firstFilePath.indexOf("/");

          if (firstSlashIndex > 0) {
            const potentialPrefix = firstFilePath.substring(
              0,
              firstSlashIndex + 1
            );

            // Check if all content files start with this prefix
            const allHavePrefix = contentEntries.every((e) =>
              e.entryName.startsWith(potentialPrefix)
            );

            if (allHavePrefix) {
              commonPrefix = potentialPrefix;
              console.log(
                `Detected common prefix: "${commonPrefix}" - will extract contents directly`
              );
            }
          }
        }

        // Extract files
        zipEntries.forEach((entry) => {
          // Skip system files and directories
          if (
            entry.entryName.startsWith("__MACOSX/") ||
            entry.entryName.includes(".DS_Store") ||
            entry.entryName.startsWith("._")
          ) {
            return;
          }

          if (!entry.isDirectory) {
            let targetPath = entry.entryName;

            // Remove common prefix if present
            if (commonPrefix && targetPath.startsWith(commonPrefix)) {
              targetPath = targetPath.substring(commonPrefix.length);
            }

            // Skip if empty after prefix removal
            if (!targetPath) return;

            const fullPath = path.join(staticPath, targetPath);
            const dir = path.dirname(fullPath);

            // Create directory if needed
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            // Write file
            fs.writeFileSync(fullPath, entry.getData());
            extractedCount++;
          }
        });

        console.log(`Extracted ${extractedCount} files from ZIP to ${staticPath}`);
        
      } else if (isTar) {
        // Extract tar file
        console.log(`Extracting TAR file: ${req.file.originalname}`);
        
        try {
          // Extract tar with automatic gzip detection
          await tar.extract({
            file: req.file.path,
            cwd: staticPath,
            strip: 1, // Strip the first directory level if common
            filter: (path) => {
              // Skip system files
              if (path.includes('__MACOSX') || 
                  path.includes('.DS_Store') || 
                  path.startsWith('._')) {
                return false;
              }
              extractedCount++;
              return true;
            }
          });
          
          console.log(`Extracted ${extractedCount} files from TAR to ${staticPath}`);
        } catch (tarError) {
          console.error('TAR extraction error:', tarError);
          // Try without strip option
          extractedCount = 0;
          await tar.extract({
            file: req.file.path,
            cwd: staticPath,
            filter: (path) => {
              if (path.includes('__MACOSX') || 
                  path.includes('.DS_Store') || 
                  path.startsWith('._')) {
                return false;
              }
              extractedCount++;
              return true;
            }
          });
          console.log(`Extracted ${extractedCount} files from TAR to ${staticPath} (no strip)`);
        }
      } else {
        throw new Error('Unsupported file format');
      }

      // Create deploy.json if it doesn't exist
      const deployJsonPath = path.join(staticPath, "deploy.json");
      if (!fs.existsSync(deployJsonPath)) {
        const deployData = {
          domain: domain,
          aliases: site.aliases || [],
          deployedAt: new Date().toISOString(),
          version: "1.0.0",
        };
        fs.writeFileSync(deployJsonPath, JSON.stringify(deployData, null, 2));
      }

      // Update site record
      site.updatedAt = new Date().toISOString();
      site.lastDeployedAt = site.updatedAt;
      await redisClient.set(`site:${domain}`, JSON.stringify(site));

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        message: "Site uploaded successfully",
        domain,
        filesExtracted: extractedCount,
        commonPrefixRemoved: commonPrefix || null,
        mode: replaceMode ? 'replace' : 'merge'
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw error;
    }
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
