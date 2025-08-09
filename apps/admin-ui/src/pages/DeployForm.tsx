/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, Route } from "../services/api";
import { hostingAPI } from "../services/hosting-api";
import { toast } from "sonner";
import { AppmintForm } from "@appmint/form";
import {
  Upload,
  Globe,
  Server,
  Code2,
  Settings,
  ArrowLeft,
  Rocket,
  Network,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";

const deploySchema = {
  type: "object",
  properties: {
    deploymentType: {
      name: "deploymentType",
      label: "Deployment Type",
      type: "string",
      "x-control": "selectMany",
      required: true,
      options: [
        { value: "static", label: "Static Website" },
        { value: "loadbalancer", label: "Load Balancer" },
        { value: "container", label: "Docker Container" },
        { value: "proxy", label: "Reverse Proxy" },
      ],
      default: "static",
      description: "Select the type of deployment",
    },
    domain: {
      type: "string",
      required: true,
      placeholder: "myapp.example.com",
      description: "The domain name for your application",
      pattern: /^[a-z0-9]+([\\-\\.]{1}[a-z0-9]+)*\\.[a-z]{2,}$/,
    },
    customerEmail: {
      name: "customerEmail",
      label: "Customer Email",
      type: "string",
      required: true,
      placeholder: "customer@example.com",
      description: "Unique identifier for the customer",
    },
    gitUrl: {
      name: "gitUrl",
      label: "Git Repository URL",
      type: "string",
      required: false,
      placeholder: "https://github.com/username/repo.git",
      description: "Git repository URL (leave empty to upload a file instead)",
      rules: [
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "loadbalancer",
          action: "hide",
        },
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "proxy",
          action: "hide",
        },
      ],
    },
    upload: {
      name: "upload",
      label: "Upload Application",
      type: "string",
      "x-control": "file",
      required: false,
      description: "Upload your application package (zip, tar.gz, etc.)",
      rules: [
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "loadbalancer",
          action: "hide",
        },
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "proxy",
          action: "hide",
        },
      ],
    },
    buildPath: {
      name: "buildPath",
      label: "Build Path (Optional)",
      type: "string",
      required: false,
      placeholder: "auto-generated",
      description: "Leave empty for automatic path generation",
      hidden: true,
    },
    framework: {
      name: "framework",
      label: "Framework",
      type: "string",
      "x-control": "selectMany",
      required: true,
      options: [
        { value: "static", label: "Static Files" },
        { value: "flutter", label: "Flutter" },
        { value: "react", label: "React" },
        { value: "remix", label: "Remix" },
        { value: "nextjs", label: "Next.js" },
        { value: "nestjs", label: "NestJS" },
        { value: "node", label: "Node.js" },
        { value: "vue", label: "Vue.js" },
        { value: "astro", label: "Astro" },
        { value: "docker", label: "Docker" },
        { value: "custom", label: "Custom" },
      ],
      default: "nextjs",
      rules: [
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "loadbalancer",
          action: "hide",
        },
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "proxy",
          action: "hide",
        },
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "container",
          action: "hide",
        },
      ],
    },
    cmd: {
      name: "cmd",
      label: "Command",
      type: "string",
      "x-control": "selectMany",
      rules: [
        {
          operation: "notEqual",
          valueA: "{{framework}}",
          valueB: "custom",
          action: "hide",
        },
      ],
    },
    memory: {
      name: "memory",
      title: "Memory Limit",
      type: "number",
      placeholder: "512MB",
      default: "512",
      description: "Memory allocation for the application in MB",
      group: "Resource Limits",
      rules: [
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "loadbalancer",
          action: "hide",
        },
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "proxy",
          action: "hide",
        },
      ],
    },
    cpu: {
      title: "CPU Limit",
      type: "number",
      placeholder: "0.5",
      default: "0.5",
      max: 4,
      description: "CPU allocation (e.g., 0.5 = 50% of one core)",
      group: "Resource Limits",
      rules: [
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "loadbalancer",
          action: "hide",
        },
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "proxy",
          action: "hide",
        },
      ],
    },
    env: {
      title: "Environment Variables",
      type: "string",
      "x-control-variant": "textarea",
      placeholder: "KEY=value\nANOTHER_KEY=another_value",
      description: "One per line in KEY=value format",
      rows: 4,
      rules: [
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "loadbalancer",
          action: "hide",
        },
        {
          operation: "equal",
          valueA: "{{deploymentType}}",
          valueB: "proxy",
          action: "hide",
        },
      ],
    },
  },
};

