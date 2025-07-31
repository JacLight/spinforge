import { promises as fs } from "fs";
import { join, dirname, basename } from "path";
import { createLogger } from "@spinforge/shared";

export class WebRootManager {
  private logger = createLogger("WebRootManager");
  private webRootPath: string;

  constructor(webRootPath: string = process.env.WEB_ROOT_PATH || "/spinforge/web_root") {
    this.webRootPath = webRootPath;
  }

  /**
   * Copy static files from build output to web root
   */
  async deployStaticFiles(
    customerId: string,
    appName: string,
    sourcePath: string,
    framework: string
  ): Promise<string> {
    // Create target path: /web_root/{customerId}/{appName}/
    const targetPath = join(this.webRootPath, customerId, appName);

    try {
      // Ensure target directory exists
      await fs.mkdir(targetPath, { recursive: true });

      // Clear existing files (if any)
      await this.clearDirectory(targetPath);

      // Copy files based on framework
      switch (framework) {
        case "static":
          // Copy all files from source
          await this.copyDirectory(sourcePath, targetPath);
          break;

        case "nextjs":
          // For Next.js static export, copy from 'out' directory
          const nextOutPath = join(sourcePath, "out");
          if (await this.exists(nextOutPath)) {
            await this.copyDirectory(nextOutPath, targetPath);
          } else {
            // If no static export, just copy public assets
            const publicPath = join(sourcePath, "public");
            if (await this.exists(publicPath)) {
              await this.copyDirectory(publicPath, targetPath);
            }
          }
          break;

        case "react":
        case "vue":
        case "angular":
          // Look for common build output directories
          const buildDirs = ["dist", "build", "out"];
          let copied = false;
          for (const dir of buildDirs) {
            const buildPath = join(sourcePath, dir);
            if (await this.exists(buildPath)) {
              await this.copyDirectory(buildPath, targetPath);
              copied = true;
              break;
            }
          }
          if (!copied) {
            // Fallback: copy entire source
            await this.copyDirectory(sourcePath, targetPath);
          }
          break;

        default:
          // For other frameworks, check if there's a public/static directory
          const staticDirs = ["public", "static", "assets"];
          for (const dir of staticDirs) {
            const staticPath = join(sourcePath, dir);
            if (await this.exists(staticPath)) {
              await this.copyDirectory(staticPath, targetPath);
            }
          }
      }

      this.logger.info(`Deployed static files to web root`, {
        customerId,
        appName,
        targetPath,
        framework
      });

      return targetPath;
    } catch (error) {
      this.logger.error(`Failed to deploy static files`, {
        customerId,
        appName,
        sourcePath,
        error
      });
      throw error;
    }
  }

  /**
   * Remove static files from web root
   */
  async removeStaticFiles(customerId: string, appName: string): Promise<void> {
    const targetPath = join(this.webRootPath, customerId, appName);

    try {
      await this.removeDirectory(targetPath);
      
      // Clean up empty customer directory
      const customerPath = join(this.webRootPath, customerId);
      const entries = await fs.readdir(customerPath);
      if (entries.length === 0) {
        await fs.rmdir(customerPath);
      }

      this.logger.info(`Removed static files from web root`, {
        customerId,
        appName,
        targetPath
      });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        this.logger.error(`Failed to remove static files`, {
          customerId,
          appName,
          targetPath,
          error
        });
        throw error;
      }
    }
  }

  /**
   * Get the web root path for an app
   */
  getAppPath(customerId: string, appName: string): string {
    return join(this.webRootPath, customerId, appName);
  }

  /**
   * Check if a path exists
   */
  private async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(source: string, target: string): Promise<void> {
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = join(source, entry.name);
      const targetPath = join(target, entry.name);

      if (entry.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true });
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }

  /**
   * Clear directory contents
   */
  private async clearDirectory(path: string): Promise<void> {
    try {
      const entries = await fs.readdir(path, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(path, entry.name);
        if (entry.isDirectory()) {
          await this.removeDirectory(fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Remove directory recursively
   */
  private async removeDirectory(path: string): Promise<void> {
    try {
      const entries = await fs.readdir(path, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(path, entry.name);
        if (entry.isDirectory()) {
          await this.removeDirectory(fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }

      await fs.rmdir(path);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}