/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { hostingAPI, VHost } from "../services/hosting-api";
import { toast } from "sonner";
import { 
  Rocket, 
  Grid3X3, 
  Package, 
  Upload, 
  LayoutDashboard, 
  Globe,
  ArrowLeft 
} from "lucide-react";
import { motion } from "framer-motion";

// Import deploy components
import HostingTypeSelector from "../components/deploy/HostingTypeSelector";
import DomainAliasesConfig from "../components/deploy/DomainAliasesConfig";
import StaticSiteConfig from "../components/deploy/StaticSiteConfig";
import ProxySiteConfig from "../components/deploy/ProxySiteConfig";
import ContainerDeploymentConfig from "../components/deploy/ContainerDeploymentConfig";
import DeployActions from "../components/deploy/DeployActions";

export default function Deploy() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>("");
  
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
          // Check if using simple or advanced mode
          if (formData.composeYaml) {
            // Advanced mode - Docker Compose deployment
            return hostingAPI.createVHost({
              ...baseConfig,
              composeConfig: formData.composeYaml,
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
            
            return hostingAPI.createVHost({
              ...baseConfig,
              containerConfig: {
                image: formData.containerImage,
                port: parseInt(formData.containerPort) || 80,
                env: envArray,
                restartPolicy: "unless-stopped",
              },
            } as any);
          }

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
                  <ContainerDeploymentConfig
                    image={formData.containerImage}
                    port={formData.containerPort}
                    envVars={formData.containerEnvVars}
                    composeYaml={formData.composeYaml}
                    onImageChange={(containerImage) => setFormData({ ...formData, containerImage })}
                    onPortChange={(containerPort) => setFormData({ ...formData, containerPort })}
                    onEnvVarsChange={(containerEnvVars) => setFormData({ ...formData, containerEnvVars })}
                    onComposeYamlChange={(composeYaml) => setFormData({ ...formData, composeYaml })}
                  />
                )}

                {/* Load Balancer Config (placeholder) */}
                {selectedType === "loadbalancer" && (
                  <div className="text-center py-12 text-gray-500">
                    <p>Load balancer configuration coming soon!</p>
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