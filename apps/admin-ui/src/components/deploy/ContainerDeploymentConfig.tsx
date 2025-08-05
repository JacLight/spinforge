/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState } from 'react';
import { Package, Layers } from 'lucide-react';
import SimpleContainerConfig from './SimpleContainerConfig';
import AdvancedContainerConfig from './AdvancedContainerConfig';

interface ContainerDeploymentConfigProps {
  // Simple mode
  image: string;
  port: string;
  envVars: string;
  
  // Advanced mode
  composeYaml: string;
  
  // Handlers
  onImageChange: (value: string) => void;
  onPortChange: (value: string) => void;
  onEnvVarsChange: (value: string) => void;
  onComposeYamlChange: (value: string) => void;
}

export default function ContainerDeploymentConfig({
  image,
  port,
  envVars,
  composeYaml,
  onImageChange,
  onPortChange,
  onEnvVarsChange,
  onComposeYamlChange,
}: ContainerDeploymentConfigProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => setMode('simple')}
          className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${
            mode === 'simple'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Package className="h-6 w-6" />
          <div className="text-left">
            <h4 className="font-medium">Simple</h4>
            <p className="text-sm opacity-80">Single container deployment</p>
          </div>
        </button>

        <button
          type="button"
          disabled
          className="flex-1 flex items-center justify-center gap-3 p-4 rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
        >
          <Layers className="h-6 w-6" />
          <div className="text-left">
            <h4 className="font-medium">Advanced</h4>
            <p className="text-sm opacity-80">Coming Soon</p>
          </div>
        </button>
      </div>

      {/* Configuration based on mode */}
      {mode === 'simple' ? (
        <SimpleContainerConfig
          image={image}
          port={port}
          envVars={envVars}
          onImageChange={onImageChange}
          onPortChange={onPortChange}
          onEnvVarsChange={onEnvVarsChange}
        />
      ) : (
        <AdvancedContainerConfig
          composeYaml={composeYaml}
          onComposeYamlChange={onComposeYamlChange}
        />
      )}
    </div>
  );
}