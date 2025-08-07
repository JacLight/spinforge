/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { Package, AlertCircle } from 'lucide-react';

interface SimpleContainerConfigProps {
  image: string;
  port: string;
  envVars: string;
  onImageChange: (value: string) => void;
  onPortChange: (value: string) => void;
  onEnvVarsChange: (value: string) => void;
}

export default function SimpleContainerConfig({
  image,
  port,
  envVars,
  onImageChange,
  onPortChange,
  onEnvVarsChange,
}: SimpleContainerConfigProps) {
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
          placeholder="nginx:latest, node:18-alpine, wordpress:latest"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Docker Hub image or your private registry image
        </p>
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