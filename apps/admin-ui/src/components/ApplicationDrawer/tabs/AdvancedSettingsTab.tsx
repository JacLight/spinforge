import React, { useState, memo, useCallback, useEffect } from "react";
import {
  Settings,
  Zap,
  Shield,
  Clock,
  Server,
  Database,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  ChevronRight,
  Network,
  Activity,
} from "lucide-react";
import AdditionalEndpoints from "./AdditionalEndpoints";

interface AdvancedSettingsTabProps {
  vhost: any;
  isEditing: boolean;
  formData: any;
  setFormData: (data: any) => void;
}

// Memoized Routing Rules Component
const RoutingRulesSection = memo(
  ({
    isEditing,
    routingRules,
    backends,
    onRulesChange,
  }: {
    isEditing: boolean;
    routingRules: any[];
    backends: any[];
    onRulesChange: (rules: any[]) => void;
  }) => {
    const [localRules, setLocalRules] = useState(routingRules);
    const [newRoutingRule, setNewRoutingRule] = useState({
      type: "cookie",
      matchType: "exact",
      name: "",
      value: "",
      targetLabel: "",
      priority: 1,
    });

    // Ensure backends have labels
    const backendsWithLabels = backends.map((backend: any, idx: number) => ({
      ...backend,
      label: backend.label || `backend-${idx + 1}`,
    }));

    useEffect(() => {
      setLocalRules(routingRules);
    }, [routingRules]);

    const addRoutingRule = useCallback(() => {
      if (
        newRoutingRule.name &&
        newRoutingRule.value &&
        newRoutingRule.targetLabel
      ) {
        const newRule = {
          ...newRoutingRule,
          priority: localRules.length + 1,
        };
        const updatedRules = [...localRules, newRule];
        setLocalRules(updatedRules);
        onRulesChange(updatedRules);
        setNewRoutingRule({
          type: "cookie",
          matchType: "exact",
          name: "",
          value: "",
          targetLabel: "",
          priority: 1,
        });
      }
    }, [newRoutingRule, localRules, onRulesChange]);

    const removeRoutingRule = useCallback(
      (index: number) => {
        const updatedRules = localRules.filter(
          (_: any, i: number) => i !== index
        );
        setLocalRules(updatedRules);
        onRulesChange(updatedRules);
      },
      [localRules, onRulesChange]
    );

    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-purple-500" />
          A/B Testing & Routing Rules
        </h3>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Route traffic to specific backends based on cookies, headers, or
            query parameters. Perfect for A/B testing and canary deployments.
          </p>

          {/* Existing Rules */}
          {localRules.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">
                Active Rules
              </h4>
              {localRules.map((rule: any, index: number) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            rule.type === "cookie"
                              ? "bg-yellow-100 text-yellow-700"
                              : rule.type === "header"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {rule.type.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          Priority {rule.priority || index + 1}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Field:</span>
                          <code className="ml-1 px-1 py-0.5 bg-white rounded">
                            {rule.name}
                          </code>
                        </div>
                        <div>
                          <span className="text-gray-500">Match:</span>
                          <code className="ml-1 px-1 py-0.5 bg-white rounded">
                            {rule.matchType}
                          </code>
                        </div>
                        <div>
                          <span className="text-gray-500">Value:</span>
                          <code className="ml-1 px-1 py-0.5 bg-white rounded">
                            {rule.value}
                          </code>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <ChevronRight className="h-3 w-3 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          Routes to:
                        </span>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          {rule.targetLabel}
                        </span>
                      </div>
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => removeRoutingRule(index)}
                        className="ml-4 p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Rule */}
          {isEditing && (
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
              <h5 className="text-sm font-semibold text-gray-800 mb-3">
                Add New Routing Rule
              </h5>

              <div className="space-y-3">
                {/* Rule Type and Match Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Rule Type
                    </label>
                    <select
                      value={newRoutingRule.type}
                      onChange={(e) =>
                        setNewRoutingRule({
                          ...newRoutingRule,
                          type: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="cookie">Cookie</option>
                      <option value="header">Header</option>
                      <option value="query">Query Parameter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Match Type
                    </label>
                    <select
                      value={newRoutingRule.matchType}
                      onChange={(e) =>
                        setNewRoutingRule({
                          ...newRoutingRule,
                          matchType: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="exact">Exact Match</option>
                      <option value="prefix">Prefix Match</option>
                      <option value="regex">Regex Pattern</option>
                    </select>
                  </div>
                </div>

                {/* Name and Value */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {newRoutingRule.type === "cookie"
                        ? "Cookie Name"
                        : newRoutingRule.type === "header"
                        ? "Header Name"
                        : "Parameter Name"}
                    </label>
                    <input
                      type="text"
                      value={newRoutingRule.name}
                      onChange={(e) =>
                        setNewRoutingRule({
                          ...newRoutingRule,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                      placeholder={
                        newRoutingRule.type === "cookie"
                          ? "session_id"
                          : newRoutingRule.type === "header"
                          ? "X-Feature-Flag"
                          : "feature"
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Match Value
                    </label>
                    <input
                      type="text"
                      value={newRoutingRule.value}
                      onChange={(e) =>
                        setNewRoutingRule({
                          ...newRoutingRule,
                          value: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                      placeholder={
                        newRoutingRule.matchType === "regex"
                          ? "^v2-.*"
                          : "beta-version"
                      }
                    />
                  </div>
                </div>

                {/* Target Backend */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Target Backend
                  </label>
                  {backendsWithLabels.length > 0 ? (
                    <select
                      value={newRoutingRule.targetLabel}
                      onChange={(e) =>
                        setNewRoutingRule({
                          ...newRoutingRule,
                          targetLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Select backend...</option>
                      {backendsWithLabels.map((backend: any, idx: number) => (
                        <option key={idx} value={backend.label}>
                          {backend.label} - {backend.url || "No URL configured"}
                          {backend.enabled === false && " (Disabled)"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-500">
                      No backends configured. Add backends first.
                    </div>
                  )}
                </div>

                <button
                  onClick={addRoutingRule}
                  disabled={
                    !newRoutingRule.name ||
                    !newRoutingRule.value ||
                    !newRoutingRule.targetLabel
                  }
                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Add Routing Rule
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

RoutingRulesSection.displayName = "RoutingRulesSection";

export default function AdvancedSettingsTab({
  vhost,
  isEditing,
  formData,
  setFormData,
}: AdvancedSettingsTabProps) {
  const [editingBackendIndex, setEditingBackendIndex] = useState<number | null>(
    null
  );

  // Load balancer specific handlers
  const updateBackend = (index: number, backend: any) => {
    const updatedBackends = [...(formData.backends || [])];
    updatedBackends[index] = backend;
    setFormData({ ...formData, backends: updatedBackends });
  };

  // Handle routing rules change from memoized component
  const handleRoutingRulesChange = (rules: any[]) => {
    setFormData({ ...formData, routingRules: rules });
  };

  // Common settings for all types
  const CommonSettings = () => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
      <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5 text-gray-500" />
        Advanced Settings
      </h3>

      <div className="space-y-3">
        {/* Request Timeout & Max Size - Compact inline */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">
              Request Timeout
            </span>
            {isEditing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.requestTimeout || 60}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requestTimeout: parseInt(e.target.value),
                    })
                  }
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-xs text-gray-600">sec</span>
              </div>
            ) : (
              <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">
                {formData.requestTimeout || 60}s
              </code>
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">
              Max Request Size
            </span>
            {isEditing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.maxRequestSize || 100}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxRequestSize: parseInt(e.target.value),
                    })
                  }
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-xs text-gray-600">MB</span>
              </div>
            ) : (
              <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">
                {formData.maxRequestSize || 100}MB
              </code>
            )}
          </div>
        </div>

        {/* Gzip Compression - Compact */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium text-gray-700">
            Gzip Compression
          </span>
          {isEditing ? (
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.gzipEnabled !== false}
                onChange={(e) =>
                  setFormData({ ...formData, gzipEnabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          ) : (
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                formData.gzipEnabled !== false
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {formData.gzipEnabled !== false ? "Enabled" : "Disabled"}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // Proxy specific settings
  const ProxySettings = () => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
      <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ChevronRight className="h-5 w-5 text-green-500" />
        Proxy Advanced Settings
      </h3>

      <div className="space-y-4">
        {/* Proxy Headers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Proxy Headers
          </label>
          <div className="space-y-2">
            {[
              "X-Real-IP",
              "X-Forwarded-For",
              "X-Forwarded-Proto",
              "X-Forwarded-Host",
            ].map((header) => (
              <div
                key={header}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <code className="text-sm">{header}</code>
                {isEditing ? (
                  <input
                    type="checkbox"
                    checked={formData.proxyHeaders?.[header] !== false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        proxyHeaders: {
                          ...formData.proxyHeaders,
                          [header]: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 text-blue-600"
                  />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Websocket Support */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700">
              WebSocket Support
            </p>
            <p className="text-xs text-gray-500">
              Enable WebSocket connections
            </p>
          </div>
          {isEditing ? (
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.websocketEnabled}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    websocketEnabled: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          ) : (
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                formData.websocketEnabled
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {formData.websocketEnabled ? "Enabled" : "Disabled"}
            </span>
          )}
        </div>

        {/* Buffer Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buffer Size
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.bufferSize || "4k"}
                onChange={(e) =>
                  setFormData({ ...formData, bufferSize: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="4k"
              />
            ) : (
              <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                {formData.bufferSize || "4k"}
              </code>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buffers Count
            </label>
            {isEditing ? (
              <input
                type="number"
                value={formData.bufferCount || 8}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bufferCount: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            ) : (
              <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                {formData.bufferCount || 8}
              </code>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Container specific settings


  const ContainerSettings = () => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
      <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Database className="h-5 w-5 text-purple-500" />
        Container Advanced Settings
      </h3>
      <div className="space-y-4">
        {/* Resource Limits */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Resource Limits
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                CPU Limit
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.containerConfig?.cpuLimit || "1"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      containerConfig: {
                        ...formData.containerConfig,
                        cpuLimit: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="1 (cores)"
                />
              ) : (
                <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                  {formData.containerConfig?.cpuLimit || "1"} cores
                </code>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Memory Limit
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.containerConfig?.memoryLimit || "512m"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      containerConfig: {
                        ...formData.containerConfig,
                        memoryLimit: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="512m"
                />
              ) : (
                <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                  {formData.containerConfig?.memoryLimit || "512m"}
                </code>
              )}
            </div>
          </div>
        </div>

        {/* Restart Policy */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Restart Policy
          </label>
          {isEditing ? (
            <select
              value={formData.containerConfig?.restartPolicy || "always"}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  containerConfig: {
                    ...formData.containerConfig,
                    restartPolicy: e.target.value,
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="always">Always</option>
              <option value="unless-stopped">Unless Stopped</option>
              <option value="on-failure">On Failure</option>
              <option value="no">Never</option>
            </select>
          ) : (
            <code className="text-sm bg-gray-100 px-3 py-1 rounded capitalize">
              {formData.containerConfig?.restartPolicy || "always"}
            </code>
          )}
        </div>

        {/* Health Check */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Health Check
          </label>
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={formData.containerConfig?.healthCheck?.command || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    containerConfig: {
                      ...formData.containerConfig,
                      healthCheck: {
                        ...formData.containerConfig?.healthCheck,
                        command: e.target.value,
                      },
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Health check command (e.g., curl -f http://localhost/ || exit 1)"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={
                    formData.containerConfig?.healthCheck?.interval || "30s"
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      containerConfig: {
                        ...formData.containerConfig,
                        healthCheck: {
                          ...formData.containerConfig?.healthCheck,
                          interval: e.target.value,
                        },
                      },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Interval"
                />
                <input
                  type="text"
                  value={
                    formData.containerConfig?.healthCheck?.timeout || "10s"
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      containerConfig: {
                        ...formData.containerConfig,
                        healthCheck: {
                          ...formData.containerConfig?.healthCheck,
                          timeout: e.target.value,
                        },
                      },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Timeout"
                />
                <input
                  type="number"
                  value={formData.containerConfig?.healthCheck?.retries || 3}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      containerConfig: {
                        ...formData.containerConfig,
                        healthCheck: {
                          ...formData.containerConfig?.healthCheck,
                          retries: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Retries"
                />
              </div>
            </div>
          ) : (
            <div className="text-sm bg-gray-100 px-3 py-2 rounded">
              {formData.containerConfig?.healthCheck?.command ||
                "No health check configured"}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Load Balancer specific settings
  const LoadBalancerSettings = () => (
    <div className="space-y-6">
      {/* Advanced Backend Configuration */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Network className="h-5 w-5 text-green-500" />
          Load Balancer Advanced Settings
        </h3>

        <div className="space-y-4">
          {/* Load Balancing Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Load Balancing Method
            </label>
            {isEditing ? (
              <select
                value={formData.lbMethod || "round-robin"}
                onChange={(e) =>
                  setFormData({ ...formData, lbMethod: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="round-robin">Round Robin</option>
                <option value="least-connections">Least Connections</option>
                <option value="ip-hash">IP Hash</option>
                <option value="weighted">Weighted</option>
              </select>
            ) : (
              <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                {formData.lbMethod || "round-robin"}
              </code>
            )}
          </div>

          {/* Sticky Sessions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sticky Session Duration
            </label>
            <p className="text-xs text-gray-500 mb-2">
              How long to maintain session affinity (0 to disable)
            </p>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.stickySessionDuration || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stickySessionDuration: parseInt(e.target.value),
                    })
                  }
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
            ) : (
              <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                {formData.stickySessionDuration || 0} minutes
              </code>
            )}
          </div>

          {/* Backend Health Checks */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Backend Health Checks
            </label>
            {(formData.backends || []).map((backend: any, index: number) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                {editingBackendIndex === index && isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-medium">{backend.url}</code>
                      <button
                        onClick={() => setEditingBackendIndex(null)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Done
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Label
                        </label>
                        <input
                          type="text"
                          value={backend.label || ""}
                          onChange={(e) =>
                            updateBackend(index, {
                              ...backend,
                              label: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="e.g., primary, backup"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Weight
                        </label>
                        <input
                          type="number"
                          value={backend.weight || 1}
                          onChange={(e) =>
                            updateBackend(index, {
                              ...backend,
                              weight: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                    <div className="border-t pt-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Health Check
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={backend.healthPath || "/health"}
                          onChange={(e) =>
                            updateBackend(index, {
                              ...backend,
                              healthPath: e.target.value,
                            })
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="/health"
                        />
                        <input
                          type="text"
                          value={backend.healthInterval || "30s"}
                          onChange={(e) =>
                            updateBackend(index, {
                              ...backend,
                              healthInterval: e.target.value,
                            })
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="30s"
                        />
                      </div>
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
                      <div>
                        <code className="text-sm">{backend.url}</code>
                        {backend.label && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            {backend.label}
                          </span>
                        )}
                      </div>
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => setEditingBackendIndex(index)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Routing Rules for Load Balancer */}
      {vhost.type === "loadbalancer" && (
        <RoutingRulesSection
          isEditing={isEditing}
          routingRules={formData.routingRules || []}
          backends={formData.backends || []}
          onRulesChange={handleRoutingRulesChange}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <CommonSettings />

      {vhost.type === "proxy" && <ProxySettings />}
      {vhost.type === "container" && (
        <AdditionalEndpoints
          vhost={vhost}
          formData={formData}
          setFormData={setFormData}
          isEditing={isEditing}
        />
      )}
      {vhost.type === "container" && <ContainerSettings />}
      {vhost.type === "loadbalancer" && <LoadBalancerSettings />}

      {vhost.type === "static" && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            Static Site Settings
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Index File
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.indexFile || "index.html"}
                  onChange={(e) =>
                    setFormData({ ...formData, indexFile: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              ) : (
                <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                  {formData.indexFile || "index.html"}
                </code>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Error Page
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.errorFile || "404.html"}
                  onChange={(e) =>
                    setFormData({ ...formData, errorFile: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              ) : (
                <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                  {formData.errorFile || "404.html"}
                </code>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Directory Listing
                </p>
                <p className="text-xs text-gray-500">
                  Show directory contents if no index file
                </p>
              </div>
              {isEditing ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.directoryListing}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        directoryListing: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              ) : (
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    formData.directoryListing
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {formData.directoryListing ? "Enabled" : "Disabled"}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
