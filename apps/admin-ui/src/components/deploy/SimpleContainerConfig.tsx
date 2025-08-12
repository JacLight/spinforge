/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState } from 'react';
import { Package, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';

interface SimpleContainerConfigProps {
  image: string;
  port: string;
  envVars: string;
  onImageChange: (value: string) => void;
  onPortChange: (value: string) => void;
  onEnvVarsChange: (value: string) => void;
  registryUrl?: string;
  registryUsername?: string;
  registryPassword?: string;
  onRegistryUrlChange?: (value: string) => void;
  onRegistryUsernameChange?: (value: string) => void;
  onRegistryPasswordChange?: (value: string) => void;
}

export default function SimpleContainerConfig({
  image,
  port,
  envVars,
  onImageChange,
  onPortChange,
  onEnvVarsChange,
  registryUrl = '',
  registryUsername = '',
  registryPassword = '',
  onRegistryUrlChange,
  onRegistryUsernameChange,
  onRegistryPasswordChange,
}: SimpleContainerConfigProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [usePrivateRegistry, setUsePrivateRegistry] = useState(
    !!(registryUsername || registryPassword)
  );
  return (
    <div className="space-y-6">
      {/* Docker Image */}
      <div>
        <label htmlFor="containerImage" className="block text-sm font-medium text-gray-700 mb-2">
          Docker Image <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="containerImage"
          value={image}
          onChange={(e) => onImageChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
          placeholder="nginx:latest, node:18-alpine, ghcr.io/user/app:latest"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Docker Hub image or your private registry image
        </p>
      </div>

      {/* Private Registry Toggle */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-gray-600" />
            <label htmlFor="privateRegistry" className="text-sm font-medium text-gray-700">
              Use Private Registry
            </label>
          </div>
          <button
            type="button"
            onClick={() => setUsePrivateRegistry(!usePrivateRegistry)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              usePrivateRegistry ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                usePrivateRegistry ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        {usePrivateRegistry && (
          <div className="space-y-3 mt-4">
            {/* Registry URL */}
            <div>
              <label htmlFor="registryUrl" className="block text-xs font-medium text-gray-600 mb-1">
                Registry URL (optional)
              </label>
              <input
                type="text"
                id="registryUrl"
                value={registryUrl}
                onChange={(e) => onRegistryUrlChange?.(e.target.value)}
                className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                placeholder="ghcr.io, docker.io, registry.gitlab.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave empty for Docker Hub
              </p>
            </div>

            {/* Registry Username */}
            <div>
              <label htmlFor="registryUsername" className="block text-xs font-medium text-gray-600 mb-1">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="registryUsername"
                value={registryUsername}
                onChange={(e) => onRegistryUsernameChange?.(e.target.value)}
                className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                placeholder="your-username"
                required={usePrivateRegistry}
              />
            </div>

            {/* Registry Password */}
            <div>
              <label htmlFor="registryPassword" className="block text-xs font-medium text-gray-600 mb-1">
                Password / Token <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="registryPassword"
                  value={registryPassword}
                  onChange={(e) => onRegistryPasswordChange?.(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 py-1.5 px-2 pr-10 text-sm"
                  placeholder="Personal access token or password"
                  required={usePrivateRegistry}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                For GitHub use a Personal Access Token, not your password
              </p>
            </div>

            {/* Registry Examples */}
            <div className="bg-blue-50 rounded p-2 text-xs text-blue-700">
              <p className="font-semibold mb-1">Common Registries:</p>
              <p>• <span className="font-mono">ghcr.io</span> - GitHub Container Registry</p>
              <p>• <span className="font-mono">docker.io</span> - Docker Hub (default)</p>
              <p>• <span className="font-mono">gcr.io</span> - Google Container Registry</p>
              <p>• <span className="font-mono">*.amazonaws.com</span> - AWS ECR</p>
            </div>
          </div>
        )}
      </div>

      {/* Container Port */}
      <div>
        <label htmlFor="containerPort" className="block text-sm font-medium text-gray-700 mb-2">
          Container Port <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="containerPort"
          value={port}
          onChange={(e) => onPortChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
          placeholder="80, 3000, 8080"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          The port your application listens on inside the container
        </p>
      </div>


      {/* Environment Variables */}
      <div>
        <label htmlFor="envVars" className="block text-sm font-medium text-gray-700 mb-2">
          Environment Variables (optional)
        </label>
        <textarea
          id="envVars"
          value={envVars}
          onChange={(e) => onEnvVarsChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm font-mono"
          rows={4}
          placeholder="NODE_ENV=production&#10;DATABASE_URL=postgres://...&#10;API_KEY=your-key"
        />
        <p className="mt-1 text-xs text-gray-500">
          One per line in KEY=value format
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start">
          <Package className="h-5 w-5 text-purple-600 mt-0.5" />
          <div className="ml-3">
            <h4 className="text-sm font-medium text-purple-900">Simple Container Deployment</h4>
            <p className="text-sm text-purple-700 mt-1">
              Perfect for single container applications like APIs, web servers, or microservices.
              Your container will be deployed with automatic health checks and SSL termination.
            </p>
            <div className="mt-2 text-xs text-purple-600">
              <p>• Automatic HTTPS/SSL</p>
              <p>• Health monitoring</p>
              <p>• Auto-restart on failure</p>
              <p>• Rolling updates</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="ml-2 text-sm text-blue-700">
            <p className="font-medium">Need more?</p>
            <p className="text-xs mt-1">
              For multiple containers, databases, volumes, and networks, use the Advanced mode
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}