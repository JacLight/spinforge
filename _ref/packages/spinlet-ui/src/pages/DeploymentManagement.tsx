import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import {
  Upload,
  RefreshCw,
  Trash2,
  Play,
  Square,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Folder,
  Archive,
  Terminal,
  Settings,
  Eye,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";

interface DeploymentStatus {
  name: string;
  status: "pending" | "building" | "success" | "failed" | "processing" | "unhealthy" | "orphaned";
  timestamp: string;
  error?: string;
  buildTime?: number;
  domains?: string[];
  framework?: string;
  customerId?: string;
  spinletId?: string;
  mode?: 'development' | 'production';
  packageVersion?: string;
  runCommand?: string;
  orphaned?: boolean;
  buildPath?: string;
}

export default function DeploymentManagement() {
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(
    null
  );
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch deployment statuses
  const {
    data: deployments,
    isLoading: isInitialLoading,
    isFetching,
  } = useQuery<DeploymentStatus[]>({
    queryKey: ["deployments"],
    queryFn: () => api.getDeployments(),
    refetchInterval: 10000, // Background refresh every 10 seconds
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    staleTime: 5000, // Consider data fresh for 5 seconds
    retry: 1, // Only retry once on failure
  });

  // Fetch deployment folder contents
  const { data: deploymentFolder } = useQuery({
    queryKey: ["deployment-folder"],
    queryFn: () => api.scanDeployments(),
    refetchInterval: 60000, // Refresh every 60 seconds
    refetchOnWindowFocus: false,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Mutations for deployment management
  const retryMutation = useMutation({
    mutationFn: (deploymentName: string) => api.retryDeployment(deploymentName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (deploymentName: string) => api.cancelDeployment(deploymentName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (deploymentName: string) => api.deleteDeployment(deploymentName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
      queryClient.invalidateQueries({ queryKey: ["deployment-folder"] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => api.scanDeployments(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
      queryClient.invalidateQueries({ queryKey: ["deployment-folder"] });
    },
  });
  
  const cleanupOrphanedMutation = useMutation({
    mutationFn: (domain: string) => api.cleanupOrphanedDeployment(domain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
    },
  });
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "building":
      case "processing":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "unhealthy":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "orphaned":
        return <Trash2 className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "building":
      case "processing":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "success":
        return "bg-green-50 text-green-700 border-green-200";
      case "failed":
        return "bg-red-50 text-red-700 border-red-200";
      case "unhealthy":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "orphaned":
        return "bg-gray-100 text-gray-700 border-gray-300";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const deploymentData = deployments || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Deployment Management
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Monitor and manage hot deployments
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => scanMutation.mutate()}
                  disabled={scanMutation.isPending}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      scanMutation.isPending ? "animate-spin" : ""
                    }`}
                  />
                  <span>Scan Folder</span>
                </button>
                <button className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                  <Upload className="h-4 w-4" />
                  <span>Upload</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Deployment Status */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {/* Active Deployments */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Active Deployments
                  </h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {isInitialLoading ? (
                    <div className="p-6 text-center">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500 mt-2">
                        Loading deployments...
                      </p>
                    </div>
                  ) : deploymentData.length === 0 ? (
                    <div className="p-6 text-center">
                      <Folder className="h-12 w-12 mx-auto text-gray-300" />
                      <p className="text-gray-500 mt-2">No deployments found</p>
                    </div>
                  ) : (
                    deploymentData.map((deployment, index) => (
                      <motion.div
                        key={deployment.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-6 hover:bg-gray-50 cursor-pointer ${
                          selectedDeployment === deployment.name
                            ? "bg-blue-50 border-l-4 border-blue-500"
                            : ""
                        }`}
                        onClick={() => setSelectedDeployment(deployment.name)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {getStatusIcon(deployment.status)}
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {deployment.name}
                              </h3>
                              <div className="flex items-center space-x-2 mt-1">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                                    deployment.status
                                  )}`}
                                >
                                  {deployment.status.toUpperCase()}
                                </span>
                                {deployment.framework && (
                                  <span className="text-xs text-gray-500">
                                    {deployment.framework}
                                  </span>
                                )}
                                {deployment.mode && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    deployment.mode === 'development' 
                                      ? 'bg-purple-100 text-purple-700' 
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {deployment.mode === 'development' ? 'DEV' : 'PROD'}
                                  </span>
                                )}
                                {deployment.buildTime && (
                                  <span className="text-xs text-gray-500">
                                    {Math.round(deployment.buildTime / 1000)}s
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {deployment.status === "building" ||
                            deployment.status === "processing" ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelMutation.mutate(deployment.name);
                                }}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Cancel"
                              >
                                <Square className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  retryMutation.mutate(deployment.name);
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title={
                                  deployment.status === "failed"
                                    ? "Retry failed deployment"
                                    : "Force redeploy"
                                }
                                disabled={retryMutation.isPending}
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ${
                                    retryMutation.isPending
                                      ? "animate-spin"
                                      : ""
                                  }`}
                                />
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowLogs(deployment.name);
                              }}
                              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                              title="View Logs"
                            >
                              <FileText className="h-4 w-4" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    `Remove deployment ${deployment.name}?`
                                  )
                                ) {
                                  removeMutation.mutate(deployment.name);
                                }
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {deployment.error && (
                          <div className="mt-4 p-3 bg-red-50 rounded-lg">
                            <p className="text-sm text-red-700">
                              {deployment.error}
                            </p>
                          </div>
                        )}
                        
                        {deployment.status === "orphaned" && (
                          <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                            <p className="text-sm text-gray-700 mb-2">
                              ⚠️ This deployment's folder no longer exists
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    `Clean up orphaned deployment ${deployment.name}? This will remove all routes.`
                                  )
                                ) {
                                  const domain = deployment.domains?.[0];
                                  if (domain) {
                                    cleanupOrphanedMutation.mutate(domain);
                                  }
                                }
                              }}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                              disabled={cleanupOrphanedMutation.isPending}
                            >
                              {cleanupOrphanedMutation.isPending ? "Cleaning up..." : "Clean Up Orphaned Deployment"}
                            </button>
                          </div>
                        )}

                        {deployment.domains &&
                          deployment.domains.length > 0 && (
                            <div className="mt-4">
                              <div className="flex flex-wrap gap-2">
                                {deployment.domains.map((domain) => (
                                  <span
                                    key={domain}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                                  >
                                    {domain}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Quick Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="font-semibold">{deploymentData.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Success</span>
                  <span className="font-semibold text-green-600">
                    {
                      deploymentData.filter((d) => d.status === "success")
                        .length
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Failed</span>
                  <span className="font-semibold text-red-600">
                    {deploymentData.filter((d) => d.status === "failed").length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Building</span>
                  <span className="font-semibold text-blue-600">
                    {
                      deploymentData.filter(
                        (d) =>
                          d.status === "building" || d.status === "processing"
                      ).length
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Orphaned</span>
                  <span className="font-semibold text-gray-600">
                    {deploymentData.filter((d) => d.status === "orphaned").length}
                  </span>
                </div>
              </div>
            </div>

            {/* Deployment Folder */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Deployment Folder
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Path</span>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    /spinforge/deployments
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Items</span>
                  <span className="font-semibold">
                    {deploymentFolder?.items?.length || 0}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <button className="w-full flex items-center space-x-2 px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg">
                  <Folder className="h-4 w-4 text-gray-500" />
                  <span>Browse Files</span>
                </button>
                <button className="w-full flex items-center space-x-2 px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg">
                  <Upload className="h-4 w-4 text-gray-500" />
                  <span>Upload Archive</span>
                </button>
              </div>
            </div>

            {/* Selected Deployment Details */}
            {selectedDeployment && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Deployment Details
                </h3>
                {(() => {
                  const deployment = deploymentData.find(
                    (d) => d.name === selectedDeployment
                  );
                  if (!deployment) return null;

                  return (
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-gray-600">Name</span>
                        <p className="font-medium">{deployment.name}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Status</span>
                        <div className="flex items-center space-x-2 mt-1">
                          {getStatusIcon(deployment.status)}
                          <span className="font-medium">
                            {deployment.status}
                          </span>
                        </div>
                      </div>
                      {deployment.framework && (
                        <div>
                          <span className="text-sm text-gray-600">
                            Framework
                          </span>
                          <p className="font-medium">{deployment.framework}</p>
                        </div>
                      )}
                      {deployment.mode && (
                        <div>
                          <span className="text-sm text-gray-600">Mode</span>
                          <p className="font-medium">
                            <span className={`px-2 py-1 rounded text-xs ${
                              deployment.mode === 'development' 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {deployment.mode.toUpperCase()}
                            </span>
                          </p>
                        </div>
                      )}
                      {deployment.packageVersion && (
                        <div>
                          <span className="text-sm text-gray-600">Version</span>
                          <p className="font-medium">{deployment.packageVersion}</p>
                        </div>
                      )}
                      {deployment.runCommand && (
                        <div>
                          <span className="text-sm text-gray-600">Run Command</span>
                          <p className="font-medium text-sm font-mono bg-gray-100 p-2 rounded">
                            {deployment.runCommand}
                          </p>
                        </div>
                      )}
                      {deployment.customerId && (
                        <div>
                          <span className="text-sm text-gray-600">
                            Customer ID
                          </span>
                          <p className="font-medium">{deployment.customerId}</p>
                        </div>
                      )}
                      {deployment.spinletId && (
                        <div>
                          <span className="text-sm text-gray-600">
                            Spinlet ID
                          </span>
                          <p className="font-medium text-xs">
                            {deployment.spinletId}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-sm text-gray-600">Timestamp</span>
                        <p className="font-medium text-sm">
                          {new Date(deployment.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full h-96">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                Deployment Logs - {showLogs}
              </h3>
              <button
                onClick={() => setShowLogs(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ×
              </button>
            </div>
            <div className="p-4 h-full overflow-auto">
              <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs font-mono h-full overflow-auto">
                {`[${new Date().toISOString()}] Processing deployment: ${showLogs}
[${new Date().toISOString()}] Starting build process...
[${new Date().toISOString()}] Running npm install --include=dev
[${new Date().toISOString()}] npm install completed
[${new Date().toISOString()}] Running npm run build
[${new Date().toISOString()}] Build failed with error:
Cannot find module 'axios' or its corresponding type declarations.
[${new Date().toISOString()}] Deployment failed`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
