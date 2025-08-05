import { Router, Request, Response } from "express";
import { createLogger } from "@spinforge/shared";
import { HotDeploymentWatcher } from "./HotDeploymentWatcher";
import { readdir, stat, unlink, rmdir, mkdir, writeFile, readFile } from "fs/promises";
import { join, basename, dirname } from "path";
import { RouteManager } from "../RouteManager";
import { SpinletManager } from "@spinforge/spinlet-core";
import multer from "multer";
import { nanoid } from "nanoid";

interface DeploymentStatus {
  name: string;
  status: "pending" | "building" | "success" | "failed" | "processing" | "unhealthy" | "orphaned";
  timestamp: string;
  error?: string;
  buildTime?: number;
  domains?: string[];
  framework?: string;
  customerId?: string;
  spinletId?: string;
  mode?: 'development' | 'production';
  packageVersion?: string;
  runCommand?: string;
  orphaned?: boolean;
  buildPath?: string;
}

export class DeploymentAPI {
  private router: Router;
  private logger = createLogger("DeploymentAPI");
  private deploymentPath: string;
  private hotDeploymentWatcher: HotDeploymentWatcher;
  private routeManager: RouteManager;
  private spinletManager: SpinletManager;
  private deploymentStatuses = new Map<string, DeploymentStatus>();
  private processingDeployments = new Set<string>();
  private upload: multer.Multer;

  constructor(
    deploymentPath: string,
    hotDeploymentWatcher: HotDeploymentWatcher,
    routeManager: RouteManager,
    spinletManager: SpinletManager
  ) {
    this.deploymentPath = deploymentPath;
    this.hotDeploymentWatcher = hotDeploymentWatcher;
    this.routeManager = routeManager;
    this.spinletManager = spinletManager;
    this.router = Router();
    
    // Configure multer for file uploads
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        // Create a temporary upload directory
        const uploadDir = join(this.deploymentPath, '.uploads');
        await mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        // Keep original filename but add unique prefix
        const uniquePrefix = nanoid(8);
        cb(null, `${uniquePrefix}-${file.originalname}`);
      }
    });
    
    this.upload = multer({ 
      storage,
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max file size
      },
      fileFilter: (req, file, cb) => {
        const allowedExtensions = [
          '.zip', '.tar', '.tar.gz', '.tgz',
          '.tar.bz2', '.tbz2', '.tar.xz', '.txz',
          '.rar', '.7z', '.gz', '.bz2', '.xz'
        ];
        
        const ext = file.originalname.toLowerCase();
        const isAllowed = allowedExtensions.some(allowed => ext.endsWith(allowed));
        
        if (isAllowed) {
          cb(null, true);
        } else {
          cb(new Error(`Unsupported file type. Allowed: ${allowedExtensions.join(', ')}`));
        }
      }
    });
    
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Get all deployment statuses
    this.router.get("/deployments", this.getDeployments.bind(this));
    
    // Simple deployment endpoint (creates deployment folder)
    this.router.post("/deployments", this.createDeployment.bind(this));

    // Upload deployment archive
    this.router.post("/deployments/upload", 
      this.upload.single('archive'), 
      this.uploadDeployment.bind(this)
    );

    // Scan deployment folder
    this.router.get("/deployments/scan", this.scanDeployments.bind(this));
    this.router.post("/deployments/scan", this.triggerScan.bind(this));

    // Retry a deployment
    this.router.post(
      "/deployments/:name/retry",
      this.retryDeployment.bind(this)
    );

    // Cancel a deployment
    this.router.post(
      "/deployments/:name/cancel",
      this.cancelDeployment.bind(this)
    );

    // Remove a deployment
    this.router.delete("/deployments/:name", this.removeDeployment.bind(this));

    // Get deployment logs
    this.router.get(
      "/deployments/:name/logs",
      this.getDeploymentLogs.bind(this)
    );

    // Trigger health check
    this.router.post("/deployments/health-check", this.triggerHealthCheck.bind(this));
    
    // Verify deployment accessibility
    this.router.get("/deployments/:name/verify", this.verifyDeployment.bind(this));
    
    // File sync endpoint for watch mode
    this.router.post("/deployments/:name/sync", 
      this.upload.array('files', 100), // Allow up to 100 files
      this.syncFiles.bind(this)
    );
    
    // Cleanup orphaned deployment
    this.router.post("/deployments/:domain/cleanup-orphaned", this.cleanupOrphanedDeployment.bind(this));
  }

  private async uploadDeployment(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const file = req.file;
      const deploymentId = req.body.deploymentId || nanoid();
      
      // Validate required fields from request body
      if (!req.body.config) {
        res.status(400).json({ error: "Missing deployment configuration" });
        return;
      }

      let config;
      try {
        config = JSON.parse(req.body.config);
      } catch (e) {
        res.status(400).json({ error: "Invalid deployment configuration JSON" });
        return;
      }

      // Validate config has required fields
      if (!config.name || !config.domain || !config.customerId || !config.framework) {
        res.status(400).json({ 
          error: "Missing required fields in config: name, domain, customerId, framework" 
        });
        return;
      }

      // Create deployment directory
      const deploymentDir = join(this.deploymentPath, deploymentId);
      await mkdir(deploymentDir, { recursive: true });
      
      // Extract the archive directly into the deployment directory
      const fs = require('fs').promises;
      const unzipper = require('unzipper');
      const tar = require('tar');
      const { pipeline } = require('stream/promises');
      const { createReadStream } = require('fs');
      
      this.logger.info(`Extracting archive ${file.originalname} to ${deploymentDir}`);
      
      const filename = file.originalname.toLowerCase();
      
      if (filename.endsWith('.zip')) {
        // Extract zip file
        await pipeline(
          createReadStream(file.path),
          unzipper.Extract({ path: deploymentDir })
        );
      } else if (filename.endsWith('.tar') || filename.endsWith('.tar.gz') || filename.endsWith('.tgz')) {
        // Extract tar file
        await tar.x({
          file: file.path,
          cwd: deploymentDir,
          strip: 1 // Remove the top-level directory from the archive
        });
      } else {
        throw new Error(`Unsupported archive format: ${file.originalname}`);
      }
      
      // Remove the temporary file after successful extraction
      await fs.unlink(file.path);

      // Create deploy.json in the deployment directory
      const deployConfigPath = join(deploymentDir, 'deploy.json');
      await writeFile(deployConfigPath, JSON.stringify(config, null, 2));

      // Mark deployment as processing
      this.markDeploymentAsProcessing(deploymentId);

      // The hot deployment watcher will pick up the new deployment
      this.logger.info(`Archive uploaded for deployment: ${deploymentId}`, {
        filename: file.originalname,
        size: file.size,
        config: config
      });

      res.json({
        success: true,
        deploymentId,
        message: "Deployment archive uploaded successfully",
        filename: file.originalname,
        size: file.size
      });
      
    } catch (error) {
      this.logger.error("Error uploading deployment", { error });
      res.status(500).json({ error: "Failed to upload deployment" });
    }
  }
  
  private async syncFiles(req: Request, res: Response): Promise<void> {
    try {
      const deploymentName = req.params.name;
      const deploymentPath = join(this.deploymentPath, deploymentName);
      
      // Check if deployment exists
      try {
        await stat(deploymentPath);
      } catch (error) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }
      
      // Get file metadata from request
      const fileMetadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
      const mode = req.body.mode || 'development'; // 'development' or 'preview'
      
      // Process uploaded files
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: "No files provided" });
        return;
      }
      
      const updatedFiles: string[] = [];
      let needsRebuild = false;
      let needsRestart = false;
      
      // Write files to deployment directory
      for (const file of files) {
        const targetPath = join(deploymentPath, file.originalname);
        const targetDir = dirname(targetPath);
        
        // Create directory if needed
        await mkdir(targetDir, { recursive: true });
        
        // Write file
        await writeFile(targetPath, file.buffer);
        updatedFiles.push(file.originalname);
        
        // Determine if rebuild/restart needed
        if (this.needsRebuild(file.originalname)) {
          needsRebuild = true;
        }
        if (this.needsRestart(file.originalname)) {
          needsRestart = true;
        }
      }
      
      // Handle deleted files if provided
      const deletedFiles = req.body.deleted ? JSON.parse(req.body.deleted) : [];
      for (const filepath of deletedFiles) {
        const targetPath = join(deploymentPath, filepath);
        try {
          await unlink(targetPath);
          this.logger.info(`Deleted file: ${filepath}`);
        } catch (error) {
          // File might not exist, ignore
        }
      }
      
      // Trigger appropriate action based on changes
      let action = 'none';
      if (needsRestart) {
        action = 'restart';
        // For now, just notify - in production this would restart the container
        this.logger.info(`Restart required for ${deploymentName} due to file changes`);
      } else if (needsRebuild) {
        action = 'incremental-build';
        
        // For development mode with frameworks that support HMR
        if (mode === 'development') {
          // Most modern frameworks handle this automatically via their dev server
          // The file update will trigger HMR/Fast Refresh
          this.logger.info(`Incremental build triggered for ${deploymentName}`, {
            files: updatedFiles,
            mode
          });
        } else {
          // For production preview mode, we might need to trigger a build
          // This depends on the framework and setup
          this.logger.info(`Production mode file update for ${deploymentName}`, {
            files: updatedFiles
          });
        }
      } else {
        action = 'hot-reload';
        // Static assets can be served immediately
        this.logger.info(`Hot reload for static assets in ${deploymentName}`, {
          files: updatedFiles
        });
      }
      
      this.logger.info(`File sync completed for ${deploymentName}`, {
        updatedFiles: updatedFiles.length,
        deletedFiles: deletedFiles.length,
        action,
        mode
      });
      
      res.json({
        success: true,
        updated: updatedFiles,
        deleted: deletedFiles,
        action,
        message: `Synced ${updatedFiles.length} files`
      });
      
    } catch (error) {
      this.logger.error("Error syncing files", { error });
      res.status(500).json({ error: "Failed to sync files" });
    }
  }
  
  private needsRebuild(filepath: string): boolean {
    // Files that require rebuild
    const rebuildPatterns = [
      /\.(tsx?|jsx?)$/,        // TypeScript/JavaScript
      /\.(vue|svelte)$/,       // Framework files
      /package\.json$/,       // Dependencies
      /tsconfig\.json$/,      // TS config
      /next\.config\.(js|ts)$/, // Next.js config
      /webpack\.config\.js$/, // Webpack config
    ];
    return rebuildPatterns.some(pattern => pattern.test(filepath));
  }
  
  private needsRestart(filepath: string): boolean {
    // Files that require full restart
    const restartPatterns = [
      /package\.json$/,       // New dependencies
      /\.env(\.\w+)?$/,      // Environment variables
      /server\.(js|ts)$/,     // Server files
    ];
    return restartPatterns.some(pattern => pattern.test(filepath));
  }
  
  private async createDeployment(req: Request, res: Response): Promise<void> {
    try {
      const { name, domain, customerId, framework, config } = req.body;
      
      // Validate required fields
      if (!name || !domain || !customerId || !framework) {
        res.status(400).json({ 
          error: "Missing required fields: name, domain, customerId, framework" 
        });
        return;
      }
      
      const deploymentId = name;
      const deploymentDir = join(this.deploymentPath, deploymentId);
      
      // Check if deployment already exists
      try {
        await stat(deploymentDir);
        res.status(409).json({ error: "Deployment already exists" });
        return;
      } catch (e) {
        // Directory doesn't exist, good to proceed
      }
      
      // Create deployment directory
      await mkdir(deploymentDir, { recursive: true });
      
      // Create deploy.yaml
      const deployConfig = {
        name,
        domain,
        customerId,
        framework,
        version: "1.0.0",
        runtime: framework === 'static' ? 'static' : 'node',
        nodeVersion: "20",
        resources: config?.resources || {
          memory: "512MB",
          cpu: 0.5
        },
        env: config?.env || {},
        ...config
      };
      
      const deployYamlPath = join(deploymentDir, 'deploy.yaml');
      const yaml = require('js-yaml');
      await writeFile(deployYamlPath, yaml.dump(deployConfig));
      
      // Mark deployment as pending
      this.deploymentStatuses.set(deploymentId, {
        name: deploymentId,
        status: "pending",
        timestamp: new Date().toISOString(),
        framework,
        customerId,
        domains: [domain]
      });
      
      // The hot deployment watcher will pick it up
      this.logger.info(`Deployment created: ${deploymentId}`, { config: deployConfig });
      
      res.json({
        success: true,
        deploymentId,
        message: "Deployment created successfully",
        status: "pending"
      });
      
    } catch (error) {
      this.logger.error("Error creating deployment", { error });
      res.status(500).json({ error: "Failed to create deployment" });
    }
  }

  private async getDeployments(req: Request, res: Response): Promise<void> {
    try {
      // Get deployment statuses from files and running processes
      const allDeployments = await this.collectDeploymentStatuses();
      
      // Check if this is an admin request (no customer ID filter needed)
      const isAdminRequest = req.baseUrl?.includes('/_admin');
      
      if (isAdminRequest) {
        // Admin can see all deployments
        res.json(allDeployments);
      } else {
        // Customer API - filter by customer ID
        const customerId = req.headers['x-customer-id'] as string;
        
        if (!customerId) {
          res.status(401).json({ error: "Customer ID required" });
          return;
        }
        
        const customerDeployments = allDeployments.filter(
          deployment => deployment.customerId === customerId
        );
        
        res.json(customerDeployments);
      }
    } catch (error) {
      this.logger.error("Error fetching deployments", { error });
      res.status(500).json({ error: "Failed to fetch deployments" });
    }
  }

  private async scanDeployments(req: Request, res: Response): Promise<void> {
    try {
      const items = await this.scanDeploymentFolder();
      res.json({ items, path: this.deploymentPath });
    } catch (error) {
      this.logger.error("Error scanning deployment folder", { error });
      res.status(500).json({ error: "Failed to scan deployment folder" });
    }
  }

  private async triggerScan(req: Request, res: Response): Promise<void> {
    try {
      // Trigger hot deployment watcher to scan again
      await this.scanDeploymentFolder();
      res.json({ success: true, message: "Scan triggered successfully" });
    } catch (error) {
      this.logger.error("Error triggering scan", { error });
      res.status(500).json({ error: "Failed to trigger scan" });
    }
  }

  private async triggerHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      await (this.hotDeploymentWatcher as any).performHealthCheck();
      res.json({ success: true, message: "Health check triggered successfully" });
    } catch (error) {
      this.logger.error("Error triggering health check", { error });
      res.status(500).json({ error: "Failed to trigger health check" });
    }
  }

  private async verifyDeployment(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;
      const deploymentDir = join(this.deploymentPath, name);
      
      // Check if deployment directory exists
      try {
        await stat(deploymentDir);
      } catch {
        res.json({ 
          accessible: false, 
          error: "Deployment directory not found",
          status: "missing"
        });
        return;
      }
      
      // Get deployment config
      const deployConfig = await this.loadDeploymentConfig(deploymentDir);
      if (!deployConfig) {
        res.json({ 
          accessible: false, 
          error: "No deployment configuration found",
          status: "no-config"
        });
        return;
      }
      
      // For static deployments, check if files exist
      if (deployConfig.framework === 'static') {
        const outputPath = deployConfig.build?.outputDir 
          ? join(deploymentDir, deployConfig.build.outputDir)
          : deploymentDir;
          
        try {
          const files = await readdir(outputPath);
          const hasIndex = files.some(f => 
            f.toLowerCase() === 'index.html' || 
            f.toLowerCase() === 'index.htm'
          );
          
          if (!hasIndex) {
            res.json({ 
              accessible: false, 
              error: "No index.html found",
              status: "no-index"
            });
            return;
          }
          
          res.json({ 
            accessible: true, 
            status: "healthy",
            files: files.length,
            path: outputPath
          });
        } catch (error) {
          res.json({ 
            accessible: false, 
            error: `Cannot read output directory: ${(error as Error).message}`,
            status: "read-error"
          });
        }
      } else {
        // For non-static deployments, just check if config exists
        res.json({ 
          accessible: true, 
          status: "config-exists",
          framework: deployConfig.framework
        });
      }
    } catch (error) {
      this.logger.error(`Error verifying deployment ${req.params.name}`, { error });
      res.status(500).json({ error: "Failed to verify deployment" });
    }
  }

  private async loadDeploymentConfig(deploymentPath: string): Promise<any> {
    try {
      const yamlPath = join(deploymentPath, "deploy.yaml");
      const yamlContent = await readFile(yamlPath, "utf-8");
      const { parse } = require("yaml");
      return parse(yamlContent);
    } catch {
      try {
        const jsonPath = join(deploymentPath, "deploy.json");
        const jsonContent = await readFile(jsonPath, "utf-8");
        return JSON.parse(jsonContent);
      } catch {
        return null;
      }
    }
  }

  private async retryDeployment(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      // Remove failed marker
      await this.removeMarker(name, ".failed");

      // Trigger redeployment by touching deploy.yaml
      await this.triggerDeployment(name);

      // Update status
      this.updateDeploymentStatus(name, {
        name,
        status: "pending",
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: `Deployment ${name} queued for retry`,
      });
    } catch (error) {
      this.logger.error(`Error retrying deployment ${req.params.name}`, {
        error,
      });
      res.status(500).json({ error: "Failed to retry deployment" });
    }
  }

  private async cancelDeployment(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      // Mark as cancelled (this would need process killing in real implementation)
      this.processingDeployments.delete(name);

      this.updateDeploymentStatus(name, {
        name,
        status: "failed",
        timestamp: new Date().toISOString(),
        error: "Deployment cancelled by user",
      });

      res.json({ success: true, message: `Deployment ${name} cancelled` });
    } catch (error) {
      this.logger.error(`Error cancelling deployment ${req.params.name}`, {
        error,
      });
      res.status(500).json({ error: "Failed to cancel deployment" });
    }
  }

  private async removeDeployment(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;
      
      // Handle both simple names and customerId/projectName format
      let deploymentDir: string;
      if (name.includes('/')) {
        // It's in customerId/projectName format
        deploymentDir = join(this.deploymentPath, name);
      } else {
        // Try to find it in the root or in customer folders
        deploymentDir = join(this.deploymentPath, name);
        
        // Check if it exists in root
        try {
          await stat(deploymentDir);
        } catch {
          // Not in root, search in customer folders
          const entries = await readdir(this.deploymentPath);
          let found = false;
          
          for (const entry of entries) {
            const customerPath = join(this.deploymentPath, entry);
            const possiblePath = join(customerPath, name);
            
            try {
              await stat(possiblePath);
              deploymentDir = possiblePath;
              found = true;
              break;
            } catch {
              // Continue searching
            }
          }
          
          if (!found) {
            res.status(404).json({ error: "Deployment not found" });
            return;
          }
        }
      }

      // Remove from processing queue
      this.processingDeployments.delete(name);

      // Remove status
      this.deploymentStatuses.delete(name);

      // Remove from file system
      await this.removeDirectory(deploymentDir);

      res.json({ success: true, message: `Deployment ${name} removed` });
    } catch (error) {
      this.logger.error(`Error removing deployment ${req.params.name}`, {
        error,
      });
      res.status(500).json({ error: "Failed to remove deployment" });
    }
  }

  private async getDeploymentLogs(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      // In a real implementation, this would read from log files
      const logs = this.generateMockLogs(name);

      res.json({ logs });
    } catch (error) {
      this.logger.error(`Error fetching logs for ${req.params.name}`, {
        error,
      });
      res.status(500).json({ error: "Failed to fetch deployment logs" });
    }
  }

  private async collectDeploymentStatuses(): Promise<DeploymentStatus[]> {
    const deployments: DeploymentStatus[] = [];

    try {
      // First, collect deployments from filesystem
      const entries = await readdir(this.deploymentPath);

      for (const entry of entries) {
        const fullPath = join(this.deploymentPath, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          // Check if this is a deployment directory
          const hasDeployConfig = await this.hasDeploymentConfig(fullPath);
          
          if (hasDeployConfig) {
            // It's a deployment directory
            const status = await this.getDeploymentStatus(entry, fullPath);
            deployments.push(status);
          } else {
            // It might be a customer folder, scan its contents
            try {
              const subEntries = await readdir(fullPath);
              for (const subEntry of subEntries) {
                const subPath = join(fullPath, subEntry);
                const subStats = await stat(subPath);
                
                if (subStats.isDirectory()) {
                  const hasSubDeployConfig = await this.hasDeploymentConfig(subPath);
                  if (hasSubDeployConfig) {
                    // Use customerId/projectName as the deployment name
                    const deploymentName = `${entry}/${subEntry}`;
                    const status = await this.getDeploymentStatus(deploymentName, subPath);
                    deployments.push(status);
                  }
                }
              }
            } catch (subError) {
              this.logger.debug(`Could not scan subdirectory ${fullPath}`, { error: subError });
            }
          }
        }
      }

      // Now check for orphaned routes (routes without deployment folders)
      const orphanedDeployments = await this.checkOrphanedRoutes();
      deployments.push(...orphanedDeployments);
    } catch (error) {
      this.logger.error("Error collecting deployment statuses", { error });
    }

    return deployments;
  }
  
  private async hasDeploymentConfig(path: string): Promise<boolean> {
    try {
      await stat(join(path, "deploy.yaml"));
      return true;
    } catch {
      try {
        await stat(join(path, "deploy.json"));
        return true;
      } catch {
        return false;
      }
    }
  }

  private async getDeploymentStatus(
    name: string,
    deploymentDir: string
  ): Promise<DeploymentStatus> {
    const status: DeploymentStatus = {
      name,
      status: "pending",
      timestamp: new Date().toISOString(),
    };

    try {
      // Check for markers
      const deployedMarker = join(deploymentDir, ".deployed");
      const failedMarker = join(deploymentDir, ".failed");

      try {
        const deployedStat = await stat(deployedMarker);
        status.status = "success";
        status.timestamp = deployedStat.mtime.toISOString();

        // Try to get additional info from the marker
        const fs = require("fs").promises;
        const markerContent = await fs.readFile(deployedMarker, "utf-8");
        const markerData = JSON.parse(markerContent);
        if (markerData.config) {
          status.framework = markerData.config.framework;
          status.customerId = markerData.config.customerId;
          status.domains = Array.isArray(markerData.config.domain)
            ? markerData.config.domain
            : [markerData.config.domain];
          status.mode = markerData.config.mode || 'production';
        }
      } catch {
        try {
          const failedStat = await stat(failedMarker);
          status.status = "failed";
          status.timestamp = failedStat.mtime.toISOString();

          // Try to get error info
          const fs = require("fs").promises;
          const markerContent = await fs.readFile(failedMarker, "utf-8");
          const markerData = JSON.parse(markerContent);
          
          // Handle both old format (single object) and new format (array)
          if (Array.isArray(markerData)) {
            // Get the most recent error (last in array)
            const latestError = markerData[markerData.length - 1];
            status.error = latestError.error || "Unknown error";
          } else {
            // Old format
            status.error = markerData.error || "Unknown error";
          }
        } catch {
          // No markers, check if currently processing
          if (this.processingDeployments.has(name)) {
            status.status = "building";
          }
        }
      }

      // Check for deploy config to get framework info
      try {
        const fs = require("fs").promises;
        const deployConfig = join(deploymentDir, "deploy.yaml");
        const configContent = await fs.readFile(deployConfig, "utf-8");
        const { parse: parseYaml } = require("yaml");
        const config = parseYaml(configContent);

        status.framework = config.framework;
        status.customerId = config.customerId;
        status.domains = Array.isArray(config.domain)
          ? config.domain
          : [config.domain];
        status.mode = config.mode || 'production';
      } catch {
        // Try JSON config
        try {
          const fs = require("fs").promises;
          const deployConfig = join(deploymentDir, "deploy.json");
          const configContent = await fs.readFile(deployConfig, "utf-8");
          const config = JSON.parse(configContent);

          status.framework = config.framework;
          status.customerId = config.customerId;
          status.domains = Array.isArray(config.domain)
            ? config.domain
            : [config.domain];
          status.mode = config.mode || 'production';
        } catch {
          // No config found
        }
      }

      // Try to get package.json info
      try {
        const fs = require("fs").promises;
        const packageJsonPath = join(deploymentDir, "package.json");
        const packageContent = await fs.readFile(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(packageContent);
        
        status.packageVersion = packageJson.version;
        
        // Get the run command based on mode
        if (packageJson.scripts) {
          if (status.mode === 'development' && packageJson.scripts.dev) {
            status.runCommand = `npm run dev`;
          } else if (packageJson.scripts.start) {
            status.runCommand = `npm run start`;
          }
        }
      } catch {
        // No package.json or error reading it
      }
    } catch (error) {
      this.logger.error(`Error getting status for ${name}`, { error });
    }

    return status;
  }

  private async scanDeploymentFolder(): Promise<any[]> {
    const items: any[] = [];

    try {
      const entries = await readdir(this.deploymentPath);

      for (const entry of entries) {
        const fullPath = join(this.deploymentPath, entry);
        const stats = await stat(fullPath);

        items.push({
          name: entry,
          type: stats.isDirectory() ? "directory" : "file",
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
      }
    } catch (error) {
      this.logger.error("Error scanning deployment folder", { error });
    }

    return items;
  }

  private async removeMarker(
    deploymentName: string,
    markerName: string
  ): Promise<void> {
    try {
      const markerPath = join(this.deploymentPath, deploymentName, markerName);
      await unlink(markerPath);
    } catch {
      // Marker doesn't exist, which is fine
    }
  }

  private async triggerDeployment(deploymentName: string): Promise<void> {
    const deployYamlPath = join(
      this.deploymentPath,
      deploymentName,
      "deploy.yaml"
    );

    try {
      // Touch the deploy.yaml file to trigger hot deployment
      const fs = require("fs");
      const now = new Date();
      fs.utimesSync(deployYamlPath, now, now);
    } catch (error) {
      this.logger.error(`Error triggering deployment for ${deploymentName}`, {
        error,
      });
      throw error;
    }
  }

  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      const fs = require("fs").promises;
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      this.logger.error(`Error removing directory ${dirPath}`, { error });
      throw error;
    }
  }

  private generateMockLogs(deploymentName: string): string {
    const timestamp = new Date().toISOString();
    const status = this.deploymentStatuses.get(deploymentName);

    return `[${timestamp}] Processing deployment: ${deploymentName}
[${timestamp}] Starting build process...
[${timestamp}] Running npm install --include=dev
[${timestamp}] npm install completed
[${timestamp}] Running npm run build
${
  status?.status === "failed"
    ? `[${timestamp}] Build failed with error:
${status.error || "Unknown error"}
[${timestamp}] Deployment failed`
    : `[${timestamp}] Build completed successfully
[${timestamp}] Deployment successful`
}`;
  }

  public updateDeploymentStatus(name: string, status: DeploymentStatus): void {
    this.deploymentStatuses.set(name, status);
  }

  private async checkOrphanedRoutes(): Promise<DeploymentStatus[]> {
    const orphanedDeployments: DeploymentStatus[] = [];
    
    try {
      // Get all routes from Redis
      const Redis = require('ioredis');
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'keydb',
        port: parseInt(process.env.REDIS_PORT || '16378'),
        password: process.env.REDIS_PASSWORD
      });
      
      const allDomains = await redis.hkeys("spinforge:routes");
      
      for (const domain of allDomains) {
        const routeData = await redis.hget("spinforge:routes", domain);
        if (!routeData) continue;
        
        const route = JSON.parse(routeData);
        
        // Skip if not a deployment from our watched folder
        if (!route.buildPath || !route.buildPath.startsWith(this.deploymentPath)) {
          continue;
        }
        
        // Check if the deployment folder exists
        let folderExists = true;
        try {
          await stat(route.buildPath);
        } catch {
          folderExists = false;
        }
        
        if (!folderExists) {
          // This is an orphaned route
          const deploymentName = route.config?.name || basename(route.buildPath);
          
          orphanedDeployments.push({
            name: deploymentName,
            status: "orphaned",
            timestamp: new Date().toISOString(),
            error: "Deployment folder no longer exists",
            domains: [domain],
            framework: route.framework,
            customerId: route.customerId,
            spinletId: route.spinletId,
            orphaned: true,
            buildPath: route.buildPath
          });
        }
      }
      
      await redis.quit();
    } catch (error) {
      this.logger.error("Error checking orphaned routes", { error });
    }
    
    return orphanedDeployments;
  }

  public markDeploymentAsProcessing(name: string): void {
    this.processingDeployments.add(name);
    this.updateDeploymentStatus(name, {
      name,
      status: "building",
      timestamp: new Date().toISOString(),
    });
  }

  public markDeploymentAsComplete(
    name: string,
    success: boolean,
    error?: string
  ): void {
    this.processingDeployments.delete(name);
    this.updateDeploymentStatus(name, {
      name,
      status: success ? "success" : "failed",
      timestamp: new Date().toISOString(),
      error: error,
    });
  }

  public markDeploymentAsUnhealthy(
    customerId: string,
    domain: string,
    reason: string
  ): void {
    // Log the unhealthy status
    this.logger.warn("Deployment marked as unhealthy", {
      customerId,
      domain,
      reason,
    });
    
    // Find deployment by domain
    for (const [name, status] of this.deploymentStatuses.entries()) {
      if (status.domains?.includes(domain)) {
        this.updateDeploymentStatus(name, {
          ...status,
          status: "unhealthy",
          error: reason,
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }
  }

  private async cleanupOrphanedDeployment(req: Request, res: Response): Promise<void> {
    try {
      const { domain } = req.params;
      
      // Get route info from Redis
      const Redis = require('ioredis');
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'keydb',
        port: parseInt(process.env.REDIS_PORT || '16378'),
        password: process.env.REDIS_PASSWORD
      });
      
      const routeData = await redis.hget("spinforge:routes", domain);
      
      if (!routeData) {
        res.status(404).json({ error: "Route not found" });
        await redis.quit();
        return;
      }
      
      const route = JSON.parse(routeData);
      
      // Remove from routes
      await redis.hdel("spinforge:routes", domain);
      
      // Remove from customer routes if exists
      if (route.customerId) {
        await redis.srem(`spinforge:customer:${route.customerId}:routes`, domain);
      }
      
      // Stop spinlet if it exists
      if (route.spinletId && this.spinletManager) {
        try {
          await this.spinletManager.stop(route.spinletId, "orphaned_cleanup");
        } catch (error) {
          this.logger.warn(`Failed to stop spinlet ${route.spinletId}`, { error });
        }
      }
      
      await redis.quit();
      
      this.logger.info(`Cleaned up orphaned deployment for domain: ${domain}`, {
        customerId: route.customerId,
        spinletId: route.spinletId,
        buildPath: route.buildPath
      });
      
      res.json({ 
        success: true, 
        message: `Orphaned deployment for ${domain} has been cleaned up` 
      });
    } catch (error) {
      this.logger.error(`Error cleaning up orphaned deployment ${req.params.domain}`, { error });
      res.status(500).json({ error: "Failed to cleanup orphaned deployment" });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