export default function DeployForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<any>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const [backends, setBackends] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<{[key: number]: boolean}>({});
  
  // Fetch existing applications for local backend selection
  const { data: existingApps } = useQuery({
    queryKey: ['applications'],
    queryFn: () => hostingAPI.listVHosts(),
    select: (data) => data.filter((app: any) => 
      app.type === 'container' || app.type === 'proxy' || app.type === 'static'
    )
  });

  const deployMutation = useMutation({
    mutationFn: async (data: any) => {
      // Use hostingAPI for Load Balancer and other hosting deployments
      if (data.type === 'loadbalancer' || data.type === 'proxy' || data.type === 'container') {
        return hostingAPI.createVHost(data);
      }
      // Use old API for static deployments
      return api.createRoute(data);
    },
    onSuccess: () => {
      toast.success("Application deployed successfully!");
      setTimeout(() => navigate("/applications"), 1500);
    },
    onError: (error: Error) => {
      toast.error(`Deployment failed: ${error.message}`);
      setIsDeploying(false);
    },
  });

  const handleFormChange = (path: string, value: any, data: any) => {
    setFormData(data);
  };

  const handleSubmit = async () => {
    setIsDeploying(true);

    // Handle Load Balancer deployment
    if (formData.deploymentType === 'loadbalancer') {
      deployMutation.mutate({
        domain: formData.domain,
        type: 'loadbalancer',
        customerId: formData.customerEmail || formData.customerId,
        enabled: true,
        backends: backends.map(b => ({
          url: b.url,
          label: b.label || `backend-${backends.indexOf(b) + 1}`,
          enabled: b.enabled !== false,
          isLocal: b.isLocal || false,
          weight: b.weight || 1,
          healthCheck: {
            path: b.healthCheck?.path || '/health',
            interval: b.healthCheck?.interval || 10,
            timeout: b.healthCheck?.timeout || 5,
            unhealthyThreshold: b.healthCheck?.unhealthyThreshold || 3,
            healthyThreshold: b.healthCheck?.healthyThreshold || 2
          }
        })),
        stickySessionDuration: 3600, // Default 1 hour
      });
      return;
    }

    // Handle other deployment types
    const envVars = formData.env
      ? formData.env.split("\n").reduce((acc, line) => {
          const [key, value] = line.split("=");
          if (key && value) acc[key.trim()] = value.trim();
          return acc;
        }, {} as Record<string, string>)
      : undefined;

    // Generate build path if not provided
    const spinletId = `spin-${Date.now()}`;
    let buildPath = formData.buildPath;

    // If no build path, generate one based on deployment method
    if (!buildPath) {
      if (formData.gitUrl) {
        // For git repos, use a standard path
        buildPath = `/builds/${spinletId}/repo`;
      } else if (formData.upload) {
        // For uploads, use upload path
        buildPath = `/builds/${spinletId}/upload`;
      } else {
        // Default path
        buildPath = `/builds/${spinletId}`;
      }
    }

    // TODO: In production, handle file upload and git clone here
    // For now, we'll just use the provided or generated path

    deployMutation.mutate({
      domain: formData.domain,
      customerId: formData.customerEmail || formData.customerId,
      spinletId: spinletId,
      buildPath: buildPath,
      framework: formData.framework,
      config: {
        memory: formData.memory,
        cpu: formData.cpu,
        env: envVars,
        ...(formData.gitUrl && { gitUrl: formData.gitUrl }), // Store for future use
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/applications")}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Applications
          </button>
        </div>

        <div className="flex items-center">
          <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl mr-4">
            <Rocket className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Deploy New Application
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Configure and deploy your application to the SpinForge platform
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-full">
              <Globe className="h-5 w-5" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Step 1</p>
              <p className="text-xs text-gray-500">Basic Configuration</p>
            </div>
          </div>

          <div className="h-0.5 w-16 bg-gray-200"></div>

          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-gray-200 text-gray-400 rounded-full">
              <Server className="h-5 w-5" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-400">Step 2</p>
              <p className="text-xs text-gray-400">Resource Allocation</p>
            </div>
          </div>

          <div className="h-0.5 w-16 bg-gray-200"></div>

          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-gray-200 text-gray-400 rounded-full">
              <Settings className="h-5 w-5" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-400">Step 3</p>
              <p className="text-xs text-gray-400">Environment Setup</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className={isDeploying ? "pointer-events-none opacity-50" : ""}>
          <AppmintForm
            schema={deploySchema}
            id="deploy-form"
            data={formData}
            onChange={handleFormChange}
          />
          
          {/* Load Balancer Backend Configuration */}
          {formData.deploymentType === 'loadbalancer' && (
            <div className="mt-6 space-y-4">
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Network className="h-5 w-5 text-blue-600" />
                  Backend Servers Configuration
                </h3>
                
                {/* Help text */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>For local backends:</strong> Check "Local Backend" and either:
                  </p>
                  <ul className="text-sm text-blue-700 mt-1 ml-4 list-disc">
                    <li>Select from existing SpinForge applications using the dropdown (shows internal service names)</li>
                    <li>Enter the internal service name directly:
                      <ul className="ml-4 mt-1">
                        <li><code className="bg-blue-100 px-1 rounded text-xs">http://spinforge-myapp-local:3000</code> (for containers)</li>
                        <li><code className="bg-blue-100 px-1 rounded text-xs">http://[container-name]:[port]</code> (custom names)</li>
                      </ul>
                    </li>
                  </ul>
                  <p className="text-sm text-blue-700 mt-2">
                    <strong>For external backends:</strong> Enter the full URL (e.g., <code className="bg-blue-100 px-1 rounded">http://api.example.com</code>)
                  </p>
                </div>
                
                <div className="space-y-4">
                  {backends.map((backend, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      {/* First Row - Backend Type and Label */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={backend.isLocal || false}
                              onChange={(e) => {
                                const newBackends = [...backends];
                                newBackends[index] = { 
                                  ...backend, 
                                  isLocal: e.target.checked,
                                  url: e.target.checked ? '' : backend.url  // Clear URL when switching to local
                                };
                                setBackends(newBackends);
                              }}
                              className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Use Local SpinForge Application</span>
                          </label>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Label (optional)
                          </label>
                          <input
                            type="text"
                            value={backend.label || ''}
                            onChange={(e) => {
                              const newBackends = [...backends];
                              newBackends[index] = { ...backend, label: e.target.value };
                              setBackends(newBackends);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="backend-1"
                          />
                        </div>
                      </div>

                      {/* Second Row - URL Input with Autocomplete */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Backend {backend.isLocal ? 'Application' : 'URL'}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={backend.url || ''}
                            onChange={(e) => {
                              const newBackends = [...backends];
                              newBackends[index] = { ...backend, url: e.target.value };
                              setBackends(newBackends);
                              
                              if (backend.isLocal) {
                                setShowSuggestions({...showSuggestions, [index]: true});
                              }
                            }}
                            onFocus={() => {
                              if (backend.isLocal) {
                                setShowSuggestions({...showSuggestions, [index]: true});
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setShowSuggestions({...showSuggestions, [index]: false});
                              }, 200);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={backend.isLocal ? "Search services (e.g., api, auth, db)..." : "http://backend-server:3000"}
                          />
                          
                          {/* Custom Autocomplete Dropdown */}
                          {backend.isLocal && showSuggestions[index] && existingApps && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                              {(() => {
                                const query = (backend.url || '').toLowerCase();
                                const filtered = query 
                                  ? existingApps.filter((app: any) => 
                                      app.domain.toLowerCase().includes(query) ||
                                      app.type.toLowerCase().includes(query) ||
                                      (app.containerConfig?.image && app.containerConfig.image.toLowerCase().includes(query))
                                    )
                                  : existingApps;
                                
                                if (filtered.length === 0) {
                                  return (
                                    <div className="p-3 text-sm text-gray-500">
                                      No services found matching "{backend.url}"
                                    </div>
                                  );
                                }
                                
                                return filtered.slice(0, 100).map((app: any) => {
                                  const url = app.type === 'container' 
                                    ? `http://spinforge-${app.domain.replace(/\./g, '-')}:${app.containerConfig?.port || 80}`
                                    : app.target || `http://${app.domain}`;
                                  
                                  return (
                                    <button
                                      key={app.domain}
                                      type="button"
                                      onClick={() => {
                                        const newBackends = [...backends];
                                        newBackends[index] = { ...backend, url };
                                        setBackends(newBackends);
                                        setShowSuggestions({...showSuggestions, [index]: false});
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between group border-b border-gray-100 last:border-0"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-gray-900 truncate">
                                          {app.domain}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                          {app.type === 'container' && `${app.containerConfig?.image || 'Container'}`}
                                          {app.type === 'proxy' && 'Reverse Proxy'}
                                          {app.type === 'static' && 'Static Site'}
                                        </div>
                                      </div>
                                      <div className="ml-2 text-xs text-gray-400 group-hover:text-blue-600">
                                        {app.type}
                                      </div>
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </div>
                        {backend.isLocal && backend.url && (
                          <p className="mt-1 text-xs text-gray-500">
                            Internal service name: <code className="bg-gray-100 px-1 rounded">{backend.url}</code>
                          </p>
                        )}
                      </div>
                      
                      {/* Third Row - Weight and Enabled */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Weight
                          </label>
                          <input
                            type="number"
                            value={backend.weight || 1}
                            onChange={(e) => {
                              const newBackends = [...backends];
                              newBackends[index] = { ...backend, weight: parseInt(e.target.value) || 1 };
                              setBackends(newBackends);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            min="1"
                            max="100"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={backend.enabled !== false}
                              onChange={(e) => {
                                const newBackends = [...backends];
                                newBackends[index] = { ...backend, enabled: e.target.checked };
                                setBackends(newBackends);
                              }}
                              className="h-4 w-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-700">Enabled</span>
                          </label>
                        </div>
                      </div>
                      
                      <div className="flex justify-end mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setBackends(backends.filter((_, i) => i !== index));
                          }}
                          className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove Backend
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => {
                      setBackends([...backends, {
                        url: '',
                        label: '',
                        enabled: true,
                        isLocal: false,
                        weight: 1,
                        healthCheck: {
                          path: '/health',
                          interval: 10,
                          timeout: 5,
                          unhealthyThreshold: 3,
                          healthyThreshold: 2
                        }
                      }]);
                    }}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    Add Backend Server
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate("/applications")}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                isDeploying ||
                !formData.domain ||
                !(formData.customerEmail || formData.customerId) ||
                (formData.deploymentType === 'loadbalancer' && backends.length === 0) ||
                (formData.deploymentType !== 'loadbalancer' && !formData.gitUrl && !formData.upload && !formData.buildPath)
              }
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeploying ? "Deploying..." : "Deploy Application"}
            </button>
          </div>
        </div>

        {isDeploying && (
          <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mr-3"></div>
              <p className="text-sm font-medium text-indigo-900">
                Deploying your application... This may take a few moments.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-blue-900 mb-2">
          Deployment Tips
        </h3>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>• Ensure your domain points to the SpinForge cluster</li>
          <li>
            • Build path should contain a valid package.json or Dockerfile
          </li>
          <li>• Start with minimal resources and scale up as needed</li>
          <li>• Environment variables are encrypted at rest</li>
        </ul>
      </div>
    </div>
  );
}
