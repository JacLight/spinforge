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
    description: "Distribute traffic across servers (coming soon)",
    color: "orange",
    disabled: true
  },
];

export default function Deploy() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>("static");
  const [formData, setFormData] = useState({
    subdomain: "",
    domain: "",
    customerId: "",
    target: "",
    aliases: [] as string[],
    newAlias: "",
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
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    return domainRegex.test(domain);
  };

  const isValidSubdomain = (subdomain: string) => {
    if (!subdomain) return false;
    const subdomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    return subdomainRegex.test(subdomain);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate subdomain
    if (!formData.subdomain) {
      newErrors.subdomain = "Site name is required";
    } else if (!isValidSubdomain(formData.subdomain)) {
      newErrors.subdomain = "Please enter a valid site name (letters, numbers, hyphens only)";
    } else if (allVhosts.some(v => v.subdomain === formData.subdomain)) {
      newErrors.subdomain = "This site name is already taken";
    }

    // Validate domain
    if (formData.domain && !isValidDomain(formData.domain)) {
      newErrors.domain = "Please enter a valid domain";
    } else if (formData.domain && allVhosts.some(v => v.domain === formData.domain || v.aliases?.includes(formData.domain))) {
      newErrors.domain = "This domain is already in use";
    }

    // Validate proxy target
    if (selectedType === "proxy" && !formData.target) {
      newErrors.target = "Target URL is required for proxy sites";
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
      subdomain: formData.subdomain,
      type: selectedType,
      customerId: formData.customerId || undefined,
      enabled: true,
    };

    if (formData.domain) {
      data.domain = formData.domain;
    }

    if (formData.aliases.length > 0) {
      data.aliases = formData.aliases;
    }

    if (selectedType === "proxy" && formData.target) {
      data.target = formData.target;
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
              {/* Site Name (Subdomain) */}
              <div>
                <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 mb-2">
                  Site Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    id="subdomain"
                    value={formData.subdomain}
                    onChange={(e) => {
                      setFormData({ ...formData, subdomain: e.target.value.toLowerCase() });
                      if (errors.subdomain) validateForm();
                    }}
                    className={`pl-10 block w-full rounded-md border ${
                      errors.subdomain ? "border-red-300" : "border-gray-300"
                    } py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder="my-awesome-site"
                  />
                </div>
                {errors.subdomain && (
                  <p className="mt-1 text-sm text-red-600">{errors.subdomain}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  This will be your site identifier. Use only letters, numbers, and hyphens.
                </p>
              </div>

              {/* Primary Domain */}
              <div>
                <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Domain
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
                    placeholder="example.com (optional)"
                  />
                </div>
                {errors.domain && (
                  <p className="mt-1 text-sm text-red-600">{errors.domain}</p>
                )}
                {!formData.domain && formData.subdomain && (
                  <p className="mt-1 text-xs text-gray-500">
                    Default: {formData.subdomain}.spinforge.localhost
                  </p>
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
                        /hosting/data/static/{formData.subdomain || "your-site-name"}/
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