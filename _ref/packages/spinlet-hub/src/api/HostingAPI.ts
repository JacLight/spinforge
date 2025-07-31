import { Router, Request, Response } from "express";
import { promises as fs } from "fs";
import { join } from "path";
import Redis from "ioredis";
import { RouteManager } from "../RouteManager";
import { SpinletManager } from "@spinforge/spinlet-core";
import { createLogger } from "@spinforge/shared";

export interface HostingInfo {
  domain: string;
  customerId: string;
  spinletId: string;
  framework: string;
  status: {
    redis: boolean;
    deploymentFolder: boolean;
    webRootFolder: boolean;
    spinletRunning: boolean;
    issues: string[];
  };
  paths: {
    deploymentPath?: string;
    webRootPath?: string;
    actualDeploymentPath?: string;
    actualWebRootPath?: string;
  };
  proxy?: {
    isProxy: boolean;
    target?: string;
    config?: any;
  };
  spinlet?: {
    state: string;
    port?: number;
    pid?: number;
    memory?: number;
    cpu?: number;
  };
}

export interface DeploymentComparison {
  deploymentFolders: {
    path: string;
    customerId: string;
    appName: string;
    hasConfig: boolean;
    size?: number;
  }[];
  webRootFolders: {
    path: string;
    customerId: string;
    appName: string;
    size?: number;
  }[];
  redisRoutes: {
    domain: string;
    customerId: string;
    spinletId: string;
    framework: string;
  }[];
  mismatches: {
    type: "missing_deployment" | "missing_webroot" | "missing_route" | "orphaned_folder";
    description: string;
    details: any;
  }[];
}

export class HostingAPI {
  private router: Router;
  private logger = createLogger("HostingAPI");
  private deploymentPath: string;
  private webRootPath: string;

  constructor(
    private redis: Redis,
    private routeManager: RouteManager,
    private spinletManager: SpinletManager,
    deploymentPath: string = process.env.DEPLOYMENT_PATH || "/spinforge/deployments",
    webRootPath: string = process.env.WEB_ROOT_PATH || "/spinforge/web_root"
  ) {
    this.router = Router();
    this.deploymentPath = deploymentPath;
    this.webRootPath = webRootPath;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Get all hosting information
    this.router.get("/", async (req: Request, res: Response) => {
      try {
        const hostingInfo = await this.getAllHostingInfo();
        res.json(hostingInfo);
      } catch (error) {
        this.logger.error("Failed to get hosting info", { error });
        res.status(500).json({ error: "Failed to get hosting information" });
      }
    });

    // Get deployment comparison
    this.router.get("/comparison", async (req: Request, res: Response) => {
      try {
        const comparison = await this.getDeploymentComparison();
        res.json(comparison);
      } catch (error) {
        this.logger.error("Failed to get deployment comparison", { error });
        res.status(500).json({ error: "Failed to get deployment comparison" });
      }
    });

    // Get hosting info for specific domain
    this.router.get("/domain/:domain", async (req: Request, res: Response) => {
      try {
        const info = await this.getHostingInfoForDomain(req.params.domain);
        if (!info) {
          res.status(404).json({ error: "Domain not found" });
          return;
        }
        res.json(info);
      } catch (error) {
        this.logger.error("Failed to get domain hosting info", { error });
        res.status(500).json({ error: "Failed to get domain information" });
      }
    });

    // Fix hosting issues
    this.router.post("/fix/:domain", async (req: Request, res: Response) => {
      try {
        const result = await this.fixHostingIssues(req.params.domain);
        res.json(result);
      } catch (error) {
        this.logger.error("Failed to fix hosting issues", { error });
        res.status(500).json({ error: "Failed to fix hosting issues" });
      }
    });

    // Sync web root from deployment
    this.router.post("/sync/:spinletId", async (req: Request, res: Response) => {
      try {
        const result = await this.syncWebRoot(req.params.spinletId);
        res.json(result);
      } catch (error) {
        this.logger.error("Failed to sync web root", { error });
        res.status(500).json({ error: "Failed to sync web root" });
      }
    });
  }

  private async getAllHostingInfo(): Promise<HostingInfo[]> {
    const allDomains = await this.redis.hkeys("spinforge:routes");
    const hostingInfos: HostingInfo[] = [];

    for (const domain of allDomains) {
      const info = await this.getHostingInfoForDomain(domain);
      if (info) {
        hostingInfos.push(info);
      }
    }

    return hostingInfos;
  }

