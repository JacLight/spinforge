/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { hostingAPI, VHost } from "../services/hosting-api";
import { toast } from "sonner";
import { 
  Rocket, 
  Grid3X3, 
  Package, 
  Upload, 
  LayoutDashboard, 
  Globe,
  ArrowLeft,
  Network,
  Plus,
  Trash2,
  Container,
  Wand2
} from "lucide-react";
import { motion } from "framer-motion";

// Import deploy components
import HostingTypeSelector from "../components/deploy/HostingTypeSelector";
import DomainAliasesConfig from "../components/deploy/DomainAliasesConfig";
import StaticSiteConfig from "../components/deploy/StaticSiteConfig";
import ProxySiteConfig from "../components/deploy/ProxySiteConfig";
import ContainerDeploymentConfig from "../components/deploy/ContainerDeploymentConfig";
import DeployActions from "../components/deploy/DeployActions";
import DeployContainerForm from "../components/DeployContainerForm";

export default function Deploy() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>("");
  const [showContainerWizard, setShowContainerWizard] = useState(false);
  const [backends, setBackends] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<{[key: number]: string}>({});
  const [showSuggestions, setShowSuggestions] = useState<{[key: number]: boolean}>({});
  
  // Fetch existing applications for local backend selection
  const { data: existingApps } = useQuery({
    queryKey: ['applications'],
    queryFn: () => hostingAPI.listVHosts(),
    select: (data) => data.filter((app: any) => 
      app.type === 'container' || app.type === 'proxy' || app.type === 'static'
    )
  });
  
  const [formData, setFormData] = useState({
    domain: "",
    aliases: [] as string[],
    
    // Static site config
    indexFile: "index.html",
    errorFile: "",
    zipFile: null as File | null,
    
    // Proxy config
    proxyTarget: "",
    preserveHost: false,
    websocketSupport: false,
    
    // Simple container config
    containerImage: "",
    containerPort: "80",
    containerEnvVars: "",
    
    // Private registry credentials
    registryUrl: "",
    registryUsername: "",
    registryPassword: "",
    
    // Advanced container config (Docker Compose)
    composeYaml: "",
    
    // SSL configuration
    enableSSL: false,
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (!formData.domain) {
        throw new Error("Domain is required");
      }

      const baseConfig: any = {
        id: formData.domain, // Use domain as id for compatibility
        domain: formData.domain,
        type: selectedType,
        enabled: true,
        aliases: formData.aliases.filter(a => a),
        customerId: "default",
        ssl: formData.enableSSL ? { enabled: true, provider: 'letsencrypt' } : { enabled: false },
      };

      switch (selectedType) {
        case "static":
          // If there's a zip file, validate it can be uploaded first
          if (formData.zipFile) {
            // Check file size before creating site
            if (formData.zipFile.size > 100 * 1024 * 1024) {
              throw new Error('File size exceeds 100MB limit');
            }
            
            // Create site with a flag indicating it needs file upload
            const result = await hostingAPI.createVHost({
              ...baseConfig,
              index_file: formData.indexFile,
              error_file: formData.errorFile,
              pending_upload: true, // Mark as pending
            } as VHost);
            
            // Now upload the file
            const uploadFormData = new FormData();
            uploadFormData.append('zipfile', formData.zipFile);
            
            try {
              await hostingAPI.uploadStaticSiteZip(formData.domain, uploadFormData);
              // Success - site is ready
              return result;
            } catch (error: any) {
              // Upload failed - delete the empty site
              try {
                await hostingAPI.deleteVHost(formData.domain);
              } catch (deleteError) {
                console.error('Failed to cleanup after upload failure:', deleteError);
              }
              
              // Re-throw the upload error
              if (error.response?.status === 413) {
                throw new Error('File too large. Please ensure your ZIP file is under 100MB.');
              } else if (error.response?.data?.error) {
                throw new Error(`Upload failed: ${error.response.data.error}`);
              } else {
                throw new Error('Failed to upload files. Please try again.');
              }
            }
          } else {
            // No file to upload, just create the site
            return hostingAPI.createVHost({
              ...baseConfig,
              index_file: formData.indexFile,
              error_file: formData.errorFile,
            } as VHost);
          }

        case "proxy":
          if (!formData.proxyTarget) {
            throw new Error("Target URL is required for proxy");
          }
          return hostingAPI.createVHost({
            ...baseConfig,
            target: formData.proxyTarget,
            preserve_host: formData.preserveHost,
            websocket_support: formData.websocketSupport,
          } as VHost);

        case "container":
          // Check if using Docker Compose mode
          if (formData.composeYaml) {
            // Docker Compose deployment - use 'compose' type
            return hostingAPI.createVHost({
              domain: formData.domain,
              type: 'compose',
              compose: formData.composeYaml,
              customerId: formData.customerEmail || "default",
              enabled: true,
              ssl: formData.enableSSL ? { enabled: true, provider: 'letsencrypt' } : { enabled: false },
              aliases: formData.aliases.filter(a => a),
            } as any);
          } else {
            // Simple mode - single container
            if (!formData.containerImage) {
              throw new Error("Docker image is required");
            }
            
            // Parse environment variables
            const envArray = formData.containerEnvVars
              .split('\n')
              .filter(line => line.trim())
              .map(line => {
                const [key, ...valueParts] = line.split('=');
                return { key: key.trim(), value: valueParts.join('=').trim() };
              });
            
            // Build container config
            const containerConfig: any = {
              image: formData.containerImage,
              port: parseInt(formData.containerPort) || 80,
              env: envArray,
              restartPolicy: "unless-stopped",
            };
            
            // Add registry credentials if provided
            if (formData.registryUsername && formData.registryPassword) {
              containerConfig.registryCredentials = {
                registry: formData.registryUrl || undefined,
                username: formData.registryUsername,
                password: formData.registryPassword,
              };
            }
            
            return hostingAPI.createVHost({
              ...baseConfig,
              containerConfig,
            } as any);
          }

        case "loadbalancer":
          if (backends.length === 0) {
            throw new Error("At least one backend server is required");
          }
          return hostingAPI.createVHost({
            ...baseConfig,
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
          } as any);

        default:
          throw new Error("Please select a hosting type");
      }
    },
    onSuccess: () => {
      toast.success("Application deployed successfully!");
      navigate("/applications");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to deploy application");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    deployMutation.mutate();
  };

  // Show container wizard if selected
  if (showContainerWizard) {
    return <DeployContainerForm onClose={() => setShowContainerWizard(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Grid3X3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Deploy New Application
                  </h1>
                  <p className="text-sm text-gray-500">Deploy and configure your applications</p>
                </div>
              </div>
              
              {/* Enhanced Dashboard Navigation */}
              <div className="hidden lg:flex items-center space-x-2">
                {/* Primary Dashboard Tabs */}
                <div className="flex items-center space-x-1 bg-white/60 backdrop-blur-sm rounded-2xl p-1 border border-white/20 shadow-lg">
                  <Link
                    to="/"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden xl:inline">Dashboard</span>
                  </Link>
                  <Link
                    to="/applications"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <Package className="w-4 h-4" />
                    <span className="hidden xl:inline">Apps</span>
                  </Link>
                  <Link
                    to="/deploy"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-lg"></div>
                    <Upload className="w-4 h-4 relative z-10" />
                    <span className="hidden xl:inline relative z-10">Deploy</span>
                  </Link>
                  <Link
                    to="/hosting"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <Globe className="w-4 h-4" />
                    <span className="hidden xl:inline">Hosting</span>
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                to="/applications"
                className="flex items-center space-x-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/80 transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Apps</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Content */}
      <div className="px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className=""
        >

          {/* Configuration Form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-8">
          {/* Hosting Type Selection */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
            <HostingTypeSelector
              selectedType={selectedType}
              onSelectType={setSelectedType}
            />
          </div>

          {/* Domain Configuration */}
          {selectedType && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
              <div className="px-6 py-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Domain Configuration</h2>
                <DomainAliasesConfig
                  domain={formData.domain}
                  aliases={formData.aliases}
                  onDomainChange={(domain) => setFormData({ ...formData, domain })}
                  onAliasesChange={(aliases) => setFormData({ ...formData, aliases })}
                />
              </div>
            </div>
          )}

          {/* Type-specific Configuration */}
          {selectedType && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
              <div className="px-6 py-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  {selectedType === 'static' && 'Static Site Configuration'}
                  {selectedType === 'proxy' && 'Proxy Configuration'}
                  {selectedType === 'container' && 'Container Configuration'}
                  {selectedType === 'loadbalancer' && 'Load Balancer Configuration'}
                </h2>

                {/* Static Site Config */}
                {selectedType === "static" && (
                  <StaticSiteConfig
                    indexFile={formData.indexFile}
                    errorFile={formData.errorFile}
                    domain={formData.domain}
                    zipFile={formData.zipFile}
                    onIndexFileChange={(indexFile) => setFormData({ ...formData, indexFile })}
                    onErrorFileChange={(errorFile) => setFormData({ ...formData, errorFile })}
                    onZipFileChange={(zipFile) => setFormData({ ...formData, zipFile })}
                  />
                )}

                {/* Proxy Config */}
                {selectedType === "proxy" && (
                  <ProxySiteConfig
                    target={formData.proxyTarget}
                    preserveHost={formData.preserveHost}
                    websocketSupport={formData.websocketSupport}
                    onTargetChange={(proxyTarget) => setFormData({ ...formData, proxyTarget })}
                    onPreserveHostChange={(preserveHost) => setFormData({ ...formData, preserveHost })}
                    onWebsocketSupportChange={(websocketSupport) => setFormData({ ...formData, websocketSupport })}
                  />
                )}

                {/* Container Config */}
                {selectedType === "container" && (
                  <div className="space-y-6">
                    {/* Container Wizard Option */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Need help with complex deployments?</h3>
                          <p className="text-sm text-gray-600">
                            Use our Container Wizard for step-by-step deployment of WordPress, Node.js, databases, and more.
                            Or upload your existing docker-compose.yml file.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowContainerWizard(true)}
                          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 flex items-center gap-2 font-medium whitespace-nowrap"
                        >
                          <Wand2 className="h-5 w-5" />
                          <span>Launch Container Wizard</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Regular Container Config */}
                    <ContainerDeploymentConfig
                      image={formData.containerImage}
                      port={formData.containerPort}
                      envVars={formData.containerEnvVars}
                      registryUrl={formData.registryUrl}
                      registryUsername={formData.registryUsername}
                      registryPassword={formData.registryPassword}
                      composeYaml={formData.composeYaml}
                      onImageChange={(containerImage) => setFormData({ ...formData, containerImage })}
                      onPortChange={(containerPort) => setFormData({ ...formData, containerPort })}
                      onEnvVarsChange={(containerEnvVars) => setFormData({ ...formData, containerEnvVars })}
                      onRegistryUrlChange={(registryUrl) => setFormData({ ...formData, registryUrl })}
                      onRegistryUsernameChange={(registryUsername) => setFormData({ ...formData, registryUsername })}
                      onRegistryPasswordChange={(registryPassword) => setFormData({ ...formData, registryPassword })}
                      onComposeYamlChange={(composeYaml) => setFormData({ ...formData, composeYaml })}
                    />
                  </div>
                )}

                {/* Load Balancer Config */}
                {selectedType === "loadbalancer" && (
                  <div className="space-y-4">
                    {/* Help text */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>For local backends:</strong> Check "Local Backend" to see available SpinForge applications
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        <strong>For external backends:</strong> Enter the full URL (e.g., http://api.example.com)
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      {backends.map((backend, index) => (
                        <div key={index} className="group relative bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all duration-200">
                          <div className="p-5">
                            {/* Modern Toggle Switch for Local/External */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newBackends = [...backends];
                                    newBackends[index] = { 
                                      ...backend, 
                                      isLocal: !backend.isLocal,
                                      url: ''
                                    };
                                    setBackends(newBackends);
                                  }}
                                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                                    backend.isLocal ? 'bg-blue-600' : 'bg-gray-300'
                                  }`}
                                >
                                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                                    backend.isLocal ? 'translate-x-8' : 'translate-x-1'
                                  }`} />
                                </button>
                                <span className="text-sm font-medium text-gray-900">
                                  {backend.isLocal ? 'Local Service' : 'External URL'}
                                </span>
                              </div>
                              
                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => setBackends(backends.filter((_, i) => i !== index))}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Main Input Area */}
                            <div className="space-y-3">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={backend.url || ''}
                                  onChange={(e) => {
                                    const newBackends = [...backends];
                                    newBackends[index] = { ...backend, url: e.target.value };
                                    setBackends(newBackends);
                                    
                                    if (backend.isLocal) {
                                      setSearchQuery({...searchQuery, [index]: e.target.value});
                                      setShowSuggestions({...showSuggestions, [index]: true});
                                    }
                                  }}
                                  onFocus={() => {
                                    if (backend.isLocal) {
                                      setShowSuggestions({...showSuggestions, [index]: true});
                                    }
                                  }}
                                  onBlur={() => {
                                    // Delay to allow click on suggestions
                                    setTimeout(() => {
                                      setShowSuggestions({...showSuggestions, [index]: false});
                                    }, 200);
                                  }}
                                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                  placeholder={backend.isLocal ? "Search services (e.g., api, auth, db)..." : "https://api.example.com"}
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

                              {/* Weight and Status in one row */}
                              <div className="flex gap-3">
                                <div className="flex-1">
                                  <input
                                    type="number"
                                    value={backend.weight || 1}
                                    onChange={(e) => {
                                      const newBackends = [...backends];
                                      newBackends[index] = { ...backend, weight: parseInt(e.target.value) || 1 };
                                      setBackends(newBackends);
                                    }}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                    placeholder="Weight"
                                    min="1"
                                    max="100"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newBackends = [...backends];
                                    newBackends[index] = { ...backend, enabled: !backend.enabled };
                                    setBackends(newBackends);
                                  }}
                                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                                    backend.enabled !== false
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  }`}
                                >
                                  {backend.enabled !== false ? 'Active' : 'Inactive'}
                                </button>
                              </div>
                            </div>
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
                      
                      {backends.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Network className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm">No backend servers configured</p>
                          <p className="text-xs mt-1">Click "Add Backend Server" to get started</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SSL Configuration */}
          {selectedType && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
              <div className="px-6 py-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">SSL Configuration</h2>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="enableSSL"
                      checked={formData.enableSSL}
                      onChange={(e) => setFormData({ ...formData, enableSSL: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enableSSL" className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">Enable Auto SSL (Let's Encrypt)</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Free
                      </span>
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 ml-7">
                    Automatically provision and renew SSL certificates using Let's Encrypt. 
                    Your site will be accessible via HTTPS with trusted encryption.
                  </p>
                  {formData.enableSSL && (
                    <div className="ml-7 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm text-blue-700 font-medium">SSL will be configured after deployment</span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        Certificate provisioning may take 1-2 minutes to complete.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <DeployActions isSubmitting={deployMutation.isPending} />
            </div>
          )}
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}