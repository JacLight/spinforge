import { Router, Request, Response } from "express";
import { createLogger } from "@spinforge/shared";
import { HotDeploymentWatcher } from "./HotDeploymentWatcher";
import { readdir, stat, unlink, rmdir } from "fs/promises";
import { join, basename } from "path";
import { RouteManager } from "../RouteManager";
import { SpinletManager } from "@spinforge/spinlet-core";

interface DeploymentStatus {
  name: string;
  status: "pending" | "building" | "success" | "failed" | "processing";
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
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Get all deployment statuses
    this.router.get("/deployments", this.getDeployments.bind(this));

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

  getRouter(): Router {
    return this.router;
  }
}
