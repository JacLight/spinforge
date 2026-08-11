/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import SimpleContainerConfig from './SimpleContainerConfig';

interface ContainerDeploymentConfigProps {
  // Simple mode
  image: string;
  port: string;
  envVars: string;
  
  // Private registry
  registryUrl?: string;
  registryUsername?: string;
  registryPassword?: string;
  
  // Advanced mode
  composeYaml: string;
  
  // Handlers
  onImageChange: (value: string) => void;
  onPortChange: (value: string) => void;
  onEnvVarsChange: (value: string) => void;
  onComposeYamlChange: (value: string) => void;
  onRegistryUrlChange?: (value: string) => void;
  onRegistryUsernameChange?: (value: string) => void;
  onRegistryPasswordChange?: (value: string) => void;
}

export default function ContainerDeploymentConfig({
  image,
  port,
  envVars,
  registryUrl,
  registryUsername,
  registryPassword,
  composeYaml,
  onImageChange,
  onPortChange,
  onEnvVarsChange,
  onComposeYamlChange,
  onRegistryUrlChange,
  onRegistryUsernameChange,
  onRegistryPasswordChange,
}: ContainerDeploymentConfigProps) {
  return (
    <div className="space-y-6">
      {/* Simple Container Configuration */}
      <SimpleContainerConfig
          image={image}
          port={port}
          envVars={envVars}
          registryUrl={registryUrl}
          registryUsername={registryUsername}
          registryPassword={registryPassword}
          onImageChange={onImageChange}
          onPortChange={onPortChange}
          onEnvVarsChange={onEnvVarsChange}
          onRegistryUrlChange={onRegistryUrlChange}
          onRegistryUsernameChange={onRegistryUsernameChange}
          onRegistryPasswordChange={onRegistryPasswordChange}
        />
    </div>
  );
}