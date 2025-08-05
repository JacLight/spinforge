import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import {
  Save,
  Key,
  AlertCircle,
  Shield,
  Server,
  Globe,
  Database,
  Bell,
  Mail,
  Lock,
  Users,
  Zap,
  HardDrive,
  Network,
  Clock,
  CheckCircle,
  Settings as SettingsIcon,
  RefreshCw,
  Hammer,
} from "lucide-react";
import { toast } from "sonner";

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: any;
}

const settingSections: SettingSection[] = [
  {
    id: "authentication",
    title: "Authentication",
    description: "API tokens and access control",
    icon: Key,
  },
  {
    id: "build",
    title: "Build & Deployment",
    description: "Build timeouts and settings",
    icon: Hammer,
  },
  {
    id: "resources",
    title: "Resource Limits",
    description: "Default resource allocations",
    icon: Server,
  },
  {
    id: "networking",
    title: "Networking",
    description: "Port ranges and domain settings",
    icon: Network,
  },
  {
    id: "security",
    title: "Security",
    description: "Security policies and restrictions",
    icon: Shield,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Alert and notification settings",
    icon: Bell,
  },
  {
    id: "maintenance",
    title: "Maintenance",
    description: "Backup and cleanup settings",
    icon: Clock,
  },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState("authentication");
  const [adminToken, setAdminToken] = useState("");
  const [saved, setSaved] = useState(false);

  // Fetch real metrics data
  const { data: allMetrics } = useQuery({
    queryKey: ["allMetrics"],
    queryFn: () => api.allMetrics(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Resource settings
  const [defaultMemory, setDefaultMemory] = useState("512MB");
  const [defaultCpu, setDefaultCpu] = useState("0.5");
  const [maxMemory, setMaxMemory] = useState("4GB");
  const [maxCpu, setMaxCpu] = useState("2");

  // Network settings
  const [portRangeStart, setPortRangeStart] = useState("10000");
  const [portRangeEnd, setPortRangeEnd] = useState("20000");
  const [defaultDomainSuffix, setDefaultDomainSuffix] =
    useState(".spinforge.local");

  // Security settings
  const [enableRateLimit, setEnableRateLimit] = useState(true);
  const [rateLimit, setRateLimit] = useState("100");
  const [enableSSL, setEnableSSL] = useState(true);
  const [allowedFrameworks, setAllowedFrameworks] = useState([
    "remix",
    "nextjs",
    "express",
    "static",
  ]);

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");

  // Maintenance settings
  const [autoBackup, setAutoBackup] = useState(true);
  const [backupInterval, setBackupInterval] = useState("daily");
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [cleanupAge, setCleanupAge] = useState("30");

  // Build settings
  const [buildTimeout, setBuildTimeout] = useState("5");
  const [idleTimeout, setIdleTimeout] = useState("5");
  const [enableBuildCache, setEnableBuildCache] = useState(true);
  const [maxConcurrentBuilds, setMaxConcurrentBuilds] = useState("3");

  // Fetch settings from API
  const { data: serverSettings, isLoading: isLoadingSettings, refetch: refetchSettings } = useQuery({
    queryKey: ["serverSettings"],
    queryFn: () => api.getSettings(),
  });

  // Initialize form state from server settings when loaded
  useEffect(() => {
    if (serverSettings) {
      // Build settings
      setBuildTimeout(serverSettings.build.buildTimeout.toString());
      setIdleTimeout(serverSettings.build.idleTimeout.toString());
      setEnableBuildCache(serverSettings.build.enableBuildCache);
      setMaxConcurrentBuilds(serverSettings.build.maxConcurrentBuilds.toString());

      // Resource settings
      setDefaultMemory(serverSettings.resources.defaultMemory);
      setDefaultCpu(serverSettings.resources.defaultCpu);
      setMaxMemory(serverSettings.resources.maxMemory);
      setMaxCpu(serverSettings.resources.maxCpu);

      // Network settings
      setPortRangeStart(serverSettings.networking.portRangeStart.toString());
      setPortRangeEnd(serverSettings.networking.portRangeEnd.toString());
      setDefaultDomainSuffix(serverSettings.networking.defaultDomainSuffix);

      // Security settings
      setEnableRateLimit(serverSettings.security.enableRateLimit);
      setRateLimit(serverSettings.security.rateLimit.toString());
      setEnableSSL(serverSettings.security.enableSSL);
      setAllowedFrameworks(serverSettings.security.allowedFrameworks);

      // Notification settings
      setEmailNotifications(serverSettings.notifications.emailNotifications);
      setNotificationEmail(serverSettings.notifications.notificationEmail);
      setSlackWebhook(serverSettings.notifications.slackWebhook);

      // Maintenance settings
      setAutoBackup(serverSettings.maintenance.autoBackup);
      setBackupInterval(serverSettings.maintenance.backupInterval);
      setAutoCleanup(serverSettings.maintenance.autoCleanup);
      setCleanupAge(serverSettings.maintenance.cleanupAge.toString());
    }
  }, [serverSettings]);

  useEffect(() => {
    const token = localStorage.getItem("adminToken") || "";
    setAdminToken(token);
  }, []);

  const handleSave = async () => {
    try {
      // Save admin token to localStorage
      api.setAdminToken(adminToken);

      // Save settings to server
      const settings = {
        build: {
          buildTimeout: parseInt(buildTimeout),
          idleTimeout: parseInt(idleTimeout),
          enableBuildCache,
          maxConcurrentBuilds: parseInt(maxConcurrentBuilds),
        },
        resources: { defaultMemory, defaultCpu, maxMemory, maxCpu },
        networking: {
          portRangeStart: parseInt(portRangeStart),
          portRangeEnd: parseInt(portRangeEnd),
          defaultDomainSuffix,
        },
        security: {
          enableRateLimit,
          rateLimit: parseInt(rateLimit),
          enableSSL,
          allowedFrameworks,
        },
        notifications: { emailNotifications, notificationEmail, slackWebhook },
        maintenance: {
          autoBackup,
          backupInterval,
          autoCleanup,
          cleanupAge: parseInt(cleanupAge),
        },
      };

      await api.updateSettings(settings);
      toast.success("Settings saved successfully!");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      
      // Refetch settings to ensure UI is in sync
      refetchSettings();
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings: " + (error as any).message);
    }
  };

  const handleReset = async () => {
    try {
      await api.resetSettings();
      toast.success("Settings reset to defaults!");
      refetchSettings();
    } catch (error) {
      console.error("Failed to reset settings:", error);
      toast.error("Failed to reset settings: " + (error as any).message);
    }
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "authentication":
        return (
          <div className="space-y-6">
            <div>
              <label
                htmlFor="adminToken"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Admin API Token
              </label>
              <div className="flex rounded-lg shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50">
                  <Key className="h-4 w-4 text-gray-500" />
                </span>
                <input
                  type="password"
                  id="adminToken"
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  className="flex-1 block w-full min-w-0 rounded-none rounded-r-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter your admin token"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Required for API access. Find it in your .env file or Docker
                logs.
              </p>
            </div>

            {!adminToken && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Admin token not configured
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>To find your admin token, run:</p>
                      <pre className="mt-2 bg-yellow-100 p-2 rounded text-xs">
                        docker logs spinforge-hub | grep "Admin token"
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                API Key Management
              </h3>
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50">
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate New API Key
              </button>
            </div>
          </div>
        );

      case "build":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Build Configuration
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Build Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    value={buildTimeout}
                    onChange={(e) => setBuildTimeout(e.target.value)}
                    className="block w-full max-w-xs rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="5"
                    min="1"
                    max="60"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Maximum time allowed for building and starting applications (especially important for Next.js apps)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Idle Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    value={idleTimeout}
                    onChange={(e) => setIdleTimeout(e.target.value)}
                    className="block w-full max-w-xs rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="5"
                    min="1"
                    max="60"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Time before idle applications are automatically shut down
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Concurrent Builds
                  </label>
                  <input
                    type="number"
                    value={maxConcurrentBuilds}
                    onChange={(e) => setMaxConcurrentBuilds(e.target.value)}
                    className="block w-full max-w-xs rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="3"
                    min="1"
                    max="10"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Maximum number of applications that can be built simultaneously
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableBuildCache"
                    checked={enableBuildCache}
                    onChange={(e) => setEnableBuildCache(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="enableBuildCache"
                    className="ml-2 block text-sm text-gray-900"
                  >
                    Enable build cache
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Environment Variables
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-2">
                  Current timeout configuration:
                </p>
                <code className="block text-xs bg-gray-900 text-green-400 p-3 rounded">
                  SPINLET_STARTUP_TIMEOUT_MS={parseInt(buildTimeout) * 60 * 1000}
                </code>
                <p className="mt-2 text-xs text-gray-500">
                  This value will be applied on next restart
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Build Tips
                  </h3>
                  <ul className="mt-2 text-sm text-blue-700 list-disc list-inside">
                    <li>Next.js apps typically need 3-5 minutes to build</li>
                    <li>Static sites build quickly (under 1 minute)</li>
                    <li>Enable build cache to speed up subsequent builds</li>
                    <li>Monitor resource usage during builds</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case "resources":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Default Resource Allocation
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Memory
                  </label>
                  <input
                    type="text"
                    value={defaultMemory}
                    onChange={(e) => setDefaultMemory(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="512MB"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default CPU
                  </label>
                  <input
                    type="text"
                    value={defaultCpu}
                    onChange={(e) => setDefaultCpu(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="0.5"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Maximum Resource Limits
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Memory per App
                  </label>
                  <input
                    type="text"
                    value={maxMemory}
                    onChange={(e) => setMaxMemory(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="4GB"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max CPU per App
                  </label>
                  <input
                    type="text"
                    value={maxCpu}
                    onChange={(e) => setMaxCpu(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="2"
                  />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <Zap className="h-5 w-5 text-blue-400 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Resource Usage
                  </h3>
                  <p className="mt-1 text-sm text-blue-700">
                    Current cluster usage:{" "}
                    {allMetrics?.system?.memory?.used
                      ? `${(
                          allMetrics.system.memory.used /
                          1024 /
                          1024 /
                          1024
                        ).toFixed(1)}GB / ${(
                          allMetrics.system.memory.total /
                          1024 /
                          1024 /
                          1024
                        ).toFixed(1)}GB`
                      : "Loading..."}{" "}
                    RAM,{" "}
                    {allMetrics?.system?.cpu?.usage
                      ? `${(
                          (allMetrics.system.cpu.usage *
                            allMetrics.system.cpu.cores) /
                          100
                        ).toFixed(1)} / ${allMetrics.system.cpu.cores}`
                      : "Loading..."}{" "}
                    CPUs
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case "networking":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Port Configuration
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Port Range Start
                  </label>
                  <input
                    type="number"
                    value={portRangeStart}
                    onChange={(e) => setPortRangeStart(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Port Range End
                  </label>
                  <input
                    type="number"
                    value={portRangeEnd}
                    onChange={(e) => setPortRangeEnd(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Available ports:{" "}
                {parseInt(portRangeEnd) - parseInt(portRangeStart)}
                (Currently allocated: {allMetrics?.docker?.running || 0})
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Domain Suffix
              </label>
              <input
                type="text"
                value={defaultDomainSuffix}
                onChange={(e) => setDefaultDomainSuffix(e.target.value)}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder=".spinforge.localhost"
              />
              <p className="mt-2 text-sm text-gray-500">
                Used when auto-generating domain names
              </p>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                DNS Configuration
              </h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>Wildcard DNS configured for *.spinforge.local</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>
                    SSL certificates auto-provisioned via Let's Encrypt
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case "security":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Rate Limiting
              </h3>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="enableRateLimit"
                  checked={enableRateLimit}
                  onChange={(e) => setEnableRateLimit(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="enableRateLimit"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Enable rate limiting
                </label>
              </div>
              {enableRateLimit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Requests per minute
                  </label>
                  <input
                    type="number"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                    className="block w-full max-w-xs rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                SSL/TLS
              </h3>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enableSSL"
                  checked={enableSSL}
                  onChange={(e) => setEnableSSL(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="enableSSL"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Force HTTPS for all applications
                </label>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Allowed Frameworks
              </h3>
              <div className="space-y-2">
                {["remix", "nextjs", "express", "static", "custom"].map(
                  (framework) => (
                    <div key={framework} className="flex items-center">
                      <input
                        type="checkbox"
                        id={framework}
                        checked={allowedFrameworks.includes(framework)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAllowedFrameworks([
                              ...allowedFrameworks,
                              framework,
                            ]);
                          } else {
                            setAllowedFrameworks(
                              allowedFrameworks.filter((f) => f !== framework)
                            );
                          }
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor={framework}
                        className="ml-2 block text-sm text-gray-900 capitalize"
                      >
                        {framework}
                      </label>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Email Notifications
              </h3>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="emailNotifications"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="emailNotifications"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Enable email notifications
                </label>
              </div>
              {emailNotifications && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notification Email
                  </label>
                  <input
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="admin@example.com"
                  />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Slack Integration
              </h3>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slack Webhook URL
              </label>
              <input
                type="text"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Notification Events
              </h3>
              <div className="space-y-2">
                {[
                  "Deployment success",
                  "Deployment failure",
                  "High resource usage",
                  "Service down",
                ].map((event) => (
                  <div key={event} className="flex items-center">
                    <input
                      type="checkbox"
                      id={event}
                      defaultChecked
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor={event}
                      className="ml-2 block text-sm text-gray-900"
                    >
                      {event}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "maintenance":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Automatic Backups
              </h3>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="autoBackup"
                  checked={autoBackup}
                  onChange={(e) => setAutoBackup(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="autoBackup"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Enable automatic backups
                </label>
              </div>
              {autoBackup && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Backup Frequency
                  </label>
                  <select
                    value={backupInterval}
                    onChange={(e) => setBackupInterval(e.target.value)}
                    className="block w-full max-w-xs rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Automatic Cleanup
              </h3>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="autoCleanup"
                  checked={autoCleanup}
                  onChange={(e) => setAutoCleanup(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="autoCleanup"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Enable automatic cleanup
                </label>
              </div>
              {autoCleanup && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delete unused images after (days)
                  </label>
                  <input
                    type="number"
                    value={cleanupAge}
                    onChange={(e) => setCleanupAge(e.target.value)}
                    className="block w-full max-w-xs rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              )}
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Maintenance Actions
              </h3>
              <div className="space-y-2">
                <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50">
                  <Database className="h-4 w-4 mr-2" />
                  Backup Now
                </button>
                <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 ml-2">
                  <HardDrive className="h-4 w-4 mr-2" />
                  Clean Up Storage
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
            <span className="ml-3 text-gray-600">Loading settings...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Server Configuration
            </h3>
            <p className="mt-1 text-sm text-blue-700">
              These settings are stored on the server and will take effect immediately. Some changes may require 
              restarting individual services or containers to fully apply.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <SettingsIcon className="h-8 w-8 text-gray-700 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                System Settings
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Configure SpinForge platform settings
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              className={`inline-flex items-center px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-white transition-all ${
                saved
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {saved ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save All Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {settingSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-start px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "bg-indigo-50 border-indigo-500 text-indigo-700 border-l-4"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent border-l-4"
                  }`}
                >
                  <Icon
                    className={`flex-shrink-0 h-5 w-5 mr-3 ${
                      isActive ? "text-indigo-600" : "text-gray-400"
                    }`}
                  />
                  <div className="text-left">
                    <div>{section.title}</div>
                    <div
                      className={`text-xs ${
                        isActive ? "text-indigo-600" : "text-gray-500"
                      }`}
                    >
                      {section.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-white shadow-sm rounded-lg p-6">
            {renderSectionContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