  private async getHostingInfoForDomain(domain: string): Promise<HostingInfo | null> {
    const route = await this.routeManager.getRoute(domain);
    if (!route) {
      return null;
    }

    const issues: string[] = [];
    const info: HostingInfo = {
      domain,
      customerId: route.customerId,
      spinletId: route.spinletId,
      framework: route.framework,
      status: {
        redis: true,
        deploymentFolder: false,
        webRootFolder: false,
        spinletRunning: false,
        issues
      },
      paths: {
        deploymentPath: route.buildPath,
        webRootPath: this.getExpectedWebRootPath(route.customerId, route.spinletId)
      },
      proxy: this.getProxyInfo(route)
    };

    // Check deployment folder
    if (route.buildPath) {
      try {
        await fs.access(route.buildPath);
        info.status.deploymentFolder = true;
        info.paths.actualDeploymentPath = route.buildPath;
      } catch {
        issues.push(`Deployment folder missing: ${route.buildPath}`);
      }
    } else {
      issues.push("No deployment path in route configuration");
    }

    // Check web root folder (for static/hosted apps)
    if (this.shouldHaveWebRoot(route.framework)) {
      const expectedWebRoot = info.paths.webRootPath!;
      try {
        await fs.access(expectedWebRoot);
        info.status.webRootFolder = true;
        info.paths.actualWebRootPath = expectedWebRoot;
      } catch {
        if (!info.proxy?.isProxy) {
          issues.push(`Web root folder missing: ${expectedWebRoot}`);
        }
      }
    }

    // Check spinlet status (for dynamic apps)
    if (this.shouldHaveSpinlet(route.framework)) {
      const spinletState = await this.spinletManager.getState(route.spinletId);
      if (spinletState) {
        info.status.spinletRunning = spinletState.state === "running";
        info.spinlet = {
          state: spinletState.state,
          port: spinletState.port,
          pid: spinletState.pid,
          memory: spinletState.memory,
          cpu: spinletState.cpu
        };
        
        if (spinletState.state !== "running") {
          issues.push(`Spinlet is ${spinletState.state}`);
        }
      } else {
        issues.push("Spinlet not found");
      }
    }

    info.status.issues = issues;
    return info;
  }

  private async getDeploymentComparison(): Promise<DeploymentComparison> {
    const comparison: DeploymentComparison = {
      deploymentFolders: [],
      webRootFolders: [],
      redisRoutes: [],
      mismatches: []
    };

    // Get all deployment folders
    try {
      const customers = await fs.readdir(this.deploymentPath);
      for (const customerId of customers) {
        const customerPath = join(this.deploymentPath, customerId);
        const stat = await fs.stat(customerPath);
        if (stat.isDirectory()) {
          const apps = await fs.readdir(customerPath);
          for (const appName of apps) {
            const appPath = join(customerPath, appName);
            const appStat = await fs.stat(appPath);
            if (appStat.isDirectory()) {
              const hasConfig = await this.hasDeployConfig(appPath);
              comparison.deploymentFolders.push({
                path: appPath,
                customerId,
                appName,
                hasConfig,
                size: await this.getDirectorySize(appPath)
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.error("Failed to read deployment folders", { error });
    }

    // Get all web root folders
    try {
      const customers = await fs.readdir(this.webRootPath);
      for (const customerId of customers) {
        if (customerId === "shared") continue;
        
        const customerPath = join(this.webRootPath, customerId);
        const stat = await fs.stat(customerPath);
        if (stat.isDirectory()) {
          const apps = await fs.readdir(customerPath);
          for (const appName of apps) {
            const appPath = join(customerPath, appName);
            const appStat = await fs.stat(appPath);
            if (appStat.isDirectory()) {
              comparison.webRootFolders.push({
                path: appPath,
                customerId,
                appName,
                size: await this.getDirectorySize(appPath)
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.error("Failed to read web root folders", { error });
    }

    // Get all Redis routes
    const allDomains = await this.redis.hkeys("spinforge:routes");
    for (const domain of allDomains) {
      const route = await this.routeManager.getRoute(domain);
      if (route) {
        comparison.redisRoutes.push({
          domain,
          customerId: route.customerId,
          spinletId: route.spinletId,
          framework: route.framework
        });
      }
    }

    // Find mismatches
    this.findMismatches(comparison);

    return comparison;
  }

  private findMismatches(comparison: DeploymentComparison): void {
    // Check for routes without deployment folders
    for (const route of comparison.redisRoutes) {
      const deploymentExists = comparison.deploymentFolders.some(
        f => f.customerId === route.customerId && 
            (f.appName === route.spinletId || f.appName === route.spinletId.split('-')[0])
      );
      
      if (!deploymentExists && route.framework !== "reverse-proxy") {
        comparison.mismatches.push({
          type: "missing_deployment",
          description: `Route ${route.domain} has no deployment folder`,
          details: route
        });
      }
    }

    // Check for static apps without web root
    for (const route of comparison.redisRoutes) {
      if (this.shouldHaveWebRoot(route.framework)) {
        const webRootExists = comparison.webRootFolders.some(
          f => f.customerId === route.customerId && 
               (f.appName === route.spinletId || f.appName === route.spinletId.split('-')[0])
        );
        
        if (!webRootExists) {
          comparison.mismatches.push({
            type: "missing_webroot",
            description: `Static app ${route.domain} has no web root folder`,
            details: route
          });
        }
      }
    }

    // Check for orphaned deployment folders
    for (const folder of comparison.deploymentFolders) {
      const hasRoute = comparison.redisRoutes.some(
        r => r.customerId === folder.customerId && 
             (r.spinletId === folder.appName || r.spinletId.startsWith(folder.appName + '-'))
      );
      
      if (!hasRoute) {
        comparison.mismatches.push({
          type: "orphaned_folder",
          description: `Deployment folder has no route: ${folder.path}`,
          details: folder
        });
      }
    }

    // Check for orphaned web root folders
    for (const folder of comparison.webRootFolders) {
      const hasRoute = comparison.redisRoutes.some(
        r => r.customerId === folder.customerId && 
             (r.spinletId === folder.appName || r.spinletId.startsWith(folder.appName + '-'))
      );
      
      if (!hasRoute) {
        comparison.mismatches.push({
          type: "orphaned_folder",
          description: `Web root folder has no route: ${folder.path}`,
          details: folder
        });
      }
    }
  }

  private async fixHostingIssues(domain: string): Promise<any> {
    const info = await this.getHostingInfoForDomain(domain);
    if (!info) {
      throw new Error("Domain not found");
    }

    const fixes: string[] = [];

    // Fix missing web root
    if (!info.status.webRootFolder && this.shouldHaveWebRoot(info.framework)) {
      try {
        await this.syncWebRoot(info.spinletId);
        fixes.push("Created missing web root folder and synced files");
      } catch (error) {
        this.logger.error("Failed to sync web root", { error });
      }
    }

    // Fix stopped spinlet
    if (!info.status.spinletRunning && this.shouldHaveSpinlet(info.framework)) {
      try {
        const route = await this.routeManager.getRoute(domain);
        if (route) {
          await this.spinletManager.spawn({
            spinletId: info.spinletId,
            customerId: info.customerId,
            buildPath: route.buildPath,
            framework: info.framework as any,
            domains: [domain]
          });
          fixes.push("Restarted stopped spinlet");
        }
      } catch (error) {
        this.logger.error("Failed to restart spinlet", { error });
      }
    }

    return {
      domain,
      fixesApplied: fixes,
      success: fixes.length > 0
    };
  }

  private async syncWebRoot(spinletId: string): Promise<any> {
    // This would integrate with WebRootManager
    // For now, return a placeholder
    return {
      success: true,
      message: "Web root sync functionality to be implemented"
    };
  }

  private getProxyInfo(route: any): any {
    if (route.framework === "reverse-proxy") {
      return {
        isProxy: true,
        target: route.config?.proxy?.target || route.config?.proxy,
        config: route.config?.proxy
      };
    }

    if (route.config?.proxy) {
      return {
        isProxy: true,
        config: route.config.proxy
      };
    }

    return {
      isProxy: false
    };
  }

  private shouldHaveWebRoot(framework: string): boolean {
    const staticFrameworks = ["static", "react", "vue", "angular"];
    return staticFrameworks.includes(framework);
  }

  private shouldHaveSpinlet(framework: string): boolean {
    const dynamicFrameworks = ["express", "nestjs", "nextjs", "remix", "fastify"];
    return dynamicFrameworks.includes(framework);
  }

  private getExpectedWebRootPath(customerId: string, spinletId: string): string {
    const appName = spinletId.split('-')[0];
    return join(this.webRootPath, customerId, appName);
  }

  private async hasDeployConfig(path: string): Promise<boolean> {
    try {
      await fs.access(join(path, "deploy.json"));
      return true;
    } catch {
      try {
        await fs.access(join(path, "deploy.yaml"));
        return true;
      } catch {
        return false;
      }
    }
  }

  private async getDirectorySize(path: string): Promise<number> {
    // Simple size calculation - could be improved
    try {
      const files = await fs.readdir(path);
      return files.length;
    } catch {
      return 0;
    }
  }

  getRouter(): Router {
    return this.router;
  }
}