/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { ContainerTerminal } from './ContainerTerminal';
import { SpinForgeContainer } from './ContainerSlideoutPanel';
import { AlertTriangle } from 'lucide-react';

interface ContainerExecTabProps {
  container: SpinForgeContainer;
}

export function ContainerExecTab({ container }: ContainerExecTabProps) {
  // Determine if container is actually running
  const isRunning = (() => {
    if (container.enabled === false) return false;
    if (container.containerStats?.error) return false;
    if (container.containerStats?.state?.status) {
      return container.containerStats.state.status === 'running';
    }
    // Check if container has Docker stats (CPU, Memory, etc.) which indicates it's running
    if (container.containerStats && 
        (container.containerStats.CPUPerc || container.containerStats.MemUsage || container.containerStats.NetIO)) {
      return true;
    }
    return false;
  })();

  if (!isRunning) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Container Not Running</h3>
          <p className="text-sm">Cannot execute commands in a stopped container.</p>
          <p className="text-sm mt-1">Start the container first to use the terminal.</p>
        </div>
      </div>
    );
  }

  return <ContainerTerminal container={container} />;
}