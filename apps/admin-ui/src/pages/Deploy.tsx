import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { hostingAPI } from "../services/hosting-api";
import { toast } from "sonner";
import { 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Globe, 
  FolderOpen,
  Network,
  Package,
  Server,
  Plus,
  X,
  Info,
  FileText,
  Link,
  Tag,
  Shield,
  Zap
} from "lucide-react";

const hostingTypes = [
  { 
    value: "static", 
    label: "Static Site", 
    icon: FolderOpen,
    description: "Host static HTML, CSS, JavaScript files",
    color: "blue"
  },
  { 
    value: "proxy", 
    label: "Reverse Proxy", 
    icon: Network,
    description: "Forward requests to another server",
    color: "green"
  },
  { 
    value: "container", 
    label: "Container", 
    icon: Package,
    description: "Docker container deployment (coming soon)",
    color: "purple",
    disabled: true
  },
  { 
    value: "loadbalancer", 
    label: "Load Balancer", 
    icon: Server,
    description: "Distribute traffic across multiple backend servers",
    color: "orange",
    disabled: false
  },
];

export default function Deploy() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>("static");
  interface BackendConfig {
    url: string;
    isLocal?: boolean;
    label?: string;
    enabled?: boolean;
    healthCheck: {
      path: string;
      interval: number;
      timeout: number;
      unhealthyThreshold: number;
      healthyThreshold: number;
    };
  }
  
  interface RoutingRule {
    type: 'cookie' | 'query' | 'header';
    name: string;
    matchType: 'exact' | 'regex' | 'prefix';
    value: string;
    targetLabel: string;
    priority?: number;
  }

  const [formData, setFormData] = useState({
    domain: "",
    customerId: "",
    target: "",
    aliases: [] as string[],
    newAlias: "",
    backendConfigs: [] as BackendConfig[],
    newBackend: {
      url: "",
      isLocal: false,
      label: "",
      healthCheck: {
        path: "/health",
        interval: 10,
        timeout: 5,
        unhealthyThreshold: 3,
        healthyThreshold: 2,
      }
    },
    routingRules: [] as RoutingRule[],
    newRule: {
      type: 'cookie' as 'cookie' | 'query' | 'header',
      name: '',
      matchType: 'exact' as 'exact' | 'regex' | 'prefix',
      value: '',
      targetLabel: '',
      priority: 1,
    },
    stickySessionDuration: 3600, // 1 hour default
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get all vhosts for validation
  const { data: allVhosts = [] } = useQuery({
    queryKey: ["all-vhosts"],
    queryFn: () => hostingAPI.listVHosts(),
    staleTime: 60000,
  });

  const deployMutation = useMutation({
    mutationFn: (data: any) => hostingAPI.createVHost(data),
    onSuccess: () => {
      toast.success("Application deployed successfully!");
      navigate("/applications");
    },
    onError: (error: any) => {
      toast.error(`Deployment failed: ${error.response?.data?.error || error.message}`);
    },
  });

  const isValidDomain = (domain: string) => {
    if (!domain) return false;
    // Just check it has at least one character and no spaces
    return domain.length > 0 && !domain.includes(' ');
  };


  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate domain (required)
    if (!formData.domain) {
      newErrors.domain = "Domain is required";
    } else if (!isValidDomain(formData.domain)) {
      newErrors.domain = "Please enter a valid domain";
    } else if (allVhosts.some(v => v.domain === formData.domain || v.aliases?.includes(formData.domain))) {
      newErrors.domain = "This domain is already in use";
    }

    // Validate proxy target
    if (selectedType === "proxy" && !formData.target) {
      newErrors.target = "Target URL is required for proxy sites";
    }

    // Validate load balancer backends
    if (selectedType === "loadbalancer" && formData.backendConfigs.length === 0) {
      newErrors.backends = "At least one backend server is required for load balancer";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const data: any = {
      domain: formData.domain, // Primary key
      type: selectedType,
      customerId: formData.customerId || undefined,
      enabled: true,
    };

    if (formData.aliases.length > 0) {
      data.aliases = formData.aliases;
    }

    if (selectedType === "proxy" && formData.target) {
      data.target = formData.target;
    }

    if (selectedType === "loadbalancer" && formData.backendConfigs.length > 0) {
      data.backendConfigs = formData.backendConfigs;
      if (formData.routingRules.length > 0) {
        data.routingRules = formData.routingRules;
      }
      data.stickySessionDuration = formData.stickySessionDuration;
    }

    deployMutation.mutate(data);
  };

  const handleAddAlias = () => {
    if (!formData.newAlias) return;

    if (!isValidDomain(formData.newAlias)) {
      setErrors({ ...errors, newAlias: "Please enter a valid domain" });
      return;
    }

    if (formData.aliases.includes(formData.newAlias) || formData.newAlias === formData.domain) {
      setErrors({ ...errors, newAlias: "This domain is already added" });
      return;
    }

    const isUsed = allVhosts.some(v => 
      v.domain === formData.newAlias || v.aliases?.includes(formData.newAlias)
    );
    if (isUsed) {
      setErrors({ ...errors, newAlias: "This domain is already in use by another site" });
      return;
    }

    setFormData({
      ...formData,
      aliases: [...formData.aliases, formData.newAlias],
      newAlias: "",
    });
    setErrors({ ...errors, newAlias: "" });
  };

  const handleRemoveAlias = (alias: string) => {
    setFormData({
      ...formData,
      aliases: formData.aliases.filter(a => a !== alias),
    });
  };

  const handleAddBackend = () => {
    if (!formData.newBackend.url) return;

    // Different validation for local vs external backends
    if (formData.newBackend.isLocal) {
      // For local backends, validate it's a valid domain and exists in the system
      if (!formData.newBackend.url.match(/^[a-zA-Z0-9][a-zA-Z0-9-_.]*$/)) {
        setErrors({ ...errors, newBackendUrl: "Please enter a valid domain name" });
        return;
      }
      
      // Check if the domain exists in the SpinForge system
      const domainExists = allVhosts.some(v => 
        v.domain === formData.newBackend.url || 
        v.aliases?.includes(formData.newBackend.url)
      );
      
      if (!domainExists) {
        setErrors({ ...errors, newBackendUrl: `Domain "${formData.newBackend.url}" not found in SpinForge` });
        return;
      }
    } else {
      // For external backends, validate full URL
      try {
        new URL(formData.newBackend.url);
      } catch {
        setErrors({ ...errors, newBackendUrl: "Please enter a valid URL" });
        return;
      }
    }

    if (formData.backendConfigs.some(b => b.url === formData.newBackend.url)) {
      setErrors({ ...errors, newBackendUrl: "This backend is already added" });
      return;
    }

    // Validate health check settings
    if (!formData.newBackend.healthCheck.path.startsWith('/')) {
      setErrors({ ...errors, newBackendPath: "Health check path must start with /" });
      return;
    }

    setFormData({
      ...formData,
      backendConfigs: [...formData.backendConfigs, { ...formData.newBackend }],
      newBackend: {
        url: "",
        isLocal: false,
        label: "",
        enabled: true,
        healthCheck: {
          path: "/health",
          interval: 10,
          timeout: 5,
          unhealthyThreshold: 3,
          healthyThreshold: 2,
        }
      },
    });
    setErrors({ ...errors, newBackendUrl: "", newBackendPath: "" });
  };

  const handleRemoveBackend = (index: number) => {
    setFormData({
      ...formData,
      backendConfigs: formData.backendConfigs.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Deploy New Application</h1>
        <p className="mt-2 text-gray-600">
          Choose a hosting type and configure your new application
        </p>
      </div>

      {/* Hosting Type Selection */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Hosting Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hostingTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                onClick={() => !type.disabled && setSelectedType(type.value)}
                disabled={type.disabled}
                className={`relative p-6 rounded-lg border-2 text-left transition-all ${
                  selectedType === type.value
                    ? `border-${type.color}-500 bg-${type.color}-50`
                    : type.disabled
                    ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${
                    selectedType === type.value ? `bg-${type.color}-100` : "bg-gray-100"
                  }`}>
                    <Icon className={`h-6 w-6 ${
                      selectedType === type.value ? `text-${type.color}-600` : "text-gray-600"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {type.label}
                      {type.disabled && (
                        <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                          Coming Soon
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                  </div>
                </div>
                {selectedType === type.value && !type.disabled && (
                  <div className={`absolute top-4 right-4 h-2 w-2 bg-${type.color}-500 rounded-full`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl">
          <div className="px-6 py-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Application Configuration</h2>
            
            <div className="space-y-6">

              {/* Domain */}
              <div>
                <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
                  Domain <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    id="domain"
                    value={formData.domain}
                    onChange={(e) => {
                      setFormData({ ...formData, domain: e.target.value });
                      if (errors.domain) validateForm();
                    }}
                    className={`pl-10 block w-full rounded-md border ${
                      errors.domain ? "border-red-300" : "border-gray-300"
                    } py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder="example.com"
                  />
                </div>
                {errors.domain && (
                  <p className="mt-1 text-sm text-red-600">{errors.domain}</p>
                )}
              </div>

              {/* Domain Aliases */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Domain Aliases
                </label>
                <div className="space-y-2">
                  {formData.aliases.map((alias, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={alias}
                          readOnly
                          className="pl-10 block w-full rounded-md border border-gray-300 py-2 px-3 bg-gray-50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAlias(alias)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Plus className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.newAlias}
                        onChange={(e) => {
                          setFormData({ ...formData, newAlias: e.target.value });
                          if (errors.newAlias) setErrors({ ...errors, newAlias: "" });
                        }}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddAlias();
                          }
                        }}
                        className={`pl-10 block w-full rounded-md border ${
                          errors.newAlias ? "border-red-300" : "border-gray-300"
                        } py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                        placeholder="Add alias (e.g., www.example.com)"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAlias}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  {errors.newAlias && (
                    <p className="text-sm text-red-600">{errors.newAlias}</p>
                  )}
                </div>
              </div>

              {/* Customer ID */}
              <div>
                <label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-2">
                  Customer ID
                </label>
                <input
                  type="text"
                  id="customerId"
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="customer-123 (optional)"
                />
              </div>

              {/* Proxy Target (for proxy type only) */}
              {selectedType === "proxy" && (
                <div>
                  <label htmlFor="target" className="block text-sm font-medium text-gray-700 mb-2">
                    Target URL <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Zap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="url"
                      id="target"
                      value={formData.target}
                      onChange={(e) => {
                        setFormData({ ...formData, target: e.target.value });
                        if (errors.target) validateForm();
                      }}
                      className={`pl-10 block w-full rounded-md border ${
                        errors.target ? "border-red-300" : "border-gray-300"
                      } py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm`}
                      placeholder="http://localhost:3000"
                    />
                  </div>
                  {errors.target && (
                    <p className="mt-1 text-sm text-red-600">{errors.target}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    The URL where requests will be forwarded
                  </p>
                </div>
              )}

              {/* Load Balancer Backends */}
              {selectedType === "loadbalancer" && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Backend Servers <span className="text-red-500">*</span>
                    </label>
                    
                    {/* Existing backends */}
                    <div className="space-y-3 mb-4">
                      {formData.backendConfigs.map((backend, index) => (
                        <div key={index} className={`rounded-lg p-4 border ${backend.enabled === false ? 'bg-gray-100 border-gray-300 opacity-60' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 flex-1">
                              <Server className={`h-4 w-4 ${backend.enabled === false ? 'text-gray-400' : 'text-gray-500'}`} />
                              <div className="flex items-center gap-2 flex-1">
                                <code className={`text-sm font-medium ${backend.enabled === false ? 'text-gray-500' : ''}`}>{backend.url}</code>
                                {backend.isLocal && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Local</span>
                                )}
                                {backend.label && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{backend.label}</span>
                                )}
                                {backend.enabled === false && (
                                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Disabled</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedBackends = [...formData.backendConfigs];
                                  updatedBackends[index] = { ...backend, enabled: backend.enabled === false };
                                  setFormData({ ...formData, backendConfigs: updatedBackends });
                                }}
                                className={`px-3 py-1 text-xs rounded ${
                                  backend.enabled === false 
                                    ? 'bg-green-600 text-white hover:bg-green-700' 
                                    : 'bg-gray-600 text-white hover:bg-gray-700'
                                }`}
                              >
                                {backend.enabled === false ? 'Enable' : 'Disable'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveBackend(index)}
                                className="text-red-600 hover:bg-red-50 rounded p-1"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-gray-600">Health Check:</span>
                              <code className="ml-1">{backend.healthCheck.path}</code>
                            </div>
                            <div>
                              <span className="text-gray-600">Interval:</span>
                              <span className="ml-1">{backend.healthCheck.interval}s</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Timeout:</span>
                              <span className="ml-1">{backend.healthCheck.timeout}s</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Failures to unhealthy:</span>
                              <span className="ml-1">{backend.healthCheck.unhealthyThreshold}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add new backend form */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">Add Backend Server</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="isLocal"
                            checked={formData.newBackend.isLocal}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                newBackend: { ...formData.newBackend, isLocal: e.target.checked, url: "" }
                              });
                              setErrors({ ...errors, newBackendUrl: "" });
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="isLocal" className="text-sm font-medium text-gray-700">
                            This is a local SpinForge service
                          </label>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {formData.newBackend.isLocal ? "Domain Name" : "Backend URL"}
                          </label>
                          <input
                            type={formData.newBackend.isLocal ? "text" : "url"}
                            value={formData.newBackend.url}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                newBackend: { ...formData.newBackend, url: e.target.value }
                              });
                              if (errors.newBackendUrl) setErrors({ ...errors, newBackendUrl: "" });
                            }}
                            className={`block w-full rounded-md border ${
                              errors.newBackendUrl ? "border-red-300" : "border-gray-300"
                            } py-2 px-3 text-sm font-mono focus:ring-2 focus:ring-blue-500`}
                            placeholder={formData.newBackend.isLocal ? "test-shop.localhost" : "http://backend1.example.com:8080"}
                          />
                          {errors.newBackendUrl && (
                            <p className="text-xs text-red-600 mt-1">{errors.newBackendUrl}</p>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Backend Label (for routing rules)
                          </label>
                          <input
                            type="text"
                            value={formData.newBackend.label}
                            onChange={(e) => setFormData({
                              ...formData,
                              newBackend: { ...formData.newBackend, label: e.target.value }
                            })}
                            className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                            placeholder="e.g., variant-a, beta, v2"
                          />
                          <p className="text-xs text-gray-500 mt-1">Optional: Use for direct routing (?label=xyz) or routing rules</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Health Check Path
                          </label>
                          <input
                            type="text"
                            value={formData.newBackend.healthCheck.path}
                            onChange={(e) => setFormData({
                              ...formData,
                              newBackend: {
                                ...formData.newBackend,
                                healthCheck: { ...formData.newBackend.healthCheck, path: e.target.value }
                              }
                            })}
                            className={`block w-full rounded-md border ${
                              errors.newBackendPath ? "border-red-300" : "border-gray-300"
                            } py-1.5 px-2 text-sm`}
                            placeholder="/health"
                          />
                          {errors.newBackendPath && (
                            <p className="text-xs text-red-600 mt-1">{errors.newBackendPath}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Check Interval (seconds)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="300"
                            value={formData.newBackend.healthCheck.interval}
                            onChange={(e) => setFormData({
                              ...formData,
                              newBackend: {
                                ...formData.newBackend,
                                healthCheck: { ...formData.newBackend.healthCheck, interval: parseInt(e.target.value) || 10 }
                              }
                            })}
                            className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Timeout (seconds)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={formData.newBackend.healthCheck.timeout}
                            onChange={(e) => setFormData({
                              ...formData,
                              newBackend: {
                                ...formData.newBackend,
                                healthCheck: { ...formData.newBackend.healthCheck, timeout: parseInt(e.target.value) || 5 }
                              }
                            })}
                            className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Failures to mark unhealthy
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={formData.newBackend.healthCheck.unhealthyThreshold}
                            onChange={(e) => setFormData({
                              ...formData,
                              newBackend: {
                                ...formData.newBackend,
                                healthCheck: { ...formData.newBackend.healthCheck, unhealthyThreshold: parseInt(e.target.value) || 3 }
                              }
                            })}
                            className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddBackend}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                      >
                        Add Backend Server
                      </button>
                    </div>

                    {errors.backends && (
                      <p className="text-sm text-red-600 mt-2">{errors.backends}</p>
                    )}
                    
                    <p className="mt-3 text-xs text-gray-500">
                      Each backend server will be monitored with its own health check configuration. 
                      Unhealthy backends are automatically removed from the load balancer rotation.
                    </p>
                  </div>

                  {/* Sticky Session Settings */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sticky Session Duration
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max="86400"
                        value={formData.stickySessionDuration}
                        onChange={(e) => setFormData({
                          ...formData,
                          stickySessionDuration: parseInt(e.target.value) || 3600
                        })}
                        className="w-32 rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                      />
                      <span className="text-sm text-gray-600">seconds</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, stickySessionDuration: 300 })}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                        >
                          5 min
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, stickySessionDuration: 1800 })}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                        >
                          30 min
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, stickySessionDuration: 3600 })}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                        >
                          1 hour
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, stickySessionDuration: 86400 })}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                        >
                          24 hours
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      How long users stay on the same backend server. Set to 0 to disable sticky sessions.
                    </p>
                  </div>

                  {/* Routing Rules for A/B Testing */}
                  {formData.backendConfigs.length > 0 && (
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        A/B Testing Routing Rules (Optional)
                      </label>
                      
                      {/* Existing rules */}
                      <div className="space-y-3 mb-4">
                        {formData.routingRules.map((rule, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-semibold text-gray-700 uppercase">{rule.type}</span>
                                  <code className="text-sm">{rule.name}</code>
                                  <span className="text-xs text-gray-500">{rule.matchType}</span>
                                  <code className="text-sm font-mono bg-white px-1 py-0.5 rounded">{rule.value}</code>
                                  <span className="text-xs text-gray-500">→</span>
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{rule.targetLabel}</span>
                                  {rule.priority && rule.priority > 1 && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Priority: {rule.priority}</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600">
                                  <span className="font-medium">Example: </span>
                                  {rule.type === 'cookie' && <span>Cookie: {rule.name}={rule.value}</span>}
                                  {rule.type === 'query' && <span>URL: ?{rule.name}={rule.value}</span>}
                                  {rule.type === 'header' && <span>Header: {rule.name}: {rule.value}</span>}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    routingRules: formData.routingRules.filter((_, i) => i !== index)
                                  });
                                }}
                                className="text-red-600 hover:bg-red-50 rounded p-1"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add new rule form */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 space-y-4">
                        <h4 className="text-sm font-medium text-gray-700">Add Routing Rule</h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Rule Type</label>
                            <select
                              value={formData.newRule.type}
                              onChange={(e) => setFormData({
                                ...formData,
                                newRule: { ...formData.newRule, type: e.target.value as 'cookie' | 'query' | 'header' }
                              })}
                              className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                            >
                              <option value="cookie">Cookie</option>
                              <option value="query">Query Parameter</option>
                              <option value="header">Header</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {formData.newRule.type === 'cookie' ? 'Cookie Name' : 
                               formData.newRule.type === 'query' ? 'Parameter Name' : 'Header Name'}
                            </label>
                            <input
                              type="text"
                              value={formData.newRule.name}
                              onChange={(e) => setFormData({
                                ...formData,
                                newRule: { ...formData.newRule, name: e.target.value }
                              })}
                              className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                              placeholder={formData.newRule.type === 'cookie' ? 'session_variant' : 
                                         formData.newRule.type === 'query' ? 'variant' : 'X-Variant'}
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Match Type</label>
                            <select
                              value={formData.newRule.matchType}
                              onChange={(e) => setFormData({
                                ...formData,
                                newRule: { ...formData.newRule, matchType: e.target.value as 'exact' | 'regex' | 'prefix' }
                              })}
                              className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                            >
                              <option value="exact">Exact Match</option>
                              <option value="prefix">Prefix Match</option>
                              <option value="regex">Regular Expression</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Match Value</label>
                            <input
                              type="text"
                              value={formData.newRule.value}
                              onChange={(e) => setFormData({
                                ...formData,
                                newRule: { ...formData.newRule, value: e.target.value }
                              })}
                              className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm font-mono"
                              placeholder={formData.newRule.matchType === 'regex' ? '^(beta|test).*' : 'beta'}
                            />
                            {formData.newRule.matchType === 'regex' && (
                              <div className="mt-1">
                                <p className="text-xs text-gray-500">Common patterns:</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {[
                                    { pattern: '^beta.*', desc: 'Starts with beta' },
                                    { pattern: '.*(test|beta).*', desc: 'Contains test or beta' },
                                    { pattern: '^v[0-9]+$', desc: 'Version numbers (v1, v2...)' },
                                    { pattern: '^[a-f0-9]{8}$', desc: '8 hex characters' },
                                  ].map(({ pattern, desc }) => (
                                    <button
                                      key={pattern}
                                      type="button"
                                      onClick={() => setFormData({
                                        ...formData,
                                        newRule: { ...formData.newRule, value: pattern }
                                      })}
                                      className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded"
                                      title={desc}
                                    >
                                      {pattern}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Target Backend Label</label>
                            <select
                              value={formData.newRule.targetLabel}
                              onChange={(e) => setFormData({
                                ...formData,
                                newRule: { ...formData.newRule, targetLabel: e.target.value }
                              })}
                              className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                            >
                              <option value="">Select a backend label</option>
                              {Array.from(new Set(formData.backendConfigs.filter(b => b.label).map(b => b.label))).map(label => (
                                <option key={label} value={label}>{label}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={formData.newRule.priority}
                              onChange={(e) => setFormData({
                                ...formData,
                                newRule: { ...formData.newRule, priority: parseInt(e.target.value) || 1 }
                              })}
                              className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">Higher priority rules are evaluated first</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (formData.newRule.name && formData.newRule.value && formData.newRule.targetLabel) {
                              setFormData({
                                ...formData,
                                routingRules: [...formData.routingRules, { ...formData.newRule }],
                                newRule: {
                                  type: 'cookie',
                                  name: '',
                                  matchType: 'exact',
                                  value: '',
                                  targetLabel: '',
                                  priority: 1,
                                }
                              });
                            }
                          }}
                          disabled={!formData.newRule.name || !formData.newRule.value || !formData.newRule.targetLabel}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Routing Rule
                        </button>
                      </div>
                      
                      <div className="mt-4 space-y-4">
                        {/* Test Your Rules */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <Zap className="h-5 w-5 text-yellow-600 mt-0.5" />
                            <div className="ml-3 flex-1">
                              <h4 className="text-sm font-medium text-yellow-900">Test Your Routing Rules</h4>
                              <div className="mt-2 space-y-2">
                                <p className="text-xs text-yellow-700">Test how your rules will route traffic:</p>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="font-medium">Cookie test:</span>
                                    <code className="block mt-1 bg-yellow-100 p-1 rounded">
                                      curl -H "Cookie: variant=beta" {formData.domain || 'your-domain.com'}
                                    </code>
                                  </div>
                                  <div>
                                    <span className="font-medium">Query test:</span>
                                    <code className="block mt-1 bg-yellow-100 p-1 rounded">
                                      curl {formData.domain || 'your-domain.com'}?variant=beta
                                    </code>
                                  </div>
                                  <div>
                                    <span className="font-medium">Header test:</span>
                                    <code className="block mt-1 bg-yellow-100 p-1 rounded">
                                      curl -H "X-Variant: beta" {formData.domain || 'your-domain.com'}
                                    </code>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-3 pt-3 border-t border-yellow-300">
                                <p className="text-xs font-medium text-yellow-800 mb-1">Direct Label Routing:</p>
                                <code className="block text-xs bg-yellow-100 p-1 rounded mb-1">
                                  curl "{formData.domain || 'your-domain.com'}?label=beta"
                                </code>
                                <p className="text-xs text-yellow-700 ml-2 mb-2">→ Routes directly to backend with label "beta"</p>
                                
                                <p className="text-xs font-medium text-yellow-800 mb-1">Diagnostic Endpoints:</p>
                                <div className="space-y-1">
                                  <code className="block text-xs bg-yellow-100 p-1 rounded">
                                    curl {formData.domain || 'your-domain.com'}/_spinforge/diagnostic
                                  </code>
                                  <p className="text-xs text-yellow-700 ml-2">→ Shows backends with labels and routing rules</p>
                                  <code className="block text-xs bg-yellow-100 p-1 rounded">
                                    curl {formData.domain || 'your-domain.com'}/_spinforge/test-routing
                                  </code>
                                  <p className="text-xs text-yellow-700 ml-2">→ Shows current request's cookies, headers, and params</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Info Box */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div className="ml-3">
                              <h4 className="text-sm font-medium text-blue-900">How A/B Testing Works</h4>
                              <div className="mt-2 grid grid-cols-2 gap-4">
                                <div>
                                  <h5 className="text-xs font-semibold text-blue-800 mb-1">Routing Order:</h5>
                                  <ol className="text-xs text-blue-700 space-y-1">
                                    <li>1. Check routing rules (by priority)</li>
                                    <li>2. Check sticky session cookie</li>
                                    <li>3. Use round-robin if no match</li>
                                    <li>4. Set sticky session for consistency</li>
                                  </ol>
                                </div>
                                <div>
                                  <h5 className="text-xs font-semibold text-blue-800 mb-1">Common Use Cases:</h5>
                                  <ul className="text-xs text-blue-700 space-y-1">
                                    <li>• Feature flags: <code>?feature=new-ui</code></li>
                                    <li>• A/B tests: <code>Cookie: test_group=a</code></li>
                                    <li>• Beta access: <code>X-Beta-User: true</code></li>
                                    <li>• Canary deploys: Route 10% to new version</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Static Site Instructions */}
              {selectedType === "static" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-900">Static Site Deployment</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        After creating your site, upload your files to:
                      </p>
                      <code className="block mt-2 text-xs bg-blue-100 px-2 py-1 rounded">
                        /hosting/data/static/{formData.domain ? formData.domain.replace(/[^a-z0-9-]/g, '-') : "your-site"}/
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate("/applications")}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deployMutation.isPending}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {deployMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Deploying...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Deploy Application
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}