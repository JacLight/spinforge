import { Router, Request, Response } from "express";
import { createLogger } from "@spinforge/shared";
import { SpinletManager } from "@spinforge/spinlet-core";
import { RouteManager } from "../RouteManager";
import { DeploymentAPI } from "../deployment/DeploymentAPI";
import Redis from "ioredis";
import multer from "multer";
import { join } from "path";
import { nanoid } from "nanoid";
import { mkdir, stat } from "fs/promises";

interface AuthenticatedRequest extends Request {
  customerId?: string;
}

export class CustomerAPI {
  private router: Router;
  private logger = createLogger("CustomerAPI");
  private spinletManager: SpinletManager;
  private routeManager: RouteManager;
  private deploymentAPI: DeploymentAPI | undefined;
  private redis: Redis;
  private upload: multer.Multer;

  constructor(
    spinletManager: SpinletManager,
    routeManager: RouteManager,
    redis: Redis,
    deploymentAPI?: DeploymentAPI
  ) {
    this.spinletManager = spinletManager;
    this.routeManager = routeManager;
    this.redis = redis;
    this.deploymentAPI = deploymentAPI;
    this.router = Router();

    // Configure multer for file uploads
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const deploymentPath =
          process.env.DEPLOYMENT_PATH || "/tmp/deployments";
        const uploadDir = join(deploymentPath, ".uploads");
        await mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniquePrefix = nanoid(8);
        cb(null, `${uniquePrefix}-${file.originalname}`);
      },
    });

    this.upload = multer({
      storage,
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max
      },
    });

    // Customer authentication middleware
    this.router.use(this.authenticateCustomer.bind(this));

    this.setupRoutes();
  }

  private async authenticateCustomer(
    req: AuthenticatedRequest,
    res: Response,
    next: Function
  ): Promise<void> {
    const customerId = req.headers["x-customer-id"] as string;
    const authToken =
      req.headers["authorization"]?.replace("Bearer ", "") ||
      (req.headers["x-auth-token"] as string);

    if (!customerId || !authToken) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // TODO: Validate auth token against customer ID
    // For now, just ensure both are present
    req.customerId = customerId;
    next();
  }

  private setupRoutes(): void {
    // Customer's own deployments
    this.router.get("/deployments", this.getCustomerDeployments.bind(this));

    // Customer's spinlets
    this.router.get("/spinlets", this.getCustomerSpinlets.bind(this));

    // Customer's routes/domains
    this.router.get("/domains", this.getCustomerDomains.bind(this));

    // Customer's resource usage
    this.router.get("/usage", this.getCustomerUsage.bind(this));

    // Deploy new application
    this.router.post("/deploy", this.deployApplication.bind(this));

    // Upload deployment archive
    this.router.post(
      "/deployments/upload",
      this.upload.single("archive"),
      this.uploadDeployment.bind(this)
    );

    // File sync for watch mode
    this.router.post(
      "/deployments/:name/sync",
      this.upload.array("files", 100),
      this.syncFiles.bind(this)
    );

    // Manage specific deployment
    this.router.get("/deployments/:name", this.getDeployment.bind(this));
    this.router.delete("/deployments/:name", this.deleteDeployment.bind(this));

    // Manage specific spinlet
    this.router.post("/spinlets/:id/stop", this.stopSpinlet.bind(this));
    this.router.post("/spinlets/:id/restart", this.restartSpinlet.bind(this));
    this.router.get("/spinlets/:id/logs", this.getSpinletLogs.bind(this));
  }

  private async getCustomerDeployments(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;

      // Get deployment statuses from files and running processes (like the server does)
      const allDeployments =
        await this.collectCustomerDeploymentStatuses(customerId);

      res.json(allDeployments);
    } catch (error) {
      this.logger.error("Error fetching customer deployments", { error });
      res.status(500).json({ error: "Failed to fetch deployments" });
    }
  }

  private async collectCustomerDeploymentStatuses(
    customerId: string
  ): Promise<any[]> {
    const deployments: any[] = [];
    const deploymentPath =
      process.env.HOT_DEPLOYMENT_PATH || "/spinforge/deployments";

    try {
      const fs = require("fs").promises;
      const { readdir, stat } = fs;

      // First, check customer-specific folder
      const customerPath = join(deploymentPath, customerId);
      try {
        const customerStats = await stat(customerPath);
        if (customerStats.isDirectory()) {
          const customerEntries = await readdir(customerPath);
          
          for (const entry of customerEntries) {
            if (entry.startsWith(".")) continue;
            
            const deploymentDir = join(customerPath, entry);
            const stats = await stat(deploymentDir);
            
            if (stats.isDirectory()) {
              const status = await this.getCustomerDeploymentStatus(
                `${customerId}/${entry}`,
                deploymentDir,
                customerId
              );
              
              if (status) {
                deployments.push(status);
              }
            }
          }
        }
      } catch (error) {
        // Customer folder doesn't exist yet, that's OK
        this.logger.debug(`Customer folder ${customerId} not found`);
      }

      // Also check root folder for backward compatibility
      const entries = await readdir(deploymentPath);

      for (const entry of entries) {
        // Skip non-directories and uploads folder
        if (entry.startsWith(".")) continue;

        const deploymentDir = join(deploymentPath, entry);
        const stats = await stat(deploymentDir);

        if (stats.isDirectory() && entry !== customerId) {
          // Check if this is a deployment directory (not a customer folder)
          const hasDeployConfig = await this.hasDeploymentConfig(deploymentDir);
          
          if (hasDeployConfig) {
            const status = await this.getCustomerDeploymentStatus(
              entry,
              deploymentDir,
              customerId
            );

            // Only include deployments that belong to this customer
            if (status && status.customerId === customerId) {
              deployments.push(status);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error("Error collecting customer deployment statuses", {
        error,
      });
    }

    return deployments;
  }
  
  private async hasDeploymentConfig(path: string): Promise<boolean> {
    try {
      const fs = require("fs").promises;
      await fs.stat(join(path, "deploy.yaml"));
      return true;
    } catch {
      try {
        const fs = require("fs").promises;
        await fs.stat(join(path, "deploy.json"));
        return true;
      } catch {
        return false;
      }
    }
  }

  private async getCustomerDeploymentStatus(
    name: string,
    deploymentDir: string,
    customerId: string
  ): Promise<any | null> {
    const status: any = {
      name,
      status: "pending",
      timestamp: new Date().toISOString(),
    };

    try {
      const fs = require("fs").promises;

      // Check for markers (like the server does)
      const deployedMarker = join(deploymentDir, ".deployed");
      const failedMarker = join(deploymentDir, ".failed");

      try {
        const deployedStat = await stat(deployedMarker);
        status.status = "success";
        status.timestamp = deployedStat.mtime.toISOString();

        // Try to get additional info from the marker
        try {
          const markerContent = await fs.readFile(deployedMarker, "utf-8");
          const markerData = JSON.parse(markerContent);
          if (markerData.config) {
            status.framework = markerData.config.framework;
            status.customerId = markerData.config.customerId;
            status.domains = Array.isArray(markerData.config.domain)
              ? markerData.config.domain
              : [markerData.config.domain];
            status.spinletId = markerData.config.spinletId;
          }
        } catch (e) {
          // Marker file might not have JSON content
        }
      } catch {
        try {
          const failedStat = await stat(failedMarker);
          status.status = "failed";
          status.timestamp = failedStat.mtime.toISOString();

          // Try to get error info
          try {
            const markerContent = await fs.readFile(failedMarker, "utf-8");
            const markerData = JSON.parse(markerContent);
            status.error = markerData.error || "Unknown error";
            if (markerData.config) {
              status.customerId = markerData.config.customerId;
              status.framework = markerData.config.framework;
            }
          } catch (e) {
            // Marker file might not have JSON content
          }
        } catch {
          // No markers, check if currently processing
          status.status = "building";
        }
      }

      // Check for deploy config to get framework info (like the server does)
      try {
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
          const deployConfig = join(deploymentDir, "deploy.json");
          const configContent = await fs.readFile(deployConfig, "utf-8");
          const config = JSON.parse(configContent);

          status.framework = config.framework;
          status.customerId = config.customerId;
          status.domains = Array.isArray(config.domain)
            ? config.domain
            : [config.domain];
        } catch {
          // No config found, might not belong to this customer
          return null;
        }
      }

      // Only return if this deployment belongs to the customer
      if (status.customerId !== customerId) {
        return null;
      }
    } catch (error) {
      this.logger.error(`Error getting status for ${name}`, { error });
      return null;
    }

    return status;
  }

  private async getCustomerSpinlets(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;

      // Get all spinlet states and filter by customer
      const allStates = (this.spinletManager as any).states as Map<string, any>;
      const customerSpinlets: any[] = [];

      for (const [spinletId, state] of allStates) {
        if (state.customerId === customerId) {
          customerSpinlets.push({
            spinletId: state.spinletId,
            customerId: state.customerId,
            pid: state.pid,
            port: state.port,
            state: state.state,
            startTime: state.startTime,
            lastAccess: state.lastAccess || Date.now(),
            requests: state.requests || 0,
            errors: state.errors || 0,
            memory: state.memoryUsage || 0,
            cpu: state.cpuUsage || 0,
            host: state.host || "localhost",
            servicePath: state.servicePath,
            domains: state.domains || [],
          });
        }
      }

      res.json(customerSpinlets);
    } catch (error) {
      this.logger.error("Error fetching customer spinlets", { error });
      res.status(500).json({ error: "Failed to fetch spinlets" });
    }
  }

  private async getCustomerDomains(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;

      // Get all routes/domains for this customer
      const allRoutes = await this.routeManager.getAllRoutes();
      const customerDomains: any[] = [];

      for (const [domain, route] of Object.entries(allRoutes)) {
        if (route.customerId === customerId) {
          customerDomains.push({
            domain,
            spinletId: route.spinletId,
            status: "active",
          } as any);
        }
      }

      res.json(customerDomains);
    } catch (error) {
      this.logger.error("Error fetching customer domains", { error });
      res.status(500).json({ error: "Failed to fetch domains" });
    }
  }

  private async getCustomerUsage(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;

      // Calculate resource usage for customer
      const allStates = (this.spinletManager as any).states as Map<string, any>;
      const customerSpinlets: any[] = [];

      for (const [spinletId, state] of allStates) {
        if (state.customerId === customerId) {
          customerSpinlets.push(state);
        }
      }

      let totalMemory = 0;
      let totalCpu = 0;
      let activeSpinlets = 0;

      for (const spinlet of customerSpinlets) {
        if (spinlet.state === "running") {
          activeSpinlets++;
          // Parse memory (e.g., "512MB" -> 512)
          const memory = parseInt(
            spinlet.resources?.memory || spinlet.memory || "0"
          );
          totalMemory += memory;
          totalCpu += spinlet.resources?.cpu || spinlet.cpu || 0;
        }
      }

      res.json({
        activeSpinlets,
        totalMemory: `${totalMemory}MB`,
        totalCpu,
        spinletCount: customerSpinlets.length,
      });
    } catch (error) {
      this.logger.error("Error fetching customer usage", { error });
      res.status(500).json({ error: "Failed to fetch usage" });
    }
  }

  private async deployApplication(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;

      // Ensure deployment belongs to this customer
      const deploymentData = {
        ...req.body,
        customerId, // Override any provided customer ID
      };

      // TODO: Implement deployment logic
      res.json({
        success: true,
        message: "Deployment queued",
        customerId,
      });
    } catch (error) {
      this.logger.error("Error deploying application", { error });
      res.status(500).json({ error: "Failed to deploy application" });
    }
  }

  private async getDeployment(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;
      const { name } = req.params;

      // Get deployment from Redis
      const deployment = await this.redis.hgetall(
        `spinforge:deployments:${customerId}:${name}`
      );

      if (!deployment.name) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }

      res.json({
        name: deployment.name,
        status: deployment.status,
        framework: deployment.framework,
        domains: deployment.domains ? JSON.parse(deployment.domains) : [],
        createdAt: deployment.createdAt,
        error: deployment.error,
      });
    } catch (error) {
      this.logger.error("Error fetching deployment", { error });
      res.status(500).json({ error: "Failed to fetch deployment" });
    }
  }

  private async deleteDeployment(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;
      const { name } = req.params;

      // Verify deployment belongs to customer
      const deployment = await this.redis.hgetall(
        `spinforge:deployments:${customerId}:${name}`
      );

      if (!deployment.name) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }

      // TODO: Actually delete deployment and stop spinlets
      await this.redis.del(`spinforge:deployments:${customerId}:${name}`);

      res.json({ success: true });
    } catch (error) {
      this.logger.error("Error deleting deployment", { error });
      res.status(500).json({ error: "Failed to delete deployment" });
    }
  }

  private async stopSpinlet(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;
      const { id } = req.params;

      // Get spinlet and verify ownership
      const state = await (this.spinletManager as any).getState(id);
      if (!state || state.customerId !== customerId) {
        res.status(404).json({ error: "Spinlet not found" });
        return;
      }

      await (this.spinletManager as any).stop(id, "customer-request");
      res.json({ success: true });
    } catch (error) {
      this.logger.error("Error stopping spinlet", { error });
      res.status(500).json({ error: "Failed to stop spinlet" });
    }
  }

  private async restartSpinlet(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;
      const { id } = req.params;

      // Get spinlet and verify ownership
      const state = await (this.spinletManager as any).getState(id);
      if (!state || state.customerId !== customerId) {
        res.status(404).json({ error: "Spinlet not found" });
        return;
      }

      // Stop and respawn
      await (this.spinletManager as any).stop(id, "restart");
      // The hot deployment watcher should handle respawning
      res.json({ success: true });
    } catch (error) {
      this.logger.error("Error restarting spinlet", { error });
      res.status(500).json({ error: "Failed to restart spinlet" });
    }
  }

  private async getSpinletLogs(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;
      const { id } = req.params;
      const lines = parseInt(req.query.lines as string) || 100;

      // Get spinlet and verify ownership
      const state = await (this.spinletManager as any).getState(id);
      if (!state || state.customerId !== customerId) {
        res.status(404).json({ error: "Spinlet not found" });
        return;
      }

      // For now, return empty logs
      // TODO: Implement actual log retrieval
      const logs = `[${new Date().toISOString()}] Spinlet ${id} logs\n[${new Date().toISOString()}] No logs available`;
      res.json({ logs });
    } catch (error) {
      this.logger.error("Error fetching spinlet logs", { error });
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  }

  private async uploadDeployment(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      // Ensure deployment belongs to this customer
      const config = JSON.parse(req.body.config || "{}");
      config.customerId = customerId; // Override any provided customer ID

      // Delegate to deployment API if available
      if (this.deploymentAPI) {
        req.body.config = JSON.stringify(config);
        req.headers["x-customer-id"] = customerId;
        await (this.deploymentAPI as any).uploadDeployment(req, res);
      } else {
        res.status(500).json({ error: "Deployment service unavailable" });
      }
    } catch (error) {
      this.logger.error("Error uploading deployment", { error });
      res.status(500).json({ error: "Failed to upload deployment" });
    }
  }

  private async syncFiles(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const customerId = req.customerId!;
      const { name } = req.params;

      // Verify deployment belongs to customer
      const deployment = await this.redis.hgetall(
        `spinforge:deployments:${customerId}:${name}`
      );

      if (!deployment.name) {
        res.status(404).json({ error: "Deployment not found" });
        return;
      }

      // Delegate to deployment API if available
      if (this.deploymentAPI) {
        req.headers["x-customer-id"] = customerId;
        await (this.deploymentAPI as any).syncFiles(req, res);
      } else {
        res.status(500).json({ error: "Deployment service unavailable" });
      }
    } catch (error) {
      this.logger.error("Error syncing files", { error });
      res.status(500).json({ error: "Failed to sync files" });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
