import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import {
  Server,
  FolderOpen,
  Database,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Wrench,
  Globe,
  HardDrive,
  Link,
  Activity,
  ChevronRight,
  ExternalLink,
  Loader,
} from "lucide-react";
import { toast } from "sonner";

interface HostingInfo {
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

interface DeploymentComparison {
  deploymentFolders: Array<{
    path: string;
    customerId: string;
    appName: string;
    hasConfig: boolean;
    size?: number;
  }>;
  webRootFolders: Array<{
    path: string;
    customerId: string;
    appName: string;
    size?: number;
  }>;
  redisRoutes: Array<{
    domain: string;
    customerId: string;
    spinletId: string;
    framework: string;
  }>;
  mismatches: Array<{
    type: string;
    description: string;
    details: any;
  }>;
}

export default function HostingManagement() {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [view, setView] = useState<"overview" | "comparison">("overview");
  const queryClient = useQueryClient();

  // Fetch hosting info
  const { data: hostingInfo, isLoading: loadingHosting } = useQuery({
    queryKey: ["hostingInfo"],
    queryFn: () => api.getHostingInfo(),
    refetchInterval: 30000,
  });

  // Fetch comparison data
  const { data: comparison, isLoading: loadingComparison } = useQuery({
    queryKey: ["hostingComparison"],
    queryFn: () => api.getHostingComparison(),
    enabled: view === "comparison",
    refetchInterval: 30000,
  });

  // Fix hosting issues mutation
  const fixIssuesMutation = useMutation({
    mutationFn: (domain: string) => api.fixHostingIssues(domain),
    onSuccess: (data, domain) => {
      toast.success(`Fixed issues for ${domain}`);
      queryClient.invalidateQueries({ queryKey: ["hostingInfo"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to fix issues: ${error.message}`);
    },
  });

  // Sync web root mutation
  const syncWebRootMutation = useMutation({
    mutationFn: (spinletId: string) => api.syncWebRoot(spinletId),
    onSuccess: (data, spinletId) => {
      toast.success(`Synced web root for ${spinletId}`);
      queryClient.invalidateQueries({ queryKey: ["hostingInfo"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to sync web root: ${error.message}`);
    },
  });

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getFrameworkIcon = (framework: string) => {
    switch (framework) {
      case "static":
        return <FolderOpen className="h-4 w-4" />;
      case "reverse-proxy":
        return <Link className="h-4 w-4" />;
      default:
        return <Server className="h-4 w-4" />;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case "running":
        return "text-green-600";
      case "idle":
        return "text-yellow-600";
      case "stopped":
        return "text-gray-600";
      default:
        return "text-red-600";
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <HardDrive className="h-8 w-8 text-gray-700 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Hosting Management
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Monitor deployments, web root, and domain mappings
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView("overview")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === "overview"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setView("comparison")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === "comparison"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Comparison
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {view === "overview" ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <Globe className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">
                  {hostingInfo?.length || 0}
                </span>
              </div>
              <p className="text-sm text-gray-600">Total Domains</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">
                  {
                    hostingInfo?.filter((h) => h.status.issues.length === 0)
                      .length || 0
                  }
                </span>
              </div>
              <p className="text-sm text-gray-600">Healthy</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-2xl font-bold">
                  {
                    hostingInfo?.filter((h) => h.status.issues.length > 0)
                      .length || 0
                  }
                </span>
              </div>
              <p className="text-sm text-gray-600">With Issues</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <Link className="h-5 w-5 text-purple-600" />
                <span className="text-2xl font-bold">
                  {hostingInfo?.filter((h) => h.proxy?.isProxy).length || 0}
                </span>
              </div>
              <p className="text-sm text-gray-600">Proxies</p>
            </div>
          </div>

          {/* Hosting List */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">All Hostings</h2>
            </div>

            {loadingHosting ? (
              <div className="p-8 text-center">
                <Loader className="h-8 w-8 text-gray-400 animate-spin mx-auto" />
                <p className="mt-2 text-gray-600">Loading hosting info...</p>
              </div>
            ) : (
              <div className="divide-y">
                {hostingInfo?.map((hosting) => (
                  <div
                    key={hosting.domain}
                    className="p-6 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedDomain(hosting.domain)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          {getFrameworkIcon(hosting.framework)}
                          <h3 className="ml-2 text-lg font-medium text-gray-900">
                            {hosting.domain}
                          </h3>
                          {hosting.proxy?.isProxy && (
                            <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                              Proxy
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center">
                            <span className="text-gray-500 mr-2">Redis:</span>
                            {getStatusIcon(hosting.status.redis)}
                          </div>
                          <div className="flex items-center">
                            <span className="text-gray-500 mr-2">
                              Deployment:
                            </span>
                            {getStatusIcon(hosting.status.deploymentFolder)}
                          </div>
                          <div className="flex items-center">
                            <span className="text-gray-500 mr-2">
                              Web Root:
                            </span>
                            {getStatusIcon(hosting.status.webRootFolder)}
                          </div>
                          {hosting.spinlet && (
                            <div className="flex items-center">
                              <span className="text-gray-500 mr-2">
                                Spinlet:
                              </span>
                              <span
                                className={`font-medium ${getStateColor(
                                  hosting.spinlet.state
                                )}`}
                              >
                                {hosting.spinlet.state}
                              </span>
                            </div>
                          )}
                        </div>

                        {hosting.status.issues.length > 0 && (
                          <div className="mt-2">
                            {hosting.status.issues.map((issue, i) => (
                              <div
                                key={i}
                                className="flex items-center text-sm text-red-600 mt-1"
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {issue}
                              </div>
                            ))}
                          </div>
                        )}

                        {hosting.proxy?.target && (
                          <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Proxy Target:</span>{" "}
                            {hosting.proxy.target}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center ml-4">
                        {hosting.status.issues.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              fixIssuesMutation.mutate(hosting.domain);
                            }}
                            disabled={fixIssuesMutation.isPending}
                            className="mr-2 p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Fix Issues"
                          >
                            {fixIssuesMutation.isPending ? (
                              <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                              <Wrench className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Comparison View */}
          {loadingComparison ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <Loader className="h-8 w-8 text-gray-400 animate-spin mx-auto" />
              <p className="mt-2 text-gray-600">Loading comparison data...</p>
            </div>
          ) : (
            <>
              {/* Mismatches Alert */}
              {comparison?.mismatches && comparison.mismatches.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        {comparison.mismatches.length} Mismatches Found
                      </h3>
                      <div className="mt-2 space-y-1">
                        {comparison.mismatches.map((mismatch, i) => (
                          <p key={i} className="text-sm text-red-700">
                            • {mismatch.description}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Deployment Folders */}
                <div className="bg-white rounded-lg shadow-sm">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold flex items-center">
                      <FolderOpen className="h-5 w-5 mr-2 text-blue-600" />
                      Deployment Folders ({comparison?.deploymentFolders.length})
                    </h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {comparison?.deploymentFolders.map((folder, i) => (
                      <div
                        key={i}
                        className="p-3 border-b hover:bg-gray-50 text-sm"
                      >
                        <div className="font-medium">
                          {folder.customerId}/{folder.appName}
                        </div>
                        <div className="text-gray-500 flex items-center mt-1">
                          {folder.hasConfig ? (
                            <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500 mr-1" />
                          )}
                          Config {folder.hasConfig ? "found" : "missing"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Web Root Folders */}
                <div className="bg-white rounded-lg shadow-sm">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold flex items-center">
                      <HardDrive className="h-5 w-5 mr-2 text-green-600" />
                      Web Root Folders ({comparison?.webRootFolders.length})
                    </h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {comparison?.webRootFolders.map((folder, i) => (
                      <div
                        key={i}
                        className="p-3 border-b hover:bg-gray-50 text-sm"
                      >
                        <div className="font-medium">
                          {folder.customerId}/{folder.appName}
                        </div>
                        <div className="text-gray-500">
                          {folder.size} files
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Redis Routes */}
                <div className="bg-white rounded-lg shadow-sm">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold flex items-center">
                      <Database className="h-5 w-5 mr-2 text-purple-600" />
                      Redis Routes ({comparison?.redisRoutes.length})
                    </h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {comparison?.redisRoutes.map((route, i) => (
                      <div
                        key={i}
                        className="p-3 border-b hover:bg-gray-50 text-sm"
                      >
                        <div className="font-medium">{route.domain}</div>
                        <div className="text-gray-500">
                          {route.customerId} / {route.spinletId}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {route.framework}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Selected Domain Details Modal */}
      {selectedDomain && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedDomain(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">{selectedDomain}</h2>
            </div>
            <div className="p-6">
              {/* Add detailed hosting info here */}
              <button
                onClick={() => setSelectedDomain(null)}
                className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}