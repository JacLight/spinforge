import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, Route } from "../services/api";
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
} from "lucide-react";

const deploySchema = {
  type: "object",
  properties: {
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
    },
    upload: {
      name: "upload",
      label: "Upload Application",
      type: "string",
      "x-control": "file",
      required: false,
      description: "Upload your application package (zip, tar.gz, etc.)",
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
    },
    cpu: {
      title: "CPU Limit",
      type: "number",
      placeholder: "0.5",
      default: "0.5",
      max: 4,
      description: "CPU allocation (e.g., 0.5 = 50% of one core)",
      group: "Resource Limits",
    },
    env: {
      title: "Environment Variables",
      type: "string",
      "x-control-variant": "textarea",
      placeholder: "KEY=value\nANOTHER_KEY=another_value",
      description: "One per line in KEY=value format",
      rows: 4,
    },
  },
};

export default function DeployForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<any>({});
  const [isDeploying, setIsDeploying] = useState(false);

  const deployMutation = useMutation({
    mutationFn: (data: Route) => api.createRoute(data),
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
                (!formData.gitUrl && !formData.upload && !formData.buildPath)
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
