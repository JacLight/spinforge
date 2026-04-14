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
const multer = require("multer");
const AdmZip = require("adm-zip");
const tar = require("tar");
const redisClient = require("../utils/redis");
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

    // Container and node workloads run on Nomad. The site record still
    // lives in Redis so OpenResty can route to it; upstream resolution
    // happens through Consul service discovery (consul_upstream.lua).
    if (site.type === 'container' || site.type === 'node') {
      try {
        const NomadService = require('../services/NomadService');
        const nomad = new NomadService();
        site.orchestrator = 'nomad';
        const deployed = await nomad.deploySite(site);
        site.nomadJobId = deployed.jobId;
        site.nomadEvalId = deployed.evalId;
      } catch (error) {
        console.error('Nomad deployment failed:', error);
        return res.status(500).json({
          error: 'Nomad deployment failed',
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

    // Caddy-style automatic SSL: if ssl_enabled was set, fire a background
    // ACME issuance. Failures retry on the renewal scheduler's next tick.
    require('../utils/auto-cert').maybeAutoIssueCert(site);

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
            type: 'container',
            domain: endpoint.domain,
            orchestrator: 'nomad',
            consulService: `site-${site.domain.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
            port: endpoint.port,
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

async function createDirIfNotExists(path) {
  try {
    await fs.mkdir(path, { recursive: true });
    // Set 777 permissions so container can read/write
    await fs.chmod(path, 0o777);
    console.log(`Directory created with 777 permissions: ${path}`);
  } catch (err) {
    console.error('Error creating directory:', err);
  }
}

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

    // Auto-issue cert on update too — covers the case where an existing
    // site gets ssl_enabled flipped from false → true. The helper is
    // idempotent: if we already have a valid cert it no-ops. If DNS
    // doesn't point here, the helper records a backoff instead of burning
    // Let's Encrypt rate-limit slots.
    require('../utils/auto-cert').maybeAutoIssueCert(site);

    // Register additional endpoints as separate routes
    if (site.additionalEndpoints && site.additionalEndpoints.length > 0) {
      for (const endpoint of site.additionalEndpoints) {
        if (endpoint.enabled && endpoint.domain && endpoint.port) {
          // Create a proxy route for each additional endpoint
          const endpointRoute = {
            type: 'container',
            domain: endpoint.domain,
            orchestrator: 'nomad',
            consulService: `site-${domain.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
            port: endpoint.port,
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
        }
      }
    }

    if (containerConfigChanged) {
      try {
        const NomadService = require('../services/NomadService');
        const nomad = new NomadService();
        site.orchestrator = 'nomad';
        const deployed = await nomad.deploySite(site);
        site.nomadJobId = deployed.jobId;
        site.nomadEvalId = deployed.evalId;
        await redisClient.set(`site:${domain}`, JSON.stringify(site));
      } catch (error) {
        console.error('Nomad redeploy failed:', error);
        return res.status(500).json({
          error: 'Configuration updated but Nomad redeploy failed',
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

    if (site.type === 'container' || site.type === 'node') {
      try {
        const NomadService = require('../services/NomadService');
        const nomad = new NomadService();
        await nomad.stopSite(site.domain, { purge: true });
      } catch (error) {
        console.error('Nomad teardown failed (continuing with cleanup):', error.message);
      }

      if (site.additionalEndpoints && site.additionalEndpoints.length > 0) {
        for (const endpoint of site.additionalEndpoints) {
          if (endpoint.domain) {
            await redisClient.del(`site:${endpoint.domain}`);
          }
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

router.get('/:domain/readiness', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);

    if (!data) {
      return res.status(404).json({ ready: false, error: 'Site not found', status: 'not_found' });
    }

    const site = JSON.parse(data);

    if (site.type === 'static') {
      const folderName = domain.replace(/\./g, '_');
      const staticPath = path.join(STATIC_ROOT, folderName);
      const filesExist = fs.existsSync(staticPath) && fs.readdirSync(staticPath).length > 0;
      return res.json({ ready: filesExist, type: 'static', status: filesExist ? 'ready' : 'no_files' });
    }

    if (site.type === 'container' || site.type === 'node') {
      try {
        const NomadService = require('../services/NomadService');
        const nomad = new NomadService();
        const status = await nomad.getSiteStatus(domain);
        if (!status) {
          return res.json({ ready: false, type: site.type, status: 'not_found' });
        }
        const allocs = status.allocations || [];
        const running = allocs.filter((a) => a.status === 'running').length;
        const healthy = allocs.filter((a) => a.healthy).length;
        const ready = running > 0 && healthy === running;
        return res.json({
          ready,
          type: site.type,
          status: ready ? 'ready' : running > 0 ? 'starting' : 'not_running',
          details: status,
        });
      } catch (error) {
        return res.json({ ready: false, type: site.type, status: 'error', error: error.message });
      }
    }

    return res.json({ ready: true, type: site.type, status: 'ready' });
  } catch (error) {
    res.status(500).json({ ready: false, error: error.message, status: 'error' });
  }
});

// Upload static site from zip file
router.post('/:domain/upload', upload.single('zipfile'), async (req, res) => {
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
