/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { Cpu, MemoryStick, Network, Upload } from 'lucide-react';
import { SpinForgeContainer } from './ContainerSlideoutPanel';

interface ContainerSummaryTabProps {
  container: SpinForgeContainer;
  onAction: (id: string, action: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function ContainerSummaryTab({ container }: ContainerSummaryTabProps) {
  // Parse Docker stats - handle multiple possible formats
  const parseDockerStats = (stats: any) => {
    if (!stats) return { cpu: 0, memory: 0, memoryLimit: 0, networkRx: 0, networkTx: 0 };
    
    console.log('Parsing stats:', stats);
    
    // Handle different Docker stats formats
    let cpu = 0;
    let memory = 0;
    let memoryLimit = 0;
    let networkRx = 0;
    let networkTx = 0;
    
    // Try different field name patterns
    if (stats.CPUPerc) {
      cpu = parseFloat(stats.CPUPerc.replace('%', ''));
    } else if (stats.cpu_percent) {
      cpu = stats.cpu_percent;
    } else if (stats.cpuUsage) {
      cpu = stats.cpuUsage;
    }
    
    if (stats.MemUsage) {
      // Format like "337.9MiB / 7.653GiB"
      const memParts = stats.MemUsage.split(' / ');
      memory = parseMemoryString(memParts[0]) || 0;
      memoryLimit = parseMemoryString(memParts[1]) || 0;
    } else if (stats.memory_usage && stats.memory_limit) {
      memory = stats.memory_usage;
      memoryLimit = stats.memory_limit;
    } else if (stats.memoryUsage) {
      memory = stats.memoryUsage;
    }
    
    if (stats.NetIO) {
      // Format like "22MB / 38.6MB"
      const netParts = stats.NetIO.split(' / ');
      networkRx = parseMemoryString(netParts[0]) || 0;
      networkTx = parseMemoryString(netParts[1]) || 0;
    } else if (stats.networkRx && stats.networkTx) {
      networkRx = stats.networkRx;
      networkTx = stats.networkTx;
    }
    
    return { cpu, memory, memoryLimit, networkRx, networkTx };
  };
  
  const parseMemoryString = (memStr: string): number => {
    if (!memStr) return 0;
    
    const units: { [key: string]: number } = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024,
      'KIB': 1024,
      'MIB': 1024 * 1024,
      'GIB': 1024 * 1024 * 1024,
      'TIB': 1024 * 1024 * 1024 * 1024
    };
    
    const match = memStr.match(/^([\d.]+)\s*([A-Z]+)$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    return value * (units[unit] || 1);
  };
  
  // Parse Docker stats first to determine real status
  const { cpu, memory, memoryLimit, networkRx, networkTx } = parseDockerStats(container.containerStats);
  
  // Determine container status based on actual data availability
  const status = (() => {
    if (container.enabled === false) return 'stopped';
    
    // If stats API returned an error, container is stopped
    if (container.containerStats?.error) {
      console.log(`Container ${container.domain} detected as STOPPED (API error: ${container.containerStats.error})`);
      return 'stopped';
    }
    
    // If we have fresh container stats with actual data, it's running
    if (container.containerStats) {
      // Check for specific status field
      if (container.containerStats.state?.status) {
        return container.containerStats.state.status;
      }
      
      // If we have any stats data (CPU, memory, network), container is running
      if (container.containerStats.CPUPerc || 
          container.containerStats.MemUsage || 
          container.containerStats.NetIO ||
          cpu > 0 || memory > 0 || networkRx > 0 || networkTx > 0) {
        console.log(`Container ${container.domain} detected as RUNNING (has stats: CPU=${container.containerStats.CPUPerc}, Mem=${container.containerStats.MemUsage}, Net=${container.containerStats.NetIO})`);
        return 'running';
      }
      
      // If stats API returns empty/null data, container might be stopped
      if (container.containerStats === null || 
          (typeof container.containerStats === 'object' && Object.keys(container.containerStats).length === 0)) {
        console.log(`Container ${container.domain} detected as STOPPED (no stats data)`);
        return 'stopped';
      }
    }
    
    // Fall back to SpinForge enabled flag
    const fallbackStatus = container.enabled === true ? 'running' : 'stopped';
    console.log(`Container ${container.domain} using fallback status: ${fallbackStatus}`);
    return fallbackStatus;
  })();

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">CPU Usage</p>
                <p className="text-2xl font-bold text-blue-900">
                  {cpu.toFixed(1)}%
                </p>
              </div>
              <Cpu className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-green-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Memory</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatBytes(memory)}
                  {memoryLimit > 0 && (
                    <span className="text-sm text-gray-600"> / {formatBytes(memoryLimit)}</span>
                  )}
                </p>
              </div>
              <MemoryStick className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Network RX</p>
                <p className="text-2xl font-bold text-purple-900">
                  {formatBytes(networkRx)}
                </p>
              </div>
              <Network className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-orange-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Network TX</p>
                <p className="text-2xl font-bold text-orange-900">
                  {formatBytes(networkTx)}
                </p>
              </div>
              <Upload className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Container Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Basic Info */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Container Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Image:</span>
                <span className="text-sm font-mono text-gray-900">
                  {container.containerConfig?.image || container.containerStats?.image || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status:</span>
                <span className={`text-sm font-medium ${
                  status === 'running' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Created:</span>
                <span className="text-sm text-gray-900">
                  {container.created_at ? new Date(container.created_at).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Type:</span>
                <span className="text-sm text-gray-900">{container.type}</span>
              </div>
            </div>
          </div>

          {/* Port Mappings */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Port Mappings</h3>
            <div className="space-y-2">
              {(container.containerStats?.ports?.length || 0) > 0 ? (
                container.containerStats?.ports?.map((port: any, index: number) => (
                  <div key={index} className="flex justify-between py-2 px-3 bg-white rounded border">
                    <span className="text-sm font-mono">{port.hostPort}:{port.containerPort}</span>
                    <span className="text-sm text-gray-500">{port.type || 'tcp'}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No port mappings</p>
              )}
            </div>
          </div>
        </div>

        {/* Environment Variables */}
        {container.containerConfig?.env && container.containerConfig.env.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Environment Variables</h3>
            <div className="space-y-2">
              {container.containerConfig.env.map((env: any, index: number) => (
                <div key={index} className="flex justify-between py-2 px-3 bg-white rounded border">
                  <span className="text-sm font-mono font-medium">{env.key}</span>
                  <span className="text-sm text-gray-900 font-mono">{env.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}