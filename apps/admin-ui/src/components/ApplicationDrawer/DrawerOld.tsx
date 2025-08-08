/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X,
  Globe,
  Server,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Edit2,
  Save,
  FolderOpen,
  Network,
  Package,
  Copy,
  RefreshCw,
  Trash2,
  Info,
  Plus,
  AlertTriangle,
  Check,
  XCircle,
  Link,
  Tag,
  User,
  Calendar,
  Shield,
  ChevronRight,
  Activity,
  Clock,
  Users,
  Zap,
  BarChart3,
  TrendingUp,
  Settings,
  Lock,
} from "lucide-react";
import { hostingAPI } from "@/services/hosting-api";


interface ApplicationDrawerProps {
  vhost: any | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ApplicationDrawerV2({
  vhost: initialVhost,
  isOpen,
  onClose,
  onRefresh,
}: ApplicationDrawerProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [activeSection, setActiveSection] = useState<string>("overview");

  // Fetch fresh site data when drawer opens
  const { data: vhost, refetch: refetchSite } = useQuery({
    queryKey: ["site", initialVhost?.domain],
    queryFn: async () => {
      if (!initialVhost?.domain) return initialVhost;
      return hostingAPI.getVHost(initialVhost.domain);
    },
    enabled: isOpen && !!initialVhost?.domain,
    initialData: initialVhost,
  });

  interface BackendConfig {
    url: string;
    isLocal?: boolean;
    label?: string;
    enabled?: boolean;
    healthCheck?: {
      path: string;
      interval: number;
      timeout: number;
      unhealthyThreshold: number;
      healthyThreshold: number;
    };
  }

  // Form states
  const [domain, setDomain] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [target, setTarget] = useState("");
  const [preserveHost, setPreserveHost] = useState(false);
  const [backendConfigs, setBackendConfigs] = useState<BackendConfig[]>([]);
  const [editingBackendIndex, setEditingBackendIndex] = useState<number | null>(
    null
  );
  const [confirmDeleteBackend, setConfirmDeleteBackend] = useState<
    number | null
  >(null);

  // Static site specific states
  const [indexFile, setIndexFile] = useState("index.html");
  const [errorFile, setErrorFile] = useState("");

  interface RoutingRule {
    type: "cookie" | "query" | "header";
    name: string;
    matchType: "exact" | "regex" | "prefix";
    value: string;
    targetLabel: string;
    priority?: number;
  }

  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [newRule, setNewRule] = useState<RoutingRule>({
    type: "cookie",
    name: "",
    matchType: "exact",
    value: "",
    targetLabel: "",
    priority: 1,
  });
  const [stickySessionDuration, setStickySessionDuration] =
    useState<number>(3600);

  // Container configuration states
  const [containerImage, setContainerImage] = useState("");
  const [containerPort, setContainerPort] = useState(3000);
  const [containerEnv, setContainerEnv] = useState<
    { key: string; value: string }[]
  >([]);
  const [containerCpuLimit, setContainerCpuLimit] = useState("");
  const [containerMemoryLimit, setContainerMemoryLimit] = useState("");
  const [containerRestartPolicy, setContainerRestartPolicy] =
    useState("unless-stopped");

  // SSL configuration state
  const [sslEnabled, setSslEnabled] = useState(false);
  const [sslRedirect, setSslRedirect] = useState(false);

  const [newBackend, setNewBackend] = useState<BackendConfig>({
    url: "",
    isLocal: false,
    label: "",
    healthCheck: {
      path: "/health",
      interval: 10,
      timeout: 5,
      unhealthyThreshold: 3,
      healthyThreshold: 2,
    },
  });

  // Validation errors
  const [domainError, setDomainError] = useState("");
  const [aliasErrors, setAliasErrors] = useState<Record<number, string>>({});
  const [newAliasError, setNewAliasError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [backendErrors, setBackendErrors] = useState<Record<number, string>>(
    {}
  );
  const [newBackendError, setNewBackendError] = useState("");

  // Initialize form when vhost changes
  React.useEffect(() => {
    if (vhost) {
      setDomain(vhost.domain || "");
      setAliases(vhost.aliases || []);
      setCustomerId(vhost.customerId || "");
      setEnabled(vhost.enabled !== false);
      setTarget(vhost.target || "");
      setPreserveHost(vhost.preserve_host || false);
      setIndexFile(vhost.index_file || "index.html");
      setErrorFile(vhost.error_file || "");

      // Convert old format to new format
      if (vhost.backendConfigs) {
        // Ensure all backends have healthCheck initialized
        setBackendConfigs(
          vhost.backendConfigs.map((backend: BackendConfig) => ({
            ...backend,
            healthCheck: backend.healthCheck || {
              path: "/health",
              interval: 10,
              timeout: 5,
              unhealthyThreshold: 3,
              healthyThreshold: 2,
            },
          }))
        );
      } else if (vhost.backends) {
        setBackendConfigs(
          vhost.backends.map((url: string) => ({
            url,
            healthCheck: {
              path: "/health",
              interval: 10,
              timeout: 5,
              unhealthyThreshold: 3,
              healthyThreshold: 2,
            },
          }))
        );
      } else {
        setBackendConfigs([]);
      }

      // Set routing rules
      setRoutingRules(vhost.routingRules || []);

      // Set sticky session duration
      setStickySessionDuration(vhost.stickySessionDuration || 3600);

      // Set container configuration
      if (vhost.containerConfig) {
        setContainerImage(vhost.containerConfig.image || "");
        setContainerPort(vhost.containerConfig.port || 3000);
        setContainerEnv(vhost.containerConfig.env || []);
        setContainerCpuLimit(vhost.containerConfig.cpuLimit || "");
        setContainerMemoryLimit(vhost.containerConfig.memoryLimit || "");
        setContainerRestartPolicy(
          vhost.containerConfig.restartPolicy || "unless-stopped"
        );
      }

      // Set SSL configuration
      setSslEnabled(vhost.ssl_enabled || false);
      setSslRedirect(vhost.config?.sslRedirect || false);

      // Clear errors
      setDomainError("");
      setAliasErrors({});
      setNewAliasError("");
      setDeleteError("");
      setBackendErrors({});
      setNewBackendError("");
    }
  }, [vhost]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => hostingAPI.updateVHost(vhost.domain, data),
    onSuccess: () => {
      toast.success("Application updated successfully");
      queryClient.invalidateQueries({ queryKey: ["vhosts"] });
      setIsEditing(false);
      onRefresh();
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => hostingAPI.deleteVHost(vhost.domain),
    onSuccess: () => {
      toast.success("Application deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["vhosts"] });
      setShowDeleteModal(false);
      onClose();
    },
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  // Get all vhosts for validation
  const { data: allVhosts = [] } = useQuery({
    queryKey: ["all-vhosts"],
    queryFn: () => hostingAPI.listVHosts(),
    staleTime: 60000,
  });


  const removeBackend = (index: number) => {
    setBackendConfigs(backendConfigs.filter((_, i) => i !== index));
    const newErrors = { ...backendErrors };
    delete newErrors[index];
    setBackendErrors(newErrors);
    setConfirmDeleteBackend(null);
  };

  const updateBackend = (index: number, updatedBackend: BackendConfig) => {
    const newBackends = [...backendConfigs];
    newBackends[index] = updatedBackend;
    setBackendConfigs(newBackends);
  };

  const addRoutingRule = () => {
    if (!newRule.name || !newRule.value || !newRule.targetLabel) {
      toast.error("Please fill all fields for the routing rule");
      return;
    }

    setRoutingRules([
      ...routingRules,
      { ...newRule, priority: routingRules.length + 1 },
    ]);
    setNewRule({
      type: "cookie",
      name: "",
      matchType: "exact",
      value: "",
      targetLabel: "",
      priority: 1,
    });
  };

  const removeRoutingRule = (index: number) => {
    setRoutingRules(routingRules.filter((_, i) => i !== index));
  };

  const getSiteUrl = (vhostData: any) => {
    if (!vhostData?.domain) return null;
    return `http://${vhostData.domain}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "static":
        return <FolderOpen className="h-5 w-5" />;
      case "proxy":
        return <Network className="h-5 w-5" />;
      case "container":
        return <Package className="h-5 w-5" />;
      case "loadbalancer":
        return <Server className="h-5 w-5" />;
      default:
        return <Globe className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "static":
        return "text-blue-600 bg-blue-50";
      case "proxy":
        return "text-green-600 bg-green-50";
      case "container":
        return "text-purple-600 bg-purple-50";
      case "loadbalancer":
        return "text-orange-600 bg-orange-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  if (!vhost) return null;

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-8 space-y-8">
          {/* Settings Section */}
          <section id="section-settings" className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Settings
            </h2>
            {vhost.type === "loadbalancer" && isEditing && (
              <div className="space-y-6">
                {/* Backend Servers */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Backend Servers
                  </label>
                  <div className="space-y-3">
                    {backendConfigs.map((backend, index) => (
                      <div
                        key={index}
                        className="bg-white/60 backdrop-blur-sm rounded-xl border border-white/20 p-4"
                      >
                        {editingBackendIndex === index ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={backend.url}
                              onChange={(e) =>
                                updateBackend(index, {
                                  ...backend,
                                  url: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg"
                              placeholder="http://backend-server:port"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={backend.label || ""}
                                onChange={(e) =>
                                  updateBackend(index, {
                                    ...backend,
                                    label: e.target.value,
                                  })
                                }
                                className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                                placeholder="e.g., variant-a, beta"
                              />
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={backend.enabled !== false}
                                  onChange={(e) =>
                                    updateBackend(index, {
                                      ...backend,
                                      enabled: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4"
                                />
                                <span className="text-sm">Enabled</span>
                              </label>
                            </div>
                            <div className="border-t pt-3">
                              <h6 className="text-xs font-medium text-gray-700 mb-2">
                                Health Check Configuration
                              </h6>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-0.5">
                                    Health Path
                                  </label>
                                  <input
                                    type="text"
                                    value={
                                      backend.healthCheck?.path || "/health"
                                    }
                                    onChange={(e) => {
                                      const updatedBackends = [
                                        ...backendConfigs,
                                      ];
                                      updatedBackends[index] = {
                                        ...backend,
                                        healthCheck: {
                                          ...backend.healthCheck!,
                                          path: e.target.value,
                                        },
                                      };
                                      setBackendConfigs(updatedBackends);
                                    }}
                                    className="w-full px-2 py-1 text-sm bg-white border border-gray-300 rounded"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-0.5">
                                    Interval (s)
                                  </label>
                                  <input
                                    type="number"
                                    value={backend.healthCheck?.interval || 10}
                                    onChange={(e) => {
                                      const updatedBackends = [
                                        ...backendConfigs,
                                      ];
                                      updatedBackends[index] = {
                                        ...backend,
                                        healthCheck: {
                                          ...backend.healthCheck!,
                                          interval: parseInt(e.target.value),
                                        },
                                      };
                                      setBackendConfigs(updatedBackends);
                                    }}
                                    className="w-full px-2 py-1 text-sm bg-white border border-gray-300 rounded"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-3">
                              <button
                                onClick={() => setEditingBackendIndex(null)}
                                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {backend.enabled !== false ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <code className="text-sm">{backend.url}</code>
                              {backend.label && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  {backend.label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingBackendIndex(index)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              {confirmDeleteBackend === index ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-red-600">
                                    Delete?
                                  </span>
                                  <button
                                    onClick={() => removeBackend(index)}
                                    className="text-xs text-red-600 hover:text-red-700"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmDeleteBackend(null)
                                    }
                                    className="text-xs text-gray-600 hover:text-gray-700"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteBackend(index)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add New Backend */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <h5 className="text-sm font-medium text-gray-700">
                        Add New Backend
                      </h5>
                      <input
                        type="text"
                        value={newBackend.url}
                        onChange={(e) =>
                          setNewBackend({
                            ...newBackend,
                            url: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg"
                        placeholder="http://backend-server:port"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={newBackend.label || ""}
                          onChange={(e) =>
                            setNewBackend({
                              ...newBackend,
                              label: e.target.value,
                            })
                          }
                          className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                          placeholder="Label (optional)"
                        />
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newBackend.isLocal}
                            onChange={(e) =>
                              setNewBackend({
                                ...newBackend,
                                isLocal: e.target.checked,
                              })
                            }
                            className="h-4 w-4"
                          />
                          <span className="text-sm">Local Backend</span>
                        </label>
                      </div>
                      {newBackendError && (
                        <p className="text-sm text-red-600">
                          {newBackendError}
                        </p>
                      )}
                      <button
                        onClick={addBackend}
                        className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700"
                      >
                        <Plus className="h-4 w-4 inline mr-2" />
                        Add Backend
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sticky Sessions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sticky Session Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={stickySessionDuration}
                    onChange={(e) =>
                      setStickySessionDuration(parseInt(e.target.value))
                    }
                    className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="3600"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    How long to maintain session affinity (0 to disable)
                  </p>
                </div>

                {/* Routing Rules */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Advanced Routing Rules
                  </label>
                  <div className="space-y-3">
                    {routingRules.map((rule, index) => (
                      <div
                        key={index}
                        className="bg-white/60 backdrop-blur-sm rounded-xl border border-white/20 p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            {rule.type === "cookie"
                              ? "🍪"
                              : rule.type === "header"
                              ? "📋"
                              : "❓"}{" "}
                            {rule.type} Rule #{index + 1}
                          </span>
                          <button
                            onClick={() => removeRoutingRule(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p>
                            Match: {rule.name} {rule.matchType} "{rule.value}"
                          </p>
                          <p>Target: {rule.targetLabel}</p>
                        </div>
                      </div>
                    ))}

                    {/* Add New Rule */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <h5 className="text-sm font-medium text-gray-700">
                        Add Routing Rule
                      </h5>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={newRule.type}
                          onChange={(e) =>
                            setNewRule({
                              ...newRule,
                              type: e.target.value as any,
                            })
                          }
                          className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                        >
                          <option value="cookie">Cookie</option>
                          <option value="header">Header</option>
                          <option value="query">Query Parameter</option>
                        </select>
                        <select
                          value={newRule.matchType}
                          onChange={(e) =>
                            setNewRule({
                              ...newRule,
                              matchType: e.target.value as any,
                            })
                          }
                          className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                        >
                          <option value="exact">Exact Match</option>
                          <option value="prefix">Prefix Match</option>
                          <option value="regex">Regex Match</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={newRule.name}
                          onChange={(e) =>
                            setNewRule({ ...newRule, name: e.target.value })
                          }
                          className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                          placeholder="Name (e.g., user_id)"
                        />
                        <input
                          type="text"
                          value={newRule.value}
                          onChange={(e) =>
                            setNewRule({
                              ...newRule,
                              value: e.target.value,
                            })
                          }
                          className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                          placeholder="Value to match"
                        />
                      </div>
                      <input
                        type="text"
                        value={newRule.targetLabel}
                        onChange={(e) =>
                          setNewRule({
                            ...newRule,
                            targetLabel: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg"
                        placeholder="Target backend label"
                      />
                      <button
                        onClick={addRoutingRule}
                        className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700"
                      >
                        <Plus className="h-4 w-4 inline mr-2" />
                        Add Rule
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
