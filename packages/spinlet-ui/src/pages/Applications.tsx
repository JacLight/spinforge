import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, customerApi, Route, Spinlet, IdleInfo } from "../services/api";
import { config } from "../config/environment";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Globe,
  Package,
  Trash2,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Play,
  Pause,
  RotateCw,
  Settings,
  Activity,
  Server,
  Plus,
  ChevronRight,
  Clock,
  Timer,
} from "lucide-react";

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatDeploymentTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } else if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return "Just now";
  }
}

export default function Applications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");

  const {
    data: routes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["routes", selectedCustomer],
    queryFn: async () => {
      const routeData =
        selectedCustomer === "all"
          ? await api.getRoutesWithStates()
          : await api.getCustomerRoutes(selectedCustomer);

      // Get deployment statuses
      try {
        const deployments = await customerApi.getDeployments();

        // Merge deployment info with routes and verify static deployments
        const routesWithStatus = await Promise.all(
          routeData.map(async (route) => {
            const deployment = deployments.find(
              (d: any) =>
                d.domains?.includes(route.domain) || d.name === route.spinletId
            );

            let verificationStatus = null;
            // For static deployments, verify if they're actually accessible
            if (route.framework === "static") {
              try {
                // Extract deployment name from spinletId or buildPath
                const deploymentName =
                  route.spinletId.replace("static-", "") ||
                  route.buildPath?.split("/").pop() ||
                  route.domain.split(".")[0];
                verificationStatus = await api.verifyDeployment(deploymentName);
              } catch (e) {
                console.warn(
                  `Failed to verify deployment for ${route.domain}`,
                  e
                );
              }
            }

            return {
              ...route,
              deploymentTime: deployment?.timestamp,
              deploymentStatus: deployment?.status,
              deploymentError: deployment?.error,
              verificationStatus,
            };
          })
        );

        return routesWithStatus;
      } catch (e) {
        // If deployment API fails, just return routes without deployment info
        return routeData;
      }
    },
    refetchInterval: 5000, // Refresh every 5 seconds to show TTL countdown
  });

  const deleteMutation = useMutation({
    mutationFn: (domain: string) => api.deleteRoute(domain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Application deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete application: ${error.message}`);
    },
  });

  const retryDeploymentMutation = useMutation({
    mutationFn: async (deploymentName: string) => {
      const response = await api.retryDeployment(deploymentName);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Deployment retry initiated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to retry deployment: ${error.message}`);
    },
  });

  const customers = Array.from(new Set(routes.map((r) => r.customerId)));

  const handleRestart = (domain: string) => {
    toast.success(`Restarting ${domain}...`);
    // TODO: Implement restart functionality
  };

  const handleStop = (domain: string) => {
    toast.success(`Stopping ${domain}...`);
    // TODO: Implement stop functionality
  };

  const handleStart = (domain: string) => {
    toast.success(`Starting ${domain}...`);
    // TODO: Implement start functionality
  };

  const handleViewLogs = (domain: string) => {
    toast.info(`Opening logs for ${domain}...`);
    // TODO: Implement logs viewer
  };

  const handleExtendTimeout = async (spinletId: string) => {
    try {
      await api.extendIdleTimeout(spinletId, 300); // Extend by 5 minutes
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Idle timeout extended by 5 minutes");
    } catch (error) {
      toast.error("Failed to extend timeout");
    }
  };

  if (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isNetworkError =
      errorMessage.includes("502") || errorMessage.includes("Network");

    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error loading applications
            </h3>
            <p className="mt-2 text-sm text-red-700">{errorMessage}</p>
            {isNetworkError && (
              <div className="mt-3 text-sm text-red-600">
                <p className="font-medium">Troubleshooting tips:</p>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  <li>Check if SpinHub service is running on port 8080</li>
                  <li>Verify nginx proxy configuration is correct</li>
                  <li>Ensure the API endpoint /_admin/routes is accessible</li>
                  <li>Check browser console for more details</li>
                </ul>
                <div className="mt-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Application Management
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Monitor and manage all deployed applications in your SpinForge
              cluster
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <a
              href="/deploy"
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg shadow-sm hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              Deploy New App
            </a>
          </div>
        </div>

        {/* Filter */}
        <div className="mt-6 max-w-xs">
          <label
            htmlFor="customer"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Filter by Customer
          </label>
          <select
            id="customer"
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">All Customers</option>
            {customers.map((customer) => (
              <option key={customer} value={customer}>
                {customer}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Applications List */}
      <div className="bg-white shadow-sm rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center p-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No applications deployed
            </h3>
            <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
              Get started by deploying your first application to SpinForge.
            </p>
            <div className="mt-6">
              <a
                href="/deploy"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="h-5 w-5 mr-2" />
                Deploy First App
              </a>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Application
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service Path
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Deploy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Idle Timeout
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resources
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {routes.map(
                  (
                    route: Route & {
                      spinletState?: Spinlet;
                      idleInfo?: IdleInfo;
                      deploymentTime?: string;
                      deploymentStatus?: string;
                      deploymentError?: string;
                      verificationStatus?: any;
                      allDomains?: string[];
                    }
                  ) => (
                    <tr
                      key={route.domain}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <Globe className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div className="ml-4">
                            <button
                              onClick={() =>
                                navigate(`/applications/${route.domain}`)
                              }
                              className="text-left hover:text-indigo-600 transition-colors"
                            >
                              <div className="text-sm font-medium text-gray-900 hover:text-indigo-600">
                                {route.domain}
                              </div>
                              <div className="text-xs text-gray-500">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    route.framework === "static"
                                      ? "bg-green-100 text-green-800"
                                      : route.framework === "reverse-proxy"
                                        ? "bg-purple-100 text-purple-800"
                                        : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {route.framework}
                                </span>
                                {route.framework === "reverse-proxy" &&
                                  route.config?.proxy?.target && (
                                    <span className="ml-2 text-purple-600 font-mono text-xs">
                                      → {route.config.proxy.target}
                                    </span>
                                  )}
                              </div>
                            </button>
                            {/* Show additional domains if any */}
                            {route.allDomains &&
                              route.allDomains.length > 1 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {route.allDomains
                                    .filter((d) => d !== route.domain)
                                    .map((domain) => (
                                      <a
                                        key={domain}
                                        href={`http://${domain}:9006`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                                      >
                                        {domain}
                                      </a>
                                    ))}
                                </div>
                              )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900">
                          {route.framework === "static" ? (
                            <span className="text-green-600">Static Files</span>
                          ) : route.framework === "reverse-proxy" ? (
                            <span className="text-purple-600">
                              {route.config?.proxy?.target || "No target"}
                            </span>
                          ) : (
                            <div className="group relative inline-block">
                              <span className="cursor-help">
                                {route.spinletState?.servicePath || "-"}
                              </span>
                              {route.spinletState?.servicePath && (
                                <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                  <p className="text-gray-300 mb-1">
                                    Internal spinlet URL:
                                  </p>
                                  <code className="text-yellow-400">
                                    http://{route.spinletState.servicePath}
                                  </code>
                                  <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800"></div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {route.customerId}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {route.deploymentStatus === "failed" ? (
                            <div className="group relative">
                              <div className="flex items-center">
                                <div className="h-2 w-2 bg-red-400 rounded-full"></div>
                                <span className="ml-2 text-sm text-gray-600">
                                  Failed
                                </span>
                              </div>
                              {route.deploymentError && (
                                <div className="absolute left-0 bottom-full mb-2 w-80 p-3 bg-red-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                  <p className="font-medium text-red-200 mb-1">
                                    Deployment Error:
                                  </p>
                                  <p className="text-red-100">
                                    {route.deploymentError}
                                  </p>
                                  <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-red-900"></div>
                                </div>
                              )}
                            </div>
                          ) : route.framework === "static" ? (
                            route.verificationStatus &&
                            !route.verificationStatus.accessible ? (
                              <div className="group relative">
                                <div className="flex items-center">
                                  <div className="h-2 w-2 bg-red-400 rounded-full"></div>
                                  <span className="ml-2 text-sm text-gray-600">
                                    Not Found
                                  </span>
                                </div>
                                <div className="absolute left-0 bottom-full mb-2 w-80 p-3 bg-red-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                  <p className="font-medium text-red-200 mb-1">
                                    Deployment Error:
                                  </p>
                                  <p className="text-red-100">
                                    {route.verificationStatus.error ||
                                      "Deployment not accessible"}
                                  </p>
                                  <p className="text-red-200 mt-1">
                                    Status: {route.verificationStatus.status}
                                  </p>
                                  <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-red-900"></div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                                <span className="ml-2 text-sm text-gray-600">
                                  Active
                                </span>
                              </>
                            )
                          ) : route.framework === "reverse-proxy" ? (
                            <>
                              <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                              <span className="ml-2 text-sm text-gray-600">
                                Active
                              </span>
                            </>
                          ) : route.spinletState ? (
                            route.spinletState.state === "running" ? (
                              <>
                                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="ml-2 text-sm text-gray-600">
                                  Running
                                </span>
                              </>
                            ) : route.spinletState.state === "idle" ||
                              route.spinletState.state === "stopped" ? (
                              <>
                                <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                                <span className="ml-2 text-sm text-gray-600">
                                  Idle
                                </span>
                              </>
                            ) : route.spinletState.state === "starting" ? (
                              <>
                                <div className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse"></div>
                                <span className="ml-2 text-sm text-gray-600">
                                  Starting
                                </span>
                              </>
                            ) : route.spinletState.state === "crashed" ? (
                              <>
                                <div className="h-2 w-2 bg-red-400 rounded-full"></div>
                                <span className="ml-2 text-sm text-gray-600">
                                  Crashed
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="h-2 w-2 bg-gray-300 rounded-full"></div>
                                <span className="ml-2 text-sm text-gray-600">
                                  {route.spinletState.state}
                                </span>
                              </>
                            )
                          ) : (
                            <>
                              <div className="h-2 w-2 bg-orange-400 rounded-full"></div>
                              <span className="ml-2 text-sm text-gray-600">
                                Not Deployed
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      {/* Last Deploy */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {route.deploymentTime ? (
                          <div className="text-sm text-gray-600">
                            {formatDeploymentTime(route.deploymentTime)}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      {/* Last Active */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {route.spinletState?.lastAccess ? (
                          <div className="text-sm text-gray-600">
                            {formatDeploymentTime(
                              new Date(
                                route.spinletState.lastAccess
                              ).toISOString()
                            )}
                            {route.spinletState.state === "running" && (
                              <span className="ml-1 text-xs text-green-600">
                                ●
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      {/* Idle Timeout */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {route.framework === "static" ||
                        route.framework === "reverse-proxy" ? (
                          <span className="text-sm text-gray-400">N/A</span>
                        ) : route.idleInfo ? (
                          <div className="flex items-center">
                            <Timer className="h-4 w-4 mr-2 text-gray-400" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {route.idleInfo.timeRemainingFormatted}
                              </div>
                              {route.idleInfo.ttl < 60 && (
                                <div className="text-xs text-red-600 font-medium">
                                  Expires soon
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Server className="h-4 w-4 mr-1" />
                            <span>{route.config?.memory || "512MB"}</span>
                          </div>
                          <div className="flex items-center">
                            <Activity className="h-4 w-4 mr-1" />
                            <span>{route.config?.cpu || "0.5"} CPU</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-2">
                          {/* View App Button with Internal URL info */}
                          <div className="relative group">
                            <a
                              href={`http://${route.domain}:9006`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="View Application"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>

                            {/* Tooltip */}
                            <div className="absolute right-0 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                              <div className="space-y-2">
                                <div>
                                  <p className="font-medium text-gray-300 mb-1">
                                    External URL:
                                  </p>
                                  <code className="text-green-400">
                                    http://{route.domain}:9006
                                  </code>
                                </div>
                                <div className="border-t border-gray-700 pt-2">
                                  <p className="font-medium text-gray-300 mb-1">
                                    Internal Docker URLs:
                                  </p>
                                  <div className="space-y-1">
                                    <div>
                                      <span className="text-gray-400">
                                        From containers:
                                      </span>
                                      <code className="block text-blue-400">
                                        http://spinforge-hub:8080
                                      </code>
                                      <span className="text-gray-500">
                                        Host: {route.domain}
                                      </span>
                                    </div>
                                    <div className="mt-2">
                                      <span className="text-gray-400">
                                        From host:
                                      </span>
                                      <code className="block text-blue-400">
                                        {config.SPINHUB_URL}
                                      </code>
                                      <span className="text-gray-500">
                                        Host: {route.domain}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                            </div>
                          </div>

                          {/* Retry Button for Failed Deployments */}
                          {route.deploymentStatus === "failed" && (
                            <button
                              onClick={() => {
                                const deploymentName =
                                  route.spinletId.replace("static-", "") ||
                                  route.buildPath?.split("/").pop() ||
                                  route.domain.split(".")[0];
                                retryDeploymentMutation.mutate(deploymentName);
                              }}
                              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                              title="Retry Failed Deployment"
                              disabled={retryDeploymentMutation.isPending}
                            >
                              <RefreshCw
                                className={`h-4 w-4 ${retryDeploymentMutation.isPending ? "animate-spin" : ""}`}
                              />
                            </button>
                          )}

                          {/* Extend Timeout Button */}
                          {route.idleInfo &&
                            route.spinletState?.state === "running" && (
                              <button
                                onClick={() =>
                                  handleExtendTimeout(route.spinletId)
                                }
                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Extend Idle Timeout"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                            )}

                          {/* Restart Button */}
                          <button
                            onClick={() => handleRestart(route.domain)}
                            className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                            title="Restart Application"
                          >
                            <RotateCw className="h-4 w-4" />
                          </button>

                          {/* Stop/Start Button */}
                          <button
                            onClick={() => handleStop(route.domain)}
                            className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all"
                            title="Stop Application"
                          >
                            <Pause className="h-4 w-4" />
                          </button>

                          {/* View Details Button */}
                          <button
                            onClick={() =>
                              navigate(`/applications/${route.domain}`)
                            }
                            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Details"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>

                          {/* Settings Button */}
                          <button
                            onClick={() => toast.info("Settings coming soon!")}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                            title="Application Settings"
                          >
                            <Settings className="h-4 w-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Are you sure you want to delete ${route.domain}?`
                                )
                              ) {
                                deleteMutation.mutate(route.domain);
                              }
                            }}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Application"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {routes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Package className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Apps</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {routes.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {routes.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Server className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Customers</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {customers.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
