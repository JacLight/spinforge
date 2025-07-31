import { Router, Request, Response } from "express";
import fs from "fs/promises";
import path from "path";

export interface ServerSettings {
  build: {
    buildTimeout: number; // minutes
    idleTimeout: number; // minutes
    enableBuildCache: boolean;
    maxConcurrentBuilds: number;
  };
  resources: {
    defaultMemory: string;
    defaultCpu: string;
    maxMemory: string;
    maxCpu: string;
  };
  networking: {
    portRangeStart: number;
    portRangeEnd: number;
    defaultDomainSuffix: string;
  };
  security: {
    enableRateLimit: boolean;
    rateLimit: number; // requests per minute
    enableSSL: boolean;
    allowedFrameworks: string[];
  };
  notifications: {
    emailNotifications: boolean;
    notificationEmail: string;
    slackWebhook: string;
  };
  maintenance: {
    autoBackup: boolean;
    backupInterval: "hourly" | "daily" | "weekly";
    autoCleanup: boolean;
    cleanupAge: number; // days
  };
}

const DEFAULT_SETTINGS: ServerSettings = {
  build: {
    buildTimeout: parseInt(process.env.SPINLET_BUILD_TIMEOUT || "5"),
    idleTimeout: parseInt(process.env.SPINLET_IDLE_TIMEOUT || "5"),
    enableBuildCache: process.env.ENABLE_BUILD_CACHE !== "false",
    maxConcurrentBuilds: parseInt(process.env.MAX_CONCURRENT_BUILDS || "3"),
  },
  resources: {
    defaultMemory: process.env.DEFAULT_MEMORY || "512MB",
    defaultCpu: process.env.DEFAULT_CPU || "0.5",
    maxMemory: process.env.MAX_MEMORY || "4GB",
    maxCpu: process.env.MAX_CPU || "2",
  },
  networking: {
    portRangeStart: parseInt(process.env.PORT_RANGE_START || "10000"),
    portRangeEnd: parseInt(process.env.PORT_RANGE_END || "20000"),
    defaultDomainSuffix: process.env.DEFAULT_DOMAIN_SUFFIX || ".spinforge.local",
  },
  security: {
    enableRateLimit: process.env.ENABLE_RATE_LIMIT !== "false",
    rateLimit: parseInt(process.env.RATE_LIMIT || "100"),
    enableSSL: process.env.ENABLE_SSL !== "false",
    allowedFrameworks: (process.env.ALLOWED_FRAMEWORKS || "remix,nextjs,express,static").split(","),
  },
  notifications: {
    emailNotifications: process.env.EMAIL_NOTIFICATIONS === "true",
    notificationEmail: process.env.NOTIFICATION_EMAIL || "",
    slackWebhook: process.env.SLACK_WEBHOOK || "",
  },
  maintenance: {
    autoBackup: process.env.AUTO_BACKUP !== "false",
    backupInterval: (process.env.BACKUP_INTERVAL || "daily") as "hourly" | "daily" | "weekly",
    autoCleanup: process.env.AUTO_CLEANUP !== "false",
    cleanupAge: parseInt(process.env.CLEANUP_AGE || "30"),
  },
};

export class SettingsAPI {
  private settingsPath: string;
  private settings: ServerSettings;

  constructor(private dataDir: string) {
    this.settingsPath = path.join(dataDir, "settings.json");
    this.settings = DEFAULT_SETTINGS;
  }

  async init() {
    await this.loadSettings();
  }

  private async loadSettings() {
    try {
      const data = await fs.readFile(this.settingsPath, "utf-8");
      const loaded = JSON.parse(data);
      // Merge with defaults to ensure all fields exist
      this.settings = this.mergeWithDefaults(loaded);
    } catch (error) {
      // If file doesn't exist or is invalid, use defaults
      console.log("No settings file found, using defaults");
      this.settings = DEFAULT_SETTINGS;
      await this.saveSettings();
    }
  }

  private async saveSettings() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2));
  }

  private mergeWithDefaults(loaded: Partial<ServerSettings>): ServerSettings {
    return {
      build: { ...DEFAULT_SETTINGS.build, ...loaded.build },
      resources: { ...DEFAULT_SETTINGS.resources, ...loaded.resources },
      networking: { ...DEFAULT_SETTINGS.networking, ...loaded.networking },
      security: { ...DEFAULT_SETTINGS.security, ...loaded.security },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...loaded.notifications },
      maintenance: { ...DEFAULT_SETTINGS.maintenance, ...loaded.maintenance },
    };
  }

  getSettings(): ServerSettings {
    return this.settings;
  }

  async updateSettings(updates: Partial<ServerSettings>): Promise<ServerSettings> {
    this.settings = this.mergeWithDefaults({ ...this.settings, ...updates });
    await this.saveSettings();
    return this.settings;
  }

  // Utility methods for accessing specific settings
  getBuildTimeoutMs(): number {
    return this.settings.build.buildTimeout * 60 * 1000;
  }

  getIdleTimeoutMs(): number {
    return this.settings.build.idleTimeout * 60 * 1000;
  }

  isFrameworkAllowed(framework: string): boolean {
    return this.settings.security.allowedFrameworks.includes(framework);
  }

  getPortRange(): { start: number; end: number } {
    return {
      start: this.settings.networking.portRangeStart,
      end: this.settings.networking.portRangeEnd,
    };
  }

  router(): Router {
    const router = Router();

    // Get current settings
    router.get("/", (req: Request, res: Response) => {
      res.json(this.getSettings());
    });

    // Update settings
    router.put("/", async (req: Request, res: Response) => {
      try {
        const updated = await this.updateSettings(req.body);
        res.json(updated);
      } catch (error) {
        console.error("Failed to update settings:", error);
        res.status(500).json({ error: "Failed to update settings" });
      }
    });

    // Reset to defaults
    router.post("/reset", async (req: Request, res: Response) => {
      try {
        this.settings = DEFAULT_SETTINGS;
        await this.saveSettings();
        res.json(this.settings);
      } catch (error) {
        console.error("Failed to reset settings:", error);
        res.status(500).json({ error: "Failed to reset settings" });
      }
    });

    return router;
  }
}