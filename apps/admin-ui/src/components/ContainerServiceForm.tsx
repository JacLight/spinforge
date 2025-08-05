/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { X, Plus, AlertCircle, Heart } from 'lucide-react';

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

interface ContainerServiceFormProps {
  container: ContainerService;
  containerIndex: number;
  containers: ContainerService[];
  domain: string;
  onUpdate: (index: number, container: ContainerService) => void;
  onRemove: (index: number) => void;
}

export default function ContainerServiceForm({
  container,
  containerIndex,
  containers,
  domain,
  onUpdate,
  onRemove,
}: ContainerServiceFormProps) {
  const updateContainer = (updates: Partial<ContainerService>) => {
    onUpdate(containerIndex, { ...container, ...updates });
  };

  const updateHealthCheck = (updates: Partial<ContainerService['healthCheck']>) => {
    updateContainer({
      healthCheck: { ...container.healthCheck, ...updates }
    });
  };

  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-md font-medium text-gray-900">
          Service: {container.name || `Container ${containerIndex + 1}`}
        </h4>
        {containers.length > 1 && (
          <button
            type="button"
            onClick={() => onRemove(containerIndex)}
            className="text-red-600 hover:text-red-700"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Basic Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={container.name}
              onChange={(e) => updateContainer({ name: e.target.value })}
              className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
              placeholder="api, database, cache, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subdomain (optional)
            </label>
            <div className="flex">
              <input
                type="text"
                value={container.subdomain}
                onChange={(e) => updateContainer({ subdomain: e.target.value })}
                className="block w-full rounded-l-md border border-gray-300 py-2 px-3 text-sm"
                placeholder="api"
              />
              <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                .{domain || 'domain'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Docker Image <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={container.image}
              onChange={(e) => updateContainer({ image: e.target.value })}
              className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
              placeholder="nginx:alpine, postgres:14, redis:7"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Container Port <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={container.port}
              onChange={(e) => updateContainer({ port: parseInt(e.target.value) || 8080 })}
              className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
              placeholder="8080"
              min="1"
              max="65535"
            />
          </div>
        </div>

        {/* Health Check Configuration */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              <h5 className="text-sm font-medium text-gray-900">Health Check</h5>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={container.healthCheck.enabled}
                onChange={(e) => updateHealthCheck({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {container.healthCheck.enabled && (
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Check Type
                  </label>
                  <select
                    value={container.healthCheck.type}
                    onChange={(e) => updateHealthCheck({ type: e.target.value as 'http' | 'tcp' | 'exec' })}
                    className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                  >
                    <option value="http">HTTP</option>
                    <option value="tcp">TCP</option>
                    <option value="exec">Command</option>
                  </select>
                </div>

                {container.healthCheck.type === 'http' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Health Check Path
                    </label>
                    <input
                      type="text"
                      value={container.healthCheck.path}
                      onChange={(e) => updateHealthCheck({ path: e.target.value })}
                      className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                      placeholder="/health"
                    />
                  </div>
                )}

                {container.healthCheck.type === 'exec' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Health Check Command
                    </label>
                    <input
                      type="text"
                      value={container.healthCheck.command}
                      onChange={(e) => updateHealthCheck({ command: e.target.value })}
                      className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm font-mono"
                      placeholder="pg_isready -U postgres"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Interval (s)
                  </label>
                  <input
                    type="number"
                    value={container.healthCheck.interval}
                    onChange={(e) => updateHealthCheck({ interval: parseInt(e.target.value) || 30 })}
                    className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                    min="5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Timeout (s)
                  </label>
                  <input
                    type="number"
                    value={container.healthCheck.timeout}
                    onChange={(e) => updateHealthCheck({ timeout: parseInt(e.target.value) || 10 })}
                    className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Retries
                  </label>
                  <input
                    type="number"
                    value={container.healthCheck.retries}
                    onChange={(e) => updateHealthCheck({ retries: parseInt(e.target.value) || 3 })}
                    className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Start Period (s)
                  </label>
                  <input
                    type="number"
                    value={container.healthCheck.startPeriod}
                    onChange={(e) => updateHealthCheck({ startPeriod: parseInt(e.target.value) || 40 })}
                    className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                    min="0"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="ml-2 text-xs text-blue-700">
                    <p className="font-medium">Health Check Info</p>
                    <p className="mt-1">
                      {container.healthCheck.type === 'http' && 
                        `HTTP GET requests to ${container.subdomain ? `${container.subdomain}.${domain}` : domain}${container.healthCheck.path}`}
                      {container.healthCheck.type === 'tcp' && 
                        `TCP connection check on port ${container.port}`}
                      {container.healthCheck.type === 'exec' && 
                        `Execute command inside container`}
                    </p>
                    <p className="mt-1">
                      Checks every {container.healthCheck.interval}s, timeout after {container.healthCheck.timeout}s, 
                      retry {container.healthCheck.retries} times before marking unhealthy.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Environment Variables */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Environment Variables
          </label>
          <div className="space-y-2">
            {container.env.map((env, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={env.key}
                  onChange={(e) => {
                    const newEnv = [...container.env];
                    newEnv[index].key = e.target.value;
                    updateContainer({ env: newEnv });
                  }}
                  className="flex-1 rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                  placeholder="KEY"
                />
                <input
                  type="text"
                  value={env.value}
                  onChange={(e) => {
                    const newEnv = [...container.env];
                    newEnv[index].value = e.target.value;
                    updateContainer({ env: newEnv });
                  }}
                  className="flex-1 rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                  placeholder="value"
                />
                <button
                  type="button"
                  onClick={() => {
                    updateContainer({ env: container.env.filter((_, i) => i !== index) });
                  }}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                updateContainer({ env: [...container.env, { key: "", value: "" }] });
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add Environment Variable
            </button>
          </div>
        </div>

        {/* Dependencies */}
        {containers.length > 1 && (
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Depends On
            </label>
            <div className="space-y-2">
              {containers
                .filter((_, idx) => idx !== containerIndex)
                .map((otherContainer, idx) => (
                  <label key={idx} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={container.dependsOn.includes(otherContainer.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateContainer({ dependsOn: [...container.dependsOn, otherContainer.name] });
                        } else {
                          updateContainer({ 
                            dependsOn: container.dependsOn.filter(d => d !== otherContainer.name) 
                          });
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{otherContainer.name}</span>
                  </label>
                ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              This service will start after the selected services are healthy
            </p>
          </div>
        )}

        {/* Advanced Options */}
        <details className="border-t pt-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
            Advanced Options
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Command Override
              </label>
              <input
                type="text"
                value={container.command}
                onChange={(e) => updateContainer({ command: e.target.value })}
                className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm font-mono"
                placeholder="npm start"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Memory Limit
                </label>
                <input
                  type="text"
                  value={container.memoryLimit}
                  onChange={(e) => updateContainer({ memoryLimit: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                  placeholder="512m"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CPU Limit
                </label>
                <input
                  type="text"
                  value={container.cpuLimit}
                  onChange={(e) => updateContainer({ cpuLimit: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                  placeholder="0.5"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Restart Policy
              </label>
              <select
                value={container.restartPolicy}
                onChange={(e) => updateContainer({ restartPolicy: e.target.value })}
                className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
              >
                <option value="no">No (never restart)</option>
                <option value="always">Always</option>
                <option value="unless-stopped">Unless Stopped</option>
                <option value="on-failure">On Failure</option>
              </select>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}