import { watch, FSWatcher } from "fs";
import { readdir, stat, readFile, access, writeFile, rename, unlink, rmdir } from "fs/promises";
import { join, basename, dirname } from "path";
import { createLogger } from "@spinforge/shared";
import { parse as parseYaml } from "yaml";
import { DeploymentConfig } from "./deploy-schema";
import { RouteManager } from "../RouteManager";
import { SpinletManager } from "@spinforge/spinlet-core";
import { extract } from "tar";
import { createReadStream } from "fs";
import { pipeline } from "stream/promises";
import * as unzipper from "unzipper";
import * as decompress from "decompress";

export class HotDeploymentWatcher {
  private watcher?: FSWatcher;
  private logger = createLogger("HotDeploymentWatcher");
  private deploymentPath: string;
  private routeManager: RouteManager;
  private spinletManager: SpinletManager;
  private processingDeployments = new Set<string>();
  private deploymentAPI?: any; // Will be set later
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    deploymentPath: string,
    routeManager: RouteManager,
    spinletManager: SpinletManager
  ) {
    this.deploymentPath = deploymentPath;
    this.routeManager = routeManager;
    this.spinletManager = spinletManager;
  }

  setDeploymentAPI(deploymentAPI: any): void {
    this.deploymentAPI = deploymentAPI;
  }

  async start(): Promise<void> {
    try {
      // Ensure deployment directory exists
      await access(this.deploymentPath);
    } catch {
      this.logger.error(
        `Deployment directory not found: ${this.deploymentPath}`
      );
      return;
    }

    this.logger.info(
      `Starting hot deployment watcher on ${this.deploymentPath}`
    );

    // Clean up orphaned routes first
    await this.cleanupOrphanedRoutes();

    // Initial scan of existing deployments
    await this.scanDeployments();

    // Watch for new deployments
    this.watcher = watch(
      this.deploymentPath,
      { recursive: true },
      async (eventType, filename) => {
        if (!filename) return;

        // Check if it's a deployment trigger
        if (this.isDeploymentTrigger(filename)) {
          const deploymentDir = join(
            this.deploymentPath,
            filename.split("/")[0]
          );
          await this.processDeployment(deploymentDir);
        }
      }
    );

    // Start health check interval (every 1 minute)
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        this.logger.error("Health check failed", { error });
      });
    }, 60000); // 60 seconds

    // Perform initial health check
    await this.performHealthCheck();
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      this.watcher.close();
      this.logger.info("Hot deployment watcher stopped");
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  private isDeploymentTrigger(filename: string): boolean {
    // Trigger on deploy.yaml, deploy.json, or .deploy marker file
    return (
      filename.endsWith("deploy.yaml") ||
      filename.endsWith("deploy.json") ||
      filename.endsWith(".deploy")
    );
  }

  private async scanDeployments(): Promise<void> {
    try {
      const entries = await readdir(this.deploymentPath);

      for (const entry of entries) {
        const fullPath = join(this.deploymentPath, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory() || this.isArchive(entry)) {
          await this.processDeployment(fullPath);
        }
      }
    } catch (error) {
      this.logger.error("Error scanning deployments", { error });
    }
  }

  private isArchive(filename: string): boolean {
    const supportedExtensions = [
      ".zip",
      ".tar",
      ".tar.gz",
      ".tgz",
      ".tar.bz2",
      ".tbz2",
      ".tar.xz",
      ".txz",
      ".rar",
      ".7z",
      ".gz",
      ".bz2",
      ".xz"
    ];
    return supportedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  private async processDeployment(deploymentPath: string): Promise<void> {
    const deploymentId = basename(deploymentPath);

    // Avoid processing the same deployment multiple times
    if (this.processingDeployments.has(deploymentId)) {
      return;
    }

    this.processingDeployments.add(deploymentId);

    try {
      this.logger.info(`Processing deployment: ${deploymentId}`);
      
      // Archive previous .failed marker if it exists
      try {
        const failedMarkerPath = join(deploymentPath, ".failed");
        const stats = await stat(failedMarkerPath);
        if (stats.isFile()) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const archivedPath = join(deploymentPath, `.failed-${timestamp}`);
          await rename(failedMarkerPath, archivedPath);
          this.logger.info(`Archived previous failure marker to ${basename(archivedPath)}`);
        }
      } catch (error) {
        // No previous .failed marker, which is fine
      }
      
      // Update deployment API status if available
      if (this.deploymentAPI) {
        this.deploymentAPI.markDeploymentAsProcessing(deploymentId);
      }

      let actualPath = deploymentPath;

      // Extract archive if needed
      if (this.isArchive(deploymentPath)) {
        actualPath = await this.extractArchive(deploymentPath);
      } else {
        // Check if there's an archive file inside the deployment directory
        const files = await readdir(deploymentPath);
        const archiveFile = files.find(file => this.isArchive(file));
        
        if (archiveFile) {
          const archivePath = join(deploymentPath, archiveFile);
          this.logger.info(`Found archive file in deployment directory: ${archiveFile}`);
          
          // Extract the archive in place
          await this.extractArchive(archivePath);
          
          // Remove the archive file after extraction
          await unlink(archivePath);
          this.logger.info(`Removed archive file after extraction: ${archiveFile}`);
        }
      }

      // Load deployment configuration
      const config = await this.loadDeploymentConfig(actualPath);
      if (!config) {
        this.logger.warn(`No deployment config found in ${deploymentId}`);
        
        // Create failed marker
        await this.createMarker(actualPath, ".failed", {
          timestamp: new Date().toISOString(),
          error: "No deploy.json or deploy.yaml found",
        });
        
        // Update deployment API status
        if (this.deploymentAPI) {
          this.deploymentAPI.markDeploymentAsComplete(
            deploymentId,
            false,
            "No deploy.json or deploy.yaml found"
          );
        }
        
        return;
      }

      // Validate configuration
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        this.logger.error(`Invalid deployment config for ${deploymentId}`, {
          errors: validation.errors,
        });
        
        // Create failed marker with validation errors
        await this.createMarker(actualPath, ".failed", {
          timestamp: new Date().toISOString(),
          error: `Validation failed: ${validation.errors?.join(", ")}`,
          errors: validation.errors,
        });
        
        // Update deployment API status if available
        if (this.deploymentAPI) {
          this.deploymentAPI.markDeploymentAsComplete(
            deploymentId,
            false,
            `Validation failed: ${validation.errors?.join(", ")}`
          );
        }
        
        return;
      }

      // Create deployment
      await this.deploy(config, actualPath);

      // Create success marker
      await this.createMarker(actualPath, ".deployed", {
        timestamp: new Date().toISOString(),
        config,
      });
    } catch (error) {
      this.logger.error(`Failed to process deployment ${deploymentId}`, {
        error,
      });

      // Create error marker
      await this.createMarker(deploymentPath, ".failed", {
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
      
      // Update deployment API status
      if (this.deploymentAPI) {
        this.deploymentAPI.markDeploymentAsComplete(
          deploymentId,
          false,
          (error as Error).message
        );
      }
    } finally {
      this.processingDeployments.delete(deploymentId);
    }
  }

  private async extractArchive(archivePath: string): Promise<string> {
    const filename = basename(archivePath).toLowerCase();
    const isFullPath = this.isArchive(archivePath);
    
    // Determine extract path based on whether it's a full archive path or archive inside directory
    const extractPath = isFullPath 
      ? archivePath.replace(/\.(zip|tar|tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz|txz|rar|7z|gz|bz2|xz)$/i, "")
      : join(dirname(archivePath), 'extracted');

    // If extracting in the same directory, use the parent directory
    const finalExtractPath = isFullPath ? extractPath : dirname(archivePath);

    try {
      // Use decompress for most formats - it handles many formats automatically
      if (filename.endsWith(".tar") || filename.endsWith(".tar.gz") || filename.endsWith(".tgz") ||
          filename.endsWith(".tar.bz2") || filename.endsWith(".tbz2") || 
          filename.endsWith(".tar.xz") || filename.endsWith(".txz")) {
        // Use native tar for tar-based archives for better compatibility
        await extract({
          file: archivePath,
          cwd: finalExtractPath,
          strip: 1, // Remove top-level directory
        });
      } else if (filename.endsWith(".zip")) {
        // Use unzipper for zip files for streaming support
        // First extract to a temp directory to inspect structure
        const tempPath = `${finalExtractPath}_temp`;
        await pipeline(
          createReadStream(archivePath),
          unzipper.Extract({ path: tempPath })
        );
        
        // Check if there's a single root directory
        const tempFiles = await readdir(tempPath);
        if (tempFiles.length === 1) {
          const firstItem = join(tempPath, tempFiles[0]);
          const stats = await stat(firstItem);
          if (stats.isDirectory()) {
            // Move contents of the single directory to final path
            const contents = await readdir(firstItem);
            for (const item of contents) {
              await rename(join(firstItem, item), join(finalExtractPath, item));
            }
            // Clean up temp directory
            await rmdir(firstItem);
            await rmdir(tempPath);
          } else {
            // Single file or multiple items at root - move everything
            await rename(tempPath, finalExtractPath);
          }
        } else {
          // Multiple items at root - move everything
          for (const item of tempFiles) {
            await rename(join(tempPath, item), join(finalExtractPath, item));
          }
          await rmdir(tempPath);
        }
      } else {
        // Use decompress for other formats (rar, 7z, gz, bz2, xz)
        await decompress(archivePath, finalExtractPath, {
          strip: 1 // Remove top-level directory
        });
      }

      this.logger.info(`Successfully extracted archive: ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to extract archive: ${filename}`, { error });
      throw new Error(`Unsupported or corrupted archive format: ${filename}`);
    }

    return finalExtractPath;
  }

  private async loadDeploymentConfig(
    deploymentPath: string
  ): Promise<DeploymentConfig | null> {
    // Try deploy.yaml first
    try {
      const yamlPath = join(deploymentPath, "deploy.yaml");
      const content = await readFile(yamlPath, "utf-8");
      return parseYaml(content) as DeploymentConfig;
    } catch {
      // Try deploy.json
      try {
        const jsonPath = join(deploymentPath, "deploy.json");
        const content = await readFile(jsonPath, "utf-8");
        return JSON.parse(content) as DeploymentConfig;
      } catch {
        return null;
      }
    }
  }

  private validateConfig(config: DeploymentConfig): {
    valid: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];

    if (!config.name) errors.push("name is required");
    if (!config.domain) errors.push("domain is required");
    if (!config.customerId) errors.push("customerId is required");
    if (!config.framework) errors.push("framework is required");
    
    // Validate reverse-proxy specific config
    if (config.framework === 'reverse-proxy') {
      if (!config.proxy?.target) {
        errors.push("proxy.target is required for reverse-proxy framework");
      } else {
        // Validate target URL format
        try {
          new URL(config.proxy.target);
        } catch {
          errors.push(`Invalid proxy target URL: ${config.proxy.target}`);
        }
      }
    }

    // Validate domain format
    const domains = Array.isArray(config.domain)
      ? config.domain
      : [config.domain];
    for (const domain of domains) {
      if (!/^[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(domain)) {
        errors.push(`Invalid domain format: ${domain}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private async deploy(
    config: DeploymentConfig,
    buildPath: string
  ): Promise<void> {
    const domains = Array.isArray(config.domain)
      ? config.domain
      : [config.domain];
    const spinletId = `${config.name}-${Date.now()}`;

    // Run pre-deploy hooks
    if (config.hooks?.preDeploy) {
      await this.runHooks(config.hooks.preDeploy, buildPath);
    }

    // Build if needed
    if (config.build?.command) {
      await this.runBuildCommand(
        config.build.command,
        buildPath,
        config.build.env
      );
    }

    // Determine actual build output path
    const outputPath = config.build?.outputDir
      ? join(buildPath, config.build.outputDir)
      : buildPath;

    // Handle static and reverse-proxy deployments differently
    if (config.framework === 'static' || config.framework === 'reverse-proxy') {
      // For static sites, validate that the output directory exists and has files
      if (config.framework === 'static') {
        try {
          const outputStats = await stat(outputPath);
          if (!outputStats.isDirectory()) {
            throw new Error(`Output path is not a directory: ${outputPath}`);
          }
          
          // Check if directory has any files
          const files = await readdir(outputPath);
          if (files.length === 0) {
            throw new Error(`Output directory is empty: ${outputPath}`);
          }
          
          // Check for common static files (including in subdirectories)
          let hasIndexFile = false;
          const checkForIndex = async (dir: string, depth: number = 0): Promise<boolean> => {
            if (depth > 2) return false; // Don't go too deep
            
            const items = await readdir(dir);
            for (const item of items) {
              const itemPath = join(dir, item);
              const itemStats = await stat(itemPath);
              
              if (itemStats.isFile() && (
                item.toLowerCase() === 'index.html' || 
                item.toLowerCase() === 'index.htm' ||
                item.toLowerCase() === 'home.html'
              )) {
                return true;
              } else if (itemStats.isDirectory() && depth < 2) {
                if (await checkForIndex(itemPath, depth + 1)) {
                  return true;
                }
              }
            }
            return false;
          };
          
          hasIndexFile = await checkForIndex(outputPath);
          
          if (!hasIndexFile) {
            throw new Error(`No index.html found in ${outputPath} or its subdirectories. Static deployment requires an index.html file.`);
          }
          
          this.logger.info(`Static deployment validation passed for ${outputPath}`);
        } catch (error) {
          throw new Error(`Static deployment validation failed: ${(error as Error).message}`);
        }
      }
      
      // For static sites and reverse proxies, we don't need to spawn a spinlet
      // Just register the routes
      for (const domain of domains) {
        // Check if domain already exists
        const existingRoute = await this.routeManager.getRoute(domain);
        if (existingRoute) {
          throw new Error(`Domain ${domain} is already in use by another application`);
        }
        
        await this.routeManager.addRoute({
          domain,
          customerId: config.customerId,
          spinletId: `${config.framework}-${config.name}`, // Framework prefix for identification
          buildPath: outputPath,
          framework: config.framework,
          config: {
            memory: config.resources?.memory || '128MB',
            cpu: config.resources?.cpu?.toString() || '0.1',
            env: config.env,
            proxy: config.proxy, // Include proxy config for reverse-proxy
            ...config,
          },
        });
      }
      
      this.logger.info(`${config.framework} deployment registered for ${config.name}`, {
        domains,
        buildPath: outputPath,
        ...(config.framework === 'reverse-proxy' && { proxyTarget: config.proxy?.target }),
      });
    } else {
      // For other frameworks, spawn a spinlet
      await this.spinletManager.spawn({
        spinletId,
        customerId: config.customerId,
        buildPath: outputPath,
        framework: config.framework,
        env: config.env,
        resources: {
          memory: config.resources?.memory,
          cpu: config.resources?.cpu?.toString(),
        },
      });

      // Register routes for all domains
      for (const domain of domains) {
        // Check if domain already exists
        const existingRoute = await this.routeManager.getRoute(domain);
        if (existingRoute) {
          // If we already spawned the spinlet, we need to stop it
          await this.spinletManager.stop(spinletId, "deployment_failed");
          throw new Error(`Domain ${domain} is already in use by another application`);
        }
        
        await this.routeManager.addRoute({
          domain,
          customerId: config.customerId,
          spinletId,
          buildPath: outputPath,
          framework: config.framework,
          config: {
            memory: config.resources?.memory,
            cpu: config.resources?.cpu?.toString(),
            env: config.env,
            ...config,
          },
        });
      }

      // Update spinlet domains
      await this.spinletManager.updateDomains(spinletId, domains);
    }

    // Run post-deploy hooks
    if (config.hooks?.postDeploy) {
      await this.runHooks(config.hooks.postDeploy, buildPath);
    }

    this.logger.info(`Successfully deployed ${config.name}`, {
      spinletId,
      domains,
      customerId: config.customerId,
    });
    
    // Update deployment API status
    if (this.deploymentAPI) {
      this.deploymentAPI.markDeploymentAsComplete(config.name, true);
    }
  }

  private async runBuildCommand(
    command: string,
    cwd: string,
    env?: Record<string, string>
  ): Promise<void> {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    // Clean environment for build - remove debug and VS Code specific variables
    const cleanEnv = { ...process.env };
    delete cleanEnv.NODE_OPTIONS;
    delete cleanEnv.VSCODE_INSPECTOR_OPTIONS;
    delete cleanEnv.ELECTRON_RUN_AS_NODE;
    delete cleanEnv.VSCODE_CWD;
    delete cleanEnv.VSCODE_CODE_CACHE_PATH;

    // For build commands, install all dependencies including devDependencies
    let buildCommand = command;
    if (command.includes("npm install") && !command.includes("--production")) {
      buildCommand = command.replace(
        "npm install",
        "npm install --include=dev"
      );
    }

    // For Next.js projects, ensure TypeScript is installed and handle linting issues
    if (command.includes("npm run build")) {
      // Set environment variables to be more lenient with linting/type checking
      // For Next.js 15+, we need to set NEXT_ESLINT_DISABLE=true to skip linting during build
      env = {
        ...env,
        NEXT_ESLINT_DISABLE: "true"
      };
      buildCommand = "npm install --include=dev && npm run build";
    }

    await execAsync(buildCommand, {
      cwd,
      env: {
        ...cleanEnv,
        NODE_ENV: "production",
        ...env,
      },
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large build outputs
    });
  }

  private async runHooks(hooks: string | string[], cwd: string): Promise<void> {
    const hookCommands = Array.isArray(hooks) ? hooks : [hooks];

    for (const command of hookCommands) {
      await this.runBuildCommand(command, cwd);
    }
  }

  private async createMarker(
    path: string,
    filename: string,
    content: any
  ): Promise<void> {
    const markerPath = join(path, filename);
    await writeFile(markerPath, JSON.stringify(content, null, 2));
  }

  private async cleanupOrphanedRoutes(): Promise<void> {
    try {
      this.logger.info("Cleaning up orphaned routes...");
      
      // Get all registered routes
      const Redis = require('ioredis');
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'keydb',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      });
      
      const allDomains = await redis.hkeys("spinforge:routes");
      
      for (const domain of allDomains) {
        const routeData = await redis.hget("spinforge:routes", domain);
        if (!routeData) continue;
        
        const route = JSON.parse(routeData);
        
        // Check if the deployment still exists
        const deploymentPath = route.buildPath;
        
        // Skip if not a deployment from our watched folder
        if (!deploymentPath || !deploymentPath.startsWith(this.deploymentPath)) {
          continue;
        }
        
        try {
          await access(deploymentPath);
          // Deployment exists, check if config exists
          try {
            await access(join(deploymentPath, 'deploy.json'));
          } catch {
            try {
              await access(join(deploymentPath, 'deploy.yaml'));
            } catch {
              // No deployment config, remove route
              this.logger.info(`Removing orphaned route for ${domain} - no config found`);
              await this.removeDeployment(domain, route);
            }
          }
        } catch {
          // Deployment folder doesn't exist, remove route
          this.logger.info(`Removing orphaned route for ${domain} - folder not found`);
          await this.removeDeployment(domain, route);
        }
      }
      
      await redis.quit();
    } catch (error) {
      this.logger.error("Error cleaning up orphaned routes", { error });
    }
  }

  private async removeDeployment(domain: string, route: any): Promise<void> {
    try {
      // Remove route
      await this.routeManager.removeRoute(domain);
      
      // Stop spinlet if running
      if (route.spinletId) {
        try {
          await this.spinletManager.stop(route.spinletId, "deployment_removed");
        } catch (error) {
          this.logger.warn(`Failed to stop spinlet ${route.spinletId}`, { error });
        }
      }
    } catch (error) {
      this.logger.error(`Failed to remove deployment for ${domain}`, { error });
    }
  }

  private async performHealthCheck(): Promise<void> {
    this.logger.debug("Performing deployment health check");
    
    try {
      // Get all registered routes
      const Redis = require('ioredis');
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'keydb',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      });
      
      const allDomains = await redis.hkeys("spinforge:routes");
      let missingCount = 0;
      let checkedCount = 0;
      
      for (const domain of allDomains) {
        const routeData = await redis.hget("spinforge:routes", domain);
        if (!routeData) continue;
        
        const route = JSON.parse(routeData);
        
        // Skip if not a deployment from our watched folder
        if (!route.buildPath || !route.buildPath.startsWith(this.deploymentPath)) {
          continue;
        }
        
        checkedCount++;
        
        try {
          // Check if the deployment folder still exists
          await access(route.buildPath);
          
          // Also check if deploy.json or deploy.yaml exists
          let configExists = false;
          try {
            await access(join(route.buildPath, 'deploy.json'));
            configExists = true;
          } catch {
            try {
              await access(join(route.buildPath, 'deploy.yaml'));
              configExists = true;
            } catch {
              // No config file
            }
          }
          
          if (!configExists) {
            this.logger.warn(`Deployment folder exists but no config found for ${domain}`, {
              buildPath: route.buildPath
            });
            missingCount++;
            
            // Mark deployment as unhealthy
            if (this.deploymentAPI) {
              this.deploymentAPI.markDeploymentAsUnhealthy(
                route.customerId,
                domain,
                "Deployment config missing"
              );
            }
          }
        } catch {
          // Deployment folder doesn't exist
          this.logger.error(`Deployment folder missing for ${domain}`, {
            buildPath: route.buildPath,
            spinletId: route.spinletId
          });
          missingCount++;
          
          // Mark deployment as failed and remove it
          if (this.deploymentAPI) {
            this.deploymentAPI.markDeploymentAsComplete(
              domain,
              false,
              "Deployment folder no longer exists"
            );
          }
          
          // Remove the orphaned deployment
          await this.removeDeployment(domain, route);
        }
      }
      
      await redis.quit();
      
      if (missingCount > 0) {
        this.logger.warn(`Health check completed: ${missingCount} missing deployments out of ${checkedCount} checked`);
      } else {
        this.logger.debug(`Health check completed: All ${checkedCount} deployments healthy`);
      }
    } catch (error) {
      this.logger.error("Error during health check", { error });
    }
  }
}
