import { watch, FSWatcher } from "fs";
import { readdir, stat, readFile, access, writeFile } from "fs/promises";
import { join, basename } from "path";
import { createLogger } from "@spinforge/shared";
import { parse as parseYaml } from "yaml";
import { DeploymentConfig } from "./deploy-schema";
import { RouteManager } from "../RouteManager";
import { SpinletManager } from "@spinforge/spinlet-core";
import { extract } from "tar";
import { createReadStream } from "fs";
import { pipeline } from "stream/promises";
import * as unzipper from "unzipper";

export class HotDeploymentWatcher {
  private watcher?: FSWatcher;
  private logger = createLogger("HotDeploymentWatcher");
  private deploymentPath: string;
  private routeManager: RouteManager;
  private spinletManager: SpinletManager;
  private processingDeployments = new Set<string>();

  constructor(
    deploymentPath: string,
    routeManager: RouteManager,
    spinletManager: SpinletManager
  ) {
    this.deploymentPath = deploymentPath;
    this.routeManager = routeManager;
    this.spinletManager = spinletManager;
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
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      this.watcher.close();
      this.logger.info("Hot deployment watcher stopped");
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
    return (
      filename.endsWith(".zip") ||
      filename.endsWith(".tar") ||
      filename.endsWith(".tar.gz") ||
      filename.endsWith(".tgz")
    );
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

      let actualPath = deploymentPath;

      // Extract archive if needed
      if (this.isArchive(deploymentPath)) {
        actualPath = await this.extractArchive(deploymentPath);
      }

      // Load deployment configuration
      const config = await this.loadDeploymentConfig(actualPath);
      if (!config) {
        this.logger.warn(`No deployment config found in ${deploymentId}`);
        return;
      }

      // Validate configuration
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        this.logger.error(`Invalid deployment config for ${deploymentId}`, {
          errors: validation.errors,
        });
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
    } finally {
      this.processingDeployments.delete(deploymentId);
    }
  }

  private async extractArchive(archivePath: string): Promise<string> {
    const extractPath = archivePath.replace(/\.(zip|tar|tar\.gz|tgz)$/, "");

    if (archivePath.endsWith(".zip")) {
      await pipeline(
        createReadStream(archivePath),
        unzipper.Extract({ path: extractPath })
      );
    } else {
      // Handle tar files
      await extract({
        file: archivePath,
        cwd: extractPath,
        strip: 1, // Remove top-level directory
      });
    }

    return extractPath;
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

    // Create spinlet
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

    // Run post-deploy hooks
    if (config.hooks?.postDeploy) {
      await this.runHooks(config.hooks.postDeploy, buildPath);
    }

    this.logger.info(`Successfully deployed ${config.name}`, {
      spinletId,
      domains,
      customerId: config.customerId,
    });
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
}
