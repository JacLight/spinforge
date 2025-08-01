import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, RouteDetails, SpinletLogs, CommandResult } from "../services/api";
import { config } from "../config/environment";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  RotateCw,
  Square,
  ExternalLink,
  Terminal as TerminalIcon,
  FileCode,
  Activity,
  AlertCircle,
  CheckCircle,
  Edit,
  Save,
  X,
  XCircle,
  Plus,
  Trash,
  Globe,
  Server,
  Clock,
  MemoryStick,
  Cpu,
  Wrench,
  HardDrive,
  FolderOpen,
  Database,
} from "lucide-react";
import { motion } from "framer-motion";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

export default function ApplicationDetail() {
  const { domain } = useParams<{ domain: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [editMode, setEditMode] = useState(false);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [newDomain, setNewDomain] = useState("");
  const [diag, setDiag] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  const {
    data: routeDetails,
    isLoading,
    error,
  } = useQuery<RouteDetails>({
    queryKey: ["route-details", domain],
    queryFn: () => api.getRouteDetails(domain!),
    refetchInterval: 5000,
    retry: 2,
  });

  const { data: logs } = useQuery<SpinletLogs>({
    queryKey: ["spinlet-logs", routeDetails?.spinlet?.spinletId],
    queryFn: () => api.getSpinletLogs(routeDetails?.spinlet?.spinletId || ""),
    enabled: !!routeDetails?.spinlet?.spinletId && activeTab === "logs",
    refetchInterval: 2000,
  });

  const { data: hostingInfo } = useQuery({
    queryKey: ["hosting-info", domain],
    queryFn: () => api.getHostingInfoForDomain(domain!),
    enabled: !!domain,
    refetchInterval: 30000,
  });

  const startMutation = useMutation({
    mutationFn: () => api.startSpinlet(routeDetails?.spinlet?.spinletId || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-details"] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => api.stopSpinlet(routeDetails?.spinlet?.spinletId || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-details"] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: () =>
      api.restartSpinlet(routeDetails?.spinlet?.spinletId || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-details"] });
    },
  });

  const updateEnvMutation = useMutation({
    mutationFn: () =>
      api.updateSpinletEnv(routeDetails?.spinlet?.spinletId || "", envVars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-details"] });
      setEditMode(false);
    },
  });

  const addDomainMutation = useMutation({
    mutationFn: () =>
      api.addDomainToRoute(domain!, newDomain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-details"] });
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      setNewDomain("");
      setEditMode(false);
      toast.success("Domain added successfully");
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || error.message || "Failed to add domain";
      toast.error(errorMessage);
    },
  });

  const removeDomainMutation = useMutation({
    mutationFn: (domainToRemove: string) => api.removeDomainFromRoute(domain!, domainToRemove),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-details"] });
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Domain removed successfully");
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || error.message || "Failed to remove domain";
      toast.error(errorMessage);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg">Error loading application</p>
          <p className="text-sm text-gray-500 mt-2">Domain: {domain}</p>
          <p className="text-xs text-red-600 mt-2">
            {(error as any)?.message || "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  if (!routeDetails) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg">Application not found</p>
          <p className="text-sm text-gray-500 mt-2">Domain: {domain}</p>
        </div>
      </div>
    );
  }

  const { route, spinlet, metrics, health } = routeDetails;
  const spinletState = spinlet?.state;
  const isRunning = spinletState === "running";
  const isStaticOrProxy = route.framework === 'static' || route.framework === 'reverse-proxy';

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const runTroubleshoot = async () => {
    if (!routeDetails?.spinlet?.spinletId) return;
    setDiagLoading(true);
    setDiag(null);
    try {
      const data = await api.getSpinletHealth(routeDetails.spinlet.spinletId);
      setDiag(data);
    } catch (error) {
      setDiag({
        error: "Failed to run troubleshoot",
        message: (error as any).message,
      });
    }
    setDiagLoading(false);
  };

  const tabs = isStaticOrProxy 
    ? [
        { id: "overview", label: "Overview", icon: Activity },
        { id: "config", label: "Configuration", icon: Edit },
        { id: "troubleshoot", label: "Troubleshoot", icon: Wrench },
      ]
    : [
        { id: "overview", label: "Overview", icon: Activity },
        { id: "logs", label: "Logs", icon: FileCode },
        { id: "metrics", label: "Metrics", icon: Activity },
        { id: "config", label: "Configuration", icon: Edit },
        { id: "console", label: "Console", icon: TerminalIcon },
        { id: "troubleshoot", label: "Troubleshoot", icon: Wrench },
      ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate("/applications")}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{domain}</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Customer: {route.customerId} • 
                    {isStaticOrProxy 
                      ? <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          route.framework === 'static' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {route.framework === 'static' ? 'Static Site' : 'Reverse Proxy'}
                        </span>
                      : <>
                          Spinlet: {spinlet?.spinletId}
                          {spinlet?.mode && (
                            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              spinlet.mode === 'development' 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {spinlet.mode === 'development' ? 'DEV' : 'PROD'}
                            </span>
                          )}
                        </>
                    }
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                {!isStaticOrProxy && (
                  <>
                    {!isRunning && (
                      <button
                        onClick={() => startMutation.mutate()}
                        disabled={startMutation.isPending}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Play className="h-4 w-4" />
                        <span>Start</span>
                      </button>
                    )}
                    {isRunning && (
                      <>
                        <button
                          onClick={() => restartMutation.mutate()}
                          disabled={restartMutation.isPending}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <RotateCw className="h-4 w-4" />
                          <span>Restart</span>
                        </button>
                        <button
                          onClick={() => stopMutation.mutate()}
                          disabled={stopMutation.isPending}
                          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <Square className="h-4 w-4" />
                          <span>Stop</span>
                        </button>
                      </>
                    )}
                  </>
                )}
                {isStaticOrProxy && (
                  <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">
                      {route.framework === 'static' ? 'Static Site' : 'Reverse Proxy'} (Always Active)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-8 border-t">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-1 py-4 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Application Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <div className="flex items-center mt-1">
                    {isStaticOrProxy ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        <span className="font-medium text-green-700">Active</span>
                      </>
                    ) : (
                      <>
                        {isRunning ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                        )}
                        <span
                          className={`font-medium ${
                            isRunning ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {spinletState || "Unknown"}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Uptime</p>
                  <p className="font-medium mt-1">
                    {isStaticOrProxy
                      ? "N/A"
                      : spinlet?.startTime
                      ? formatUptime(
                          (Date.now() - spinlet.startTime) / 1000
                        )
                      : "-"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Requests</p>
                  <p className="font-medium mt-1">
                    {isStaticOrProxy ? "N/A" : spinlet?.requests || 0}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Errors</p>
                  <p className="font-medium mt-1 text-red-600">
                    {isStaticOrProxy ? "N/A" : spinlet?.errors || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Access URLs */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Access URLs</h3>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Public Domains</p>
                  <div className="space-y-2">
                    {spinlet?.domains?.map((d) => (
                      <div
                        key={d}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <Globe className="h-5 w-5 text-gray-400" />
                          <a
                            href={`http://${d}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                          >
                            <span>{d}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {spinlet?.domains?.length > 1 && (
                          <button
                            onClick={() => removeDomainMutation.mutate(d)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    {!editMode && (
                      <button
                        onClick={() => setEditMode(true)}
                        className="flex items-center space-x-2 text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Domain</span>
                      </button>
                    )}

                    {editMode && (
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={newDomain}
                          onChange={(e) => setNewDomain(e.target.value)}
                          placeholder="new-domain.com"
                          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => {
                            // Basic domain validation
                            if (!/^[a-zA-Z0-9_]+([-.]{1}[a-zA-Z0-9_]+)*(\.[a-zA-Z0-9_]+)*\.[a-zA-Z]{2,}$/i.test(newDomain)) {
                              toast.error("Invalid domain format");
                              return;
                            }
                            addDomainMutation.mutate();
                          }}
                          disabled={!newDomain || addDomainMutation.isPending}
                          className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {addDomainMutation.isPending ? "Adding..." : "Add"}
                        </button>
                        <button
                          onClick={() => {
                            setEditMode(false);
                            setNewDomain("");
                          }}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {!isStaticOrProxy && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">
                      Internal Service Path
                    </p>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Server className="h-5 w-5 text-gray-400" />
                      <a
                        href={`http://${spinlet?.servicePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                      >
                        <span>{spinlet?.servicePath}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
                {route.framework === 'reverse-proxy' && route.config?.proxy?.target && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">
                      Proxy Target
                    </p>
                    <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                      <Server className="h-5 w-5 text-purple-500" />
                      <span className="text-purple-700 font-mono text-sm">
                        {route.config.proxy.target}
                      </span>
                    </div>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    Internal Docker URLs
                  </p>
                  <div className="space-y-2">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 mb-1">From other containers:</p>
                      <div className="flex items-center space-x-3">
                        <Server className="h-5 w-5 text-blue-500" />
                        <code className="text-blue-700 font-mono text-sm">
                          http://spinforge-hub:8080
                        </code>
                      </div>
                      <p className="text-xs text-blue-500 mt-1">Use Host header: {domain}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">From host machine:</p>
                      <div className="flex items-center space-x-3">
                        <Server className="h-5 w-5 text-gray-500" />
                        <a
                          href={config.SPINHUB_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-700 hover:text-gray-900 font-mono text-sm flex items-center space-x-1"
                        >
                          <span>{config.SPINHUB_URL}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Use Host header: {domain}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hosting Status */}
            {hostingInfo && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Hosting Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4 text-purple-500" />
                        <span className="text-sm text-gray-600">Redis Route</span>
                      </div>
                      {hostingInfo.status.redis ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Route configured in Redis
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <FolderOpen className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-gray-600">Deployment Folder</span>
                      </div>
                      {hostingInfo.status.deploymentFolder ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {hostingInfo.paths.deploymentPath || "No path configured"}
                    </p>
                  </div>

                  {route.framework === 'static' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <HardDrive className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-gray-600">Web Root</span>
                        </div>
                        {hostingInfo.status.webRootFolder ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {hostingInfo.paths.webRootPath || "Not synced"}
                      </p>
                    </div>
                  )}
                </div>

                {hostingInfo.status.issues.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="h-4 w-4 text-red-400 mt-0.5" />
                      <div className="ml-2">
                        <p className="text-sm font-medium text-red-800">Issues Found</p>
                        <ul className="mt-1 text-xs text-red-700 list-disc list-inside">
                          {hostingInfo.status.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resource Usage */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Resource Usage</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">CPU Usage</span>
                    </div>
                    <span className="text-sm font-medium">
                      {isStaticOrProxy ? "N/A" : `${spinlet?.cpu || 0}%`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    {!isStaticOrProxy && (
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
                        style={{ width: `${spinlet?.cpu || 0}%` }}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <MemoryStick className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Memory Usage
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {isStaticOrProxy ? "N/A" : formatBytes(spinlet?.memory || 0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    {!isStaticOrProxy && (
                      <div
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((spinlet?.memory || 0) /
                                (1024 * 1024 * 512)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Deployment Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">
                Deployment Information
              </h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Framework</dt>
                  <dd className="font-medium mt-1">{route.framework}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Deployment Path</dt>
                  <dd className="font-medium mt-1 font-mono text-sm">
                    {route.buildPath}
                  </dd>
                </div>
                {spinlet?.packageVersion && (
                  <div>
                    <dt className="text-sm text-gray-500">Version</dt>
                    <dd className="font-medium mt-1">{spinlet.packageVersion}</dd>
                  </div>
                )}
                {spinlet?.runCommand && (
                  <div>
                    <dt className="text-sm text-gray-500">Run Command</dt>
                    <dd className="font-medium mt-1 font-mono text-sm bg-gray-100 p-2 rounded">
                      {spinlet.runCommand}
                    </dd>
                  </div>
                )}
                {!isStaticOrProxy && (
                  <>
                    <div>
                      <dt className="text-sm text-gray-500">Server</dt>
                      <dd className="font-medium mt-1">
                        {spinlet?.host || "localhost"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Service Path</dt>
                      <dd className="font-medium mt-1 font-mono">
                        {spinlet?.servicePath || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Process ID</dt>
                      <dd className="font-medium mt-1">
                        {spinlet?.pid || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Port</dt>
                      <dd className="font-medium mt-1">
                        {spinlet?.port || "-"}
                      </dd>
                    </div>
                  </>
                )}
                {route.framework === 'reverse-proxy' && route.config?.proxy && (
                  <>
                    <div>
                      <dt className="text-sm text-gray-500">Proxy Target</dt>
                      <dd className="font-medium mt-1 font-mono text-purple-600">
                        {route.config.proxy.target}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Change Origin</dt>
                      <dd className="font-medium mt-1">
                        {route.config.proxy.changeOrigin ? 'Yes' : 'No'}
                      </dd>
                    </div>
                  </>
                )}
                <div>
                  <dt className="text-sm text-gray-500">Last Access</dt>
                  <dd className="font-medium mt-1">
                    {spinlet?.lastAccess
                      ? new Date(spinlet.lastAccess).toLocaleString()
                      : "Never"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Customer ID</dt>
                  <dd className="font-medium mt-1">{route.customerId}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="bg-white rounded-lg shadow">
            {isStaticOrProxy ? (
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Application Logs</h3>
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <FileCode className="h-12 w-12 text-gray-400" />
                  </div>
                  <p className="text-gray-500">
                    Logs are not available for {route.framework === 'static' ? 'static sites' : 'reverse proxy deployments'}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    {route.framework === 'static' 
                      ? 'Static files are served directly without generating logs'
                      : 'Proxy requests are handled at the infrastructure level'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-6 border-b flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Application Logs</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        if (xtermRef.current) {
                          xtermRef.current.clear();
                        }
                      }}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => {
                        queryClient.invalidateQueries({
                          queryKey: [
                            "spinlet-logs",
                            routeDetails?.spinlet?.spinletId,
                          ],
                        });
                      }}
                      className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <LogTerminal spinletId={routeDetails?.spinlet?.spinletId || ""} />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "metrics" && (
          <div className="space-y-6">
            {isStaticOrProxy ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Activity className="h-12 w-12 text-gray-400" />
                  </div>
                  <p className="text-gray-500">
                    Metrics are not available for {route.framework === 'static' ? 'static sites' : 'reverse proxy deployments'}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    {route.framework === 'static' 
                      ? 'Static files are served directly without a running process'
                      : 'Requests are forwarded directly to the target URL'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Performance Metrics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">CPU Usage</span>
                      <Cpu className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {spinlet?.cpu || 0}%
                    </div>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        style={{ width: `${spinlet?.cpu || 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Memory</span>
                      <MemoryStick className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatBytes(spinlet?.memory || 0)}
                    </div>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((spinlet?.memory || 0) /
                                (1024 * 1024 * 512)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Requests</span>
                      <Activity className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {spinlet?.requests || 0}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {spinlet?.errors || 0} errors
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t pt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">
                    Application Health
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Process Status
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          health?.checks?.process === "pass"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {health?.checks?.process === "pass"
                          ? "Healthy"
                          : "Unhealthy"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Port Accessibility
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          health?.checks?.port === "pass"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {health?.checks?.port === "pass" ? "Open" : "Closed"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Last Health Check
                      </span>
                      <span className="text-sm text-gray-900">
                        {health?.lastCheck
                          ? new Date(health.lastCheck).toLocaleTimeString()
                          : "Never"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "config" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Environment Variables</h3>
                {!editMode && (
                  <button
                    onClick={() => {
                      setEditMode(true);
                      setEnvVars(route.config?.env || {});
                    }}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                )}
              </div>

              {!editMode ? (
                <dl className="space-y-2">
                  {Object.entries(route.config?.env || {}).map(
                    ([key, value]) => (
                      <div key={key} className="flex">
                        <dt className="font-mono text-sm text-gray-600 w-1/3">
                          {key}
                        </dt>
                        <dd className="font-mono text-sm text-gray-900">
                          {String(value)}
                        </dd>
                      </div>
                    )
                  )}
                </dl>
              ) : (
                <div className="space-y-4">
                  {Object.entries(envVars).map(([key, value]) => (
                    <div key={key} className="flex space-x-2">
                      <input
                        type="text"
                        value={key}
                        readOnly
                        className="flex-1 px-3 py-2 border rounded-lg bg-gray-50"
                      />
                      <input
                        type="text"
                        value={String(value)}
                        onChange={(e) =>
                          setEnvVars({ ...envVars, [key]: e.target.value })
                        }
                        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => {
                          const newVars = { ...envVars };
                          delete newVars[key];
                          setEnvVars(newVars);
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash className="h-5 w-5" />
                      </button>
                    </div>
                  ))}

                  <div className="flex justify-between">
                    <button
                      onClick={() => setEnvVars({ ...envVars, "": "" })}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      Add Variable
                    </button>

                    <div className="space-x-2">
                      <button
                        onClick={() => updateEnvMutation.mutate()}
                        disabled={updateEnvMutation.isPending}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setEditMode(false);
                          setEnvVars({});
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Resource Limits</h3>
              <dl className="space-y-2">
                <div className="flex">
                  <dt className="text-sm text-gray-600 w-1/3">Memory</dt>
                  <dd className="text-sm text-gray-900">
                    {route.config?.memory || "Default"}
                  </dd>
                </div>
                <div className="flex">
                  <dt className="text-sm text-gray-600 w-1/3">CPU</dt>
                  <dd className="text-sm text-gray-900">
                    {route.config?.cpu || "Default"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {activeTab === "console" && (
          <div className="bg-white rounded-lg shadow">
            {isStaticOrProxy ? (
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Interactive Console</h3>
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <TerminalIcon className="h-12 w-12 text-gray-400" />
                  </div>
                  <p className="text-gray-500">
                    Console is not available for {route.framework === 'static' ? 'static sites' : 'reverse proxy deployments'}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    {route.framework === 'static' 
                      ? 'Static files have no running container to access'
                      : 'Reverse proxy has no container environment'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-6 border-b">
                  <h3 className="text-lg font-semibold">Interactive Console</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Execute commands in the container
                  </p>
                </div>
                <div className="p-6">
                  <CommandTerminal
                    spinletId={routeDetails?.spinlet?.spinletId || ""}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "troubleshoot" && (
          <div className="bg-white rounded-lg shadow p-6">
            {isStaticOrProxy ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {route.framework === 'static' ? 'Static Site' : 'Reverse Proxy'} Diagnostics
                  </h3>
                  <button
                    onClick={async () => {
                      setDiagLoading(true);
                      setDiag(null);
                      try {
                        // Check if the site is accessible
                        const testUrl = `${window.location.protocol}//${domain}`;
                        const routes = await api.getAllRoutes();
                        const thisRoute = routes.find((r: any) => r.domain === domain);
                        
                        const diagnostics: any = {
                          status: 'active',
                          healthy: true,
                          framework: route.framework,
                          checks: {}
                        };

                        // Check route registration
                        diagnostics.checks.route_registered = thisRoute ? 'pass' : 'fail';
                        
                        // Check deployment status
                        diagnostics.checks.deployment_status = thisRoute ? 'pass' : 'fail';
                        
                        if (route.framework === 'static') {
                          // Check if deployment directory exists
                          diagnostics.deployment_path = route.buildPath;
                          
                          // Check if the deployment path actually exists
                          try {
                            const scanData = await api.scanDeployments();
                            const deploymentName = route.buildPath.split('/').pop();
                            const exists = scanData.items?.some((item) => 
                              item.name === deploymentName && item.type === 'directory'
                            );
                            diagnostics.checks.deployment_exists = exists ? 'pass' : 'fail';
                            diagnostics.checks.files_deployed = exists ? 'pass' : 'fail';
                            
                            if (!exists) {
                              diagnostics.healthy = false;
                              diagnostics.error = 'Deployment directory not found';
                            } else {
                              // Verify deployment to check for index.html
                              try {
                                const verifyResponse = await api.verifyDeployment(deploymentName);
                                diagnostics.checks.index_html_exists = verifyResponse.accessible ? 'pass' : 'fail';
                                
                                if (!verifyResponse.accessible) {
                                  diagnostics.healthy = false;
                                  diagnostics.error = verifyResponse.error || 'Static files not accessible';
                                  
                                  // Add specific error details
                                  if (verifyResponse.status === 'no-index') {
                                    diagnostics.missing_files = ['index.html'];
                                  }
                                }
                                
                                diagnostics.verification_status = verifyResponse.status;
                                diagnostics.file_count = verifyResponse.files;
                              } catch (e) {
                                diagnostics.checks.index_html_exists = 'fail';
                                diagnostics.error = 'Failed to verify deployment';
                              }
                            }
                          } catch (e) {
                            diagnostics.checks.deployment_exists = 'fail';
                            diagnostics.checks.files_deployed = 'fail';
                            diagnostics.checks.index_html_exists = 'fail';
                            diagnostics.healthy = false;
                          }
                        } else if (route.framework === 'reverse-proxy') {
                          // Show proxy configuration
                          diagnostics.proxy_config = route.config?.proxy;
                          diagnostics.checks.proxy_configured = route.config?.proxy?.target ? 'pass' : 'fail';
                        }
                        
                        diagnostics.healthy = Object.values(diagnostics.checks).every(c => c === 'pass');
                        diagnostics.status = diagnostics.healthy ? 'healthy' : 'unhealthy';
                        
                        setDiag(diagnostics);
                      } catch (error) {
                        setDiag({
                          error: 'Failed to run diagnostics',
                          message: (error as any).message,
                          healthy: false,
                          status: 'error'
                        });
                      }
                      setDiagLoading(false);
                    }}
                    disabled={diagLoading}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Wrench className="h-4 w-4" />
                    <span>{diagLoading ? "Running..." : "Run Diagnostics"}</span>
                  </button>
                </div>

                {diagLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span className="ml-3 text-gray-600">
                      Running diagnostics...
                    </span>
                  </div>
                )}

                {diag && !diagLoading && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">
                          Deployment Status
                        </h4>
                        <div className="flex items-center space-x-2">
                          {diag.healthy ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span
                            className={`font-medium ${
                              diag.healthy ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {diag.status === 'active' ? 'Active' : diag.status || 'Unknown'}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Framework</h4>
                        <p className="text-sm text-gray-600">
                          {route.framework === 'static' ? 'Static Site' : 'Reverse Proxy'}
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 mb-3">
                        Diagnostic Checks
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(diag.checks || {}).map(
                          ([check, status]) => (
                            <div
                              key={check}
                              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                            >
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {check.replace(/_/g, ' ')}
                              </span>
                              <div className="flex items-center space-x-2">
                                {status === "pass" ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span
                                  className={`text-xs font-medium ${
                                    status === "pass"
                                      ? "text-green-700"
                                      : "text-red-700"
                                  }`}
                                >
                                  {status?.toString().toUpperCase()}
                                </span>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {route.framework === 'static' && diag.deployment_path && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium text-gray-900 mb-2">Deployment Details</h4>
                        <dl className="space-y-1">
                          <div className="flex">
                            <dt className="text-sm text-gray-600 w-32">Build Path:</dt>
                            <dd className="text-sm font-mono text-gray-900">{diag.deployment_path}</dd>
                          </div>
                        </dl>
                      </div>
                    )}

                    {route.framework === 'reverse-proxy' && diag.proxy_config && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium text-gray-900 mb-2">Proxy Configuration</h4>
                        <dl className="space-y-1">
                          <div className="flex">
                            <dt className="text-sm text-gray-600 w-32">Target URL:</dt>
                            <dd className="text-sm font-mono text-purple-600">{diag.proxy_config.target}</dd>
                          </div>
                          <div className="flex">
                            <dt className="text-sm text-gray-600 w-32">Change Origin:</dt>
                            <dd className="text-sm text-gray-900">{diag.proxy_config.changeOrigin ? 'Yes' : 'No'}</dd>
                          </div>
                          {diag.proxy_config.headers && (
                            <div className="mt-2">
                              <dt className="text-sm text-gray-600">Custom Headers:</dt>
                              <dd className="mt-1">
                                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                  {JSON.stringify(diag.proxy_config.headers, null, 2)}
                                </pre>
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}

                    {diag.error && (
                      <div className="border-t pt-4">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="h-5 w-5 text-red-500" />
                            <h4 className="font-medium text-red-800">Error</h4>
                          </div>
                          <p className="text-sm text-red-700 mt-2">{diag.error}</p>
                          {diag.message && (
                            <p className="text-xs text-red-600 mt-1">
                              {diag.message}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!diag && !diagLoading && (
                  <div className="text-center py-12">
                    <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                      Click "Run Diagnostics" to check {route.framework === 'static' ? 'static site' : 'reverse proxy'} health
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {route.framework === 'static' 
                        ? 'This will verify route registration and deployment status'
                        : 'This will verify proxy configuration and route status'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    Application Troubleshoot
                  </h3>
                  <button
                    onClick={runTroubleshoot}
                    disabled={diagLoading}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Wrench className="h-4 w-4" />
                    <span>{diagLoading ? "Running..." : "Run Diagnostics"}</span>
                  </button>
                </div>

            {diagLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-3 text-gray-600">
                  Running diagnostics...
                </span>
              </div>
            )}

            {diag && !diagLoading && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Health Status
                    </h4>
                    <div className="flex items-center space-x-2">
                      {diag.healthy ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span
                        className={`font-medium ${
                          diag.healthy ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {diag.status || "Unknown"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Uptime</h4>
                    <p className="text-sm text-gray-600">
                      {diag.uptime ? formatUptime(diag.uptime / 1000) : "N/A"}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Diagnostic Checks
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(diag.checks || {}).map(
                      ([check, status]) => {
                        // Special handling for endpoints array
                        if (check === "endpoints" && Array.isArray(status)) {
                          return (
                            <div key={check} className="space-y-2">
                              <div className="text-sm font-medium text-gray-700 mb-2">
                                Health Endpoints
                              </div>
                              {status.map((endpoint: any, index: number) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between py-1 px-3 bg-gray-100 rounded text-xs"
                                >
                                  <span className="font-mono text-gray-600">
                                    {endpoint.path}
                                  </span>
                                  <div className="flex items-center space-x-2">
                                    {endpoint.ok ? (
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <AlertCircle className="h-3 w-3 text-red-500" />
                                    )}
                                    <span
                                      className={`font-medium ${
                                        endpoint.ok
                                          ? "text-green-700"
                                          : "text-red-700"
                                      }`}
                                    >
                                      {endpoint.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        }

                        // Regular check handling
                        return (
                          <div
                            key={check}
                            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                          >
                            <span className="text-sm font-medium text-gray-700 capitalize">
                              {check.replace("_", " ")}
                            </span>
                            <div className="flex items-center space-x-2">
                              {status === "pass" || status === true ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span
                                className={`text-xs font-medium ${
                                  status === "pass" || status === true
                                    ? "text-green-700"
                                    : "text-red-700"
                                }`}
                              >
                                {typeof status === "boolean"
                                  ? status
                                    ? "PASS"
                                    : "FAIL"
                                  : status?.toString().toUpperCase()}
                              </span>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Raw Diagnostic Data
                  </h4>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                    {JSON.stringify(diag, null, 2)}
                  </pre>
                </div>

                {diag.error && (
                  <div className="border-t pt-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <h4 className="font-medium text-red-800">Error</h4>
                      </div>
                      <p className="text-sm text-red-700 mt-2">{diag.error}</p>
                      {diag.message && (
                        <p className="text-xs text-red-600 mt-1">
                          {diag.message}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!diag && !diagLoading && (
              <div className="text-center py-12">
                <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  Click "Run Diagnostics" to troubleshoot this application
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  This will check process health, port accessibility, and other
                  system status
                </p>
              </div>
            )}
          </>
        )}
      </div>
    )}
      </div>
    </div>
  );
}

// LogTerminal component for displaying logs
function LogTerminal({ spinletId }: { spinletId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const queryClient = useQueryClient();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["spinlet-logs", spinletId],
    queryFn: () => api.getSpinletLogs(spinletId, 1000),
    enabled: !!spinletId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (!terminalRef.current || !spinletId) return;

    const terminal = new Terminal({
      theme: {
        background: "#1a1a1a",
        foreground: "#e4e4e4",
        cursor: "#e4e4e4",
        cursorAccent: "#1a1a1a",
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      convertEol: true,
      scrollback: 10000,
      disableStdin: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(terminalRef.current);

    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
    };
  }, [spinletId]);

  useEffect(() => {
    if (xtermRef.current && logs?.logs) {
      xtermRef.current.clear();
      logs.logs.forEach((line: string) => {
        xtermRef.current!.writeln(line);
      });
    }
  }, [logs]);

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center text-gray-500">
        Loading logs...
      </div>
    );
  }

  return <div ref={terminalRef} className="h-96 bg-gray-900 rounded-lg" />;
}

// CommandTerminal component for executing commands
function CommandTerminal({ spinletId }: { spinletId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentCommandRef = useRef<string>("");
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  const executeMutation = useMutation({
    mutationFn: (command: string) => api.executeCommand(spinletId, command),
    onSuccess: (data) => {
      if (xtermRef.current) {
        xtermRef.current.writeln(
          data.output || "Command executed successfully"
        );
        xtermRef.current.write("\r\n$ ");
      }
    },
    onError: (error: any) => {
      if (xtermRef.current) {
        xtermRef.current.writeln(
          `\x1b[31mError: ${
            error.response?.data?.error || error.message
          }\x1b[0m`
        );
        xtermRef.current.write("\r\n$ ");
      }
    },
  });

  useEffect(() => {
    if (!terminalRef.current || !spinletId) return;

    const terminal = new Terminal({
      theme: {
        background: "#1a1a1a",
        foreground: "#e4e4e4",
        cursor: "#e4e4e4",
        cursorAccent: "#1a1a1a",
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      convertEol: true,
      scrollback: 10000,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(terminalRef.current);

    fitAddon.fit();

    terminal.writeln("Welcome to SpinForge Interactive Console");
    terminal.writeln('Type "help" for available commands');
    terminal.write("\r\n$ ");

    // Handle input
    terminal.onData((data) => {
      const code = data.charCodeAt(0);

      if (code === 13) {
        // Enter
        terminal.write("\r\n");
        const command = currentCommandRef.current.trim();

        if (command) {
          commandHistoryRef.current.push(command);
          historyIndexRef.current = commandHistoryRef.current.length;

          if (command === "clear") {
            terminal.clear();
            terminal.write("$ ");
          } else if (command === "help") {
            terminal.writeln("Available commands:");
            terminal.writeln("  ls         - List files and directories");
            terminal.writeln("  pwd        - Print working directory");
            terminal.writeln("  env        - Show environment variables");
            terminal.writeln("  ps         - Show running processes");
            terminal.writeln("  cat <file> - Display file content");
            terminal.writeln("  tail <file> - Show last lines of file");
            terminal.writeln("  grep <pattern> <file> - Search in file");
            terminal.writeln("  clear      - Clear terminal");
            terminal.write("\r\n$ ");
          } else {
            executeMutation.mutate(command);
          }
        } else {
          terminal.write("$ ");
        }

        currentCommandRef.current = "";
      } else if (code === 127) {
        // Backspace
        if (currentCommandRef.current.length > 0) {
          currentCommandRef.current = currentCommandRef.current.slice(0, -1);
          terminal.write("\b \b");
        }
      } else if (code === 27) {
        // Escape sequences (arrows)
        if (data === "\x1b[A") {
          // Up arrow
          if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            const cmd = commandHistoryRef.current[historyIndexRef.current];
            // Clear current line
            terminal.write("\r\x1b[K$ ");
            terminal.write(cmd);
            currentCommandRef.current = cmd;
          }
        } else if (data === "\x1b[B") {
          // Down arrow
          if (historyIndexRef.current < commandHistoryRef.current.length - 1) {
            historyIndexRef.current++;
            const cmd = commandHistoryRef.current[historyIndexRef.current];
            terminal.write("\r\x1b[K$ ");
            terminal.write(cmd);
            currentCommandRef.current = cmd;
          } else if (
            historyIndexRef.current ===
            commandHistoryRef.current.length - 1
          ) {
            historyIndexRef.current = commandHistoryRef.current.length;
            terminal.write("\r\x1b[K$ ");
            currentCommandRef.current = "";
          }
        }
      } else if (code >= 32) {
        // Printable characters
        currentCommandRef.current += data;
        terminal.write(data);
      }
    });

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
    };
  }, [spinletId]);

  return <div ref={terminalRef} className="h-96 bg-gray-900 rounded-lg" />;
}
