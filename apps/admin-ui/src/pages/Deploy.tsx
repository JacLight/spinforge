import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { hostingAPI, VHost } from "../services/hosting-api";
import { toast } from "sonner";
import { Rocket } from "lucide-react";

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
      };

      switch (selectedType) {
        case "static":
          // For static sites, add the configuration fields
          return hostingAPI.createVHost({
            ...baseConfig,
            index_file: formData.indexFile,
            error_file: formData.errorFile,
          } as VHost);

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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Deploy New Application</h1>
        </div>
        <p className="text-gray-600">
          Choose a hosting type and configure your application deployment
        </p>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-8">
          {/* Hosting Type Selection */}
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl p-6">
            <HostingTypeSelector
              selectedType={selectedType}
              onSelectType={setSelectedType}
            />
          </div>

          {/* Domain Configuration */}
          {selectedType && (
            <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl">
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
            <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl">
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
                    onIndexFileChange={(indexFile) => setFormData({ ...formData, indexFile })}
                    onErrorFileChange={(errorFile) => setFormData({ ...formData, errorFile })}
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

              {/* Actions */}
              <DeployActions isSubmitting={deployMutation.isPending} />
            </div>
          )}
        </div>
      </form>
    </div>
  );
}