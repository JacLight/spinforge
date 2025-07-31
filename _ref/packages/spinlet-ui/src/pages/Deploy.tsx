import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, Route } from "../services/api";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";
import BusyIcon from "@/components/icons/svg";

const frameworks = [
  { value: "remix", label: "Remix" },
  { value: "nextjs", label: "Next.js" },
  { value: "express", label: "Express" },
  { value: "static", label: "Static Files" },
];

export default function Deploy() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    domain: "",
    customerId: "",
    buildPath: "",
    framework: "express",
    memory: "512MB",
    cpu: "0.5",
    env: "",
  });

  const deployMutation = useMutation({
    mutationFn: (data: Route) => api.createRoute(data),
    onSuccess: () => {
      navigate("/applications");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const envVars = formData.env
      ? formData.env.split("\n").reduce((acc, line) => {
          const [key, value] = line.split("=");
          if (key && value) acc[key.trim()] = value.trim();
          return acc;
        }, {} as Record<string, string>)
      : undefined;

    deployMutation.mutate({
      domain: formData.domain,
      customerId: formData.customerId,
      spinletId: `spin-${Date.now()}`,
      buildPath: formData.buildPath,
      framework: formData.framework,
      config: {
        memory: formData.memory,
        cpu: formData.cpu,
        env: envVars,
      },
    });
  };

  return (
    <div className="max-w-2xl">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Deploy New Application
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div className="px-4 py-6 sm:p-8">
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label
                  htmlFor="domain"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Domain
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="domain"
                    id="domain"
                    required
                    value={formData.domain}
                    onChange={(e) =>
                      setFormData({ ...formData, domain: e.target.value })
                    }
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="myapp.example.com"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="customerId"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Customer ID
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="customerId"
                    id="customerId"
                    required
                    value={formData.customerId}
                    onChange={(e) =>
                      setFormData({ ...formData, customerId: e.target.value })
                    }
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="customer-123"
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label
                  htmlFor="buildPath"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Build Path
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="buildPath"
                    id="buildPath"
                    required
                    value={formData.buildPath}
                    onChange={(e) =>
                      setFormData({ ...formData, buildPath: e.target.value })
                    }
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="/path/to/your/app"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Absolute path to your application directory
                </p>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="framework"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Framework
                </label>
                <div className="mt-2">
                  <select
                    id="framework"
                    name="framework"
                    value={formData.framework}
                    onChange={(e) =>
                      setFormData({ ...formData, framework: e.target.value })
                    }
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    {frameworks.map((fw) => (
                      <option key={fw.value} value={fw.value}>
                        {fw.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="memory"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Memory Limit
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="memory"
                    id="memory"
                    value={formData.memory}
                    onChange={(e) =>
                      setFormData({ ...formData, memory: e.target.value })
                    }
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="512MB"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="cpu"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  CPU Limit
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="cpu"
                    id="cpu"
                    value={formData.cpu}
                    onChange={(e) =>
                      setFormData({ ...formData, cpu: e.target.value })
                    }
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="0.5"
                  />
                </div>
              </div>

              <div className="col-span-full">
                <label
                  htmlFor="env"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Environment Variables
                </label>
                <div className="mt-2">
                  <textarea
                    id="env"
                    name="env"
                    rows={4}
                    value={formData.env}
                    onChange={(e) =>
                      setFormData({ ...formData, env: e.target.value })
                    }
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  One per line in KEY=value format
                </p>
              </div>
            </div>
          </div>

          {deployMutation.error && (
            <div className="rounded-md bg-red-50 p-4 m-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Deployment failed
                  </h3>
                  <p className="mt-2 text-sm text-red-700">
                    {(deployMutation.error as Error).message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {deployMutation.isSuccess && (
            <div className="rounded-md bg-green-50 p-4 m-4">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Deployment successful!
                  </h3>
                  <p className="mt-2 text-sm text-green-700">
                    Your application has been deployed successfully.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => navigate("/applications")}
              className="text-sm font-semibold leading-6 text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deployMutation.isPending}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              <BusyIcon isLoading={deployMutation.isPending} />
              {deployMutation.isPending ? "Deploying..." : "Deploy Application"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
