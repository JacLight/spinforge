import { Router, Request, Response } from "express";
import { createLogger } from "@spinforge/shared";
import { HotDeploymentWatcher } from "./HotDeploymentWatcher";
import { readdir, stat, unlink, rmdir, mkdir, writeFile, readFile } from "fs/promises";
import { join, basename } from "path";
import { RouteManager } from "../RouteManager";
import { SpinletManager } from "@spinforge/spinlet-core";
import multer from "multer";
import { nanoid } from "nanoid";

interface DeploymentStatus {
  name: string;
  status: "pending" | "building" | "success" | "failed" | "processing" | "unhealthy";
  timestamp: string;
  error?: string;
  buildTime?: number;
  domains?: string[];
  framework?: string;
  customerId?: string;
  spinletId?: string;
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

      // Move uploaded file to deployment directory
      const deploymentDir = join(this.deploymentPath, deploymentId);
      await mkdir(deploymentDir, { recursive: true });
      
      const archivePath = join(deploymentDir, file.originalname);
      const fs = require('fs').promises;
      await fs.rename(file.path, archivePath);

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

  private async getDeployments(req: Request, res: Response): Promise<void> {
    try {
      // Get deployment statuses from files and running processes
      const deployments = await this.collectDeploymentStatuses();
      res.json(deployments);
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
      const deploymentDir = join(this.deploymentPath, name);

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
      const entries = await readdir(this.deploymentPath);

      for (const entry of entries) {
        const deploymentDir = join(this.deploymentPath, entry);
        const stats = await stat(deploymentDir);

        if (stats.isDirectory()) {
          const status = await this.getDeploymentStatus(entry, deploymentDir);
          deployments.push(status);
        }
      }
    } catch (error) {
      this.logger.error("Error collecting deployment statuses", { error });
    }

    return deployments;
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
          status.error = markerData.error || "Unknown error";
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
        } catch {
          // No config found
        }
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

  getRouter(): Router {
    return this.router;
  }
}
