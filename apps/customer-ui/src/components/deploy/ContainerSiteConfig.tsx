/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { Package, Plus, X } from 'lucide-react';
import ContainerServiceForm from '../ContainerServiceForm';

interface ContainerService {
  name: string;
  image: string;
  port: number;
  env: { key: string; value: string }[];
  volumes: { host: string; container: string }[];
  command: string;
  memoryLimit: string;
  cpuLimit: string;
  restartPolicy: string;
  dependsOn: string[];
  subdomain: string;
  healthCheck: {
    enabled: boolean;
    type: 'http' | 'tcp' | 'exec';
    path: string;
    interval: number;
    timeout: number;
    retries: number;
    startPeriod: number;
    command: string;
  };
}

interface ContainerSiteConfigProps {
  containers: ContainerService[];
  domain: string;
  onContainersChange: (containers: ContainerService[]) => void;
}

export default function ContainerSiteConfig({
  containers,
  domain,
  onContainersChange,
}: ContainerSiteConfigProps) {
  const addContainer = () => {
    const newContainer: ContainerService = {
      name: `service-${containers.length + 1}`,
      image: "",
      port: 8080,
      env: [],
      volumes: [],
      command: "",
      memoryLimit: "",
      cpuLimit: "",
      restartPolicy: "unless-stopped",
      dependsOn: [],
      subdomain: "",
      healthCheck: {
        enabled: false,
        type: 'http',
        path: '/health',
        interval: 30,
        timeout: 10,
        retries: 3,
        startPeriod: 40,
        command: '',
      },
    };
    onContainersChange([...containers, newContainer]);
  };

  const updateContainer = (index: number, container: ContainerService) => {
    const newContainers = [...containers];
    newContainers[index] = container;
    onContainersChange(newContainers);
  };

  const removeContainer = (index: number) => {
    onContainersChange(containers.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Container Services</h3>
        <button
          type="button"
          onClick={addContainer}
          className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Service
        </button>
      </div>

      {/* Container Services */}
      <div className="space-y-4">
        {containers.map((container, index) => (
          <ContainerServiceForm
            key={index}
            container={container}
            containerIndex={index}
            containers={containers}
            domain={domain}
            onUpdate={updateContainer}
            onRemove={removeContainer}
          />
        ))}
      </div>

      {/* Container Deployment Info */}
      {containers.length === 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start">
            <Package className="h-5 w-5 text-purple-600 mt-0.5" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-purple-900">Docker Container Deployment</h4>
              <p className="text-sm text-purple-700 mt-1">
                Deploy one or more Docker containers with automatic orchestration.
                Perfect for microservices, APIs, and full-stack applications.
              </p>
              <div className="mt-2 text-xs text-purple-600">
                <p>• Multi-container support with service discovery</p>
                <p>• Automatic health checks and restarts</p>
                <p>• Environment variables and volume mounts</p>
                <p>• Resource limits and scaling options</p>
              </div>
              <button
                type="button"
                onClick={addContainer}
                className="mt-3 text-sm text-purple-700 hover:text-purple-800 font-medium"
              >
                Click "Add Service" to get started →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}