/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { Play, Square, RotateCw, Trash2, Terminal, Copy, Clock, Network, LinkIcon, Cpu, MemoryStick, Upload } from 'lucide-react';
import { SpinForgeContainer } from './ContainerSlideoutPanel';

interface ContainerRowProps {
  container: SpinForgeContainer;
  onAction: (id: string, action: string) => void;
  onSelect: (container: SpinForgeContainer) => void;
  onViewLogs: (container: SpinForgeContainer) => void;
  tableView?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function ContainerRow({ 
  container, 
  onAction, 
  onSelect, 
  onViewLogs, 
  tableView = false 
}: ContainerRowProps) {
  // Parse Docker stats
  const parseDockerStats = (stats: any) => {
    if (!stats || stats.error) return { cpu: 0, memory: 0, networkTx: 0, status: 'stopped' };
    
    const cpu = stats.CPUPerc ? parseFloat(stats.CPUPerc.replace('%', '')) : 0;
    
    let memory = 0;
    if (stats.MemUsage) {
      const memParts = stats.MemUsage.split(' / ');
      memory = parseMemoryString(memParts[0]) || 0;
    }
    
    let networkTx = 0;
    if (stats.NetIO) {
      const netParts = stats.NetIO.split(' / ');
      networkTx = parseMemoryString(netParts[1]) || 0;
    }
    
    return { cpu, memory, networkTx, status: 'running' };
  };
  
  const parseMemoryString = (memStr: string): number => {
    if (!memStr) return 0;
    const units: { [key: string]: number } = {
      'B': 1, 'KB': 1024, 'MB': 1024 * 1024, 'GB': 1024 * 1024 * 1024,
      'KIB': 1024, 'MIB': 1024 * 1024, 'GIB': 1024 * 1024 * 1024
    };
    const match = memStr.match(/^([\d.]+)\s*([A-Z]+)$/i);
    if (!match) return 0;
    return parseFloat(match[1]) * (units[match[2].toUpperCase()] || 1);
  };
  
  const { cpu, memory, networkTx, status: dockerStatus } = parseDockerStats(container.containerStats);
  
  // Determine container status
  const status = (() => {
    if (container.enabled === false) return 'stopped';
    if (container.containerStats?.error) return 'stopped';
    if (container.containerStats?.state?.status) {
      return container.containerStats.state.status;
    }
    // Check if container has Docker stats (CPU, Memory, etc.) which indicates it's running
    if (container.containerStats && 
        (container.containerStats.CPUPerc || container.containerStats.MemUsage || container.containerStats.NetIO)) {
      return 'running';
    }
    // If no stats or error, it's stopped
    return 'stopped';
  })();
  
  const StatusIcon = status === 'running' ? Play : Square;
  const statusColor = status === 'running' ? 'text-green-600' : 'text-red-600';
  const statusBg = status === 'running' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

  if (tableView) {
    return (
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <StatusIcon className={`h-5 w-5 ${statusColor}`} />
            <span className="ml-2 text-sm text-gray-900 capitalize">{status}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900">{container.domain}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-500 font-mono">{container.id?.substring(0, 12) || '-'}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-500">
            {container.containerConfig?.image || container.containerStats?.image || '-'}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {cpu.toFixed(1)}%
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {formatBytes(memory)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onSelect(container)}
              className="text-blue-600 hover:text-blue-900"
              title="View Details"
            >
              Details
            </button>
            <button
              onClick={() => onViewLogs(container)}
              className="text-gray-600 hover:text-gray-900"
              title="View Logs"
            >
              <Terminal className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <StatusIcon className={`h-5 w-5 ${statusColor}`} />
          
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <h4 className="text-sm font-medium text-gray-900">{container.domain}</h4>
              {container.containerStats?.containerName && (
                <span className="text-xs text-gray-500">{container.containerStats.containerName}</span>
              )}
              <span className="text-xs text-gray-500 font-mono">
                {container.containerStats?.containerId?.substring(0, 12) || container.id}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(container.containerStats?.containerId || container.id || '')}
                className="text-gray-400 hover:text-gray-600"
                title="Copy full ID"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            
            <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
              <span className="flex items-center">
                <LinkIcon className="h-3 w-3 mr-1" />
                {container.containerConfig?.image || container.containerStats?.image || '-'}
              </span>
              {(container.containerStats?.ports?.length || 0) > 0 && (
                <span className="flex items-center">
                  <Network className="h-3 w-3 mr-1" />
                  {container.containerStats?.ports?.map((p: any) => 
                    p.hostPort ? `${p.hostPort}:${p.containerPort}` : p.containerPort
                  ).join(', ')}
                </span>
              )}
              {container.containerStats?.state?.startedAt && (
                <span className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatUptime(container.containerStats.state.startedAt)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4 text-sm">
            <div className="text-right">
              <div className="text-gray-900 font-medium">
                {cpu.toFixed(1)}%
              </div>
              <div className="text-gray-500">CPU</div>
            </div>
            <div className="text-right">
              <div className="text-gray-900 font-medium">
                {formatBytes(memory)}
              </div>
              <div className="text-gray-500">Memory</div>
            </div>
            <div className="text-right">
              <div className="text-gray-900 font-medium">
                {formatBytes(networkTx)}
              </div>
              <div className="text-gray-500">Network</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBg}`}>
              {status.toUpperCase()}
            </span>
            
            <button
              onClick={() => onSelect(container)}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            >
              Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}