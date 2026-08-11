/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Container, Terminal, Play, FolderOpen } from 'lucide-react';
import { hostingAPI, VHost } from '../../services/hosting-api';
import { ContainerSummaryTab } from './ContainerSummaryTab';
import { ContainerLogsTab } from './ContainerLogsTab';
import { ContainerExecTab } from './ContainerExecTab';
import { ContainerFilesTab } from './ContainerFilesTab';

export interface SpinForgeContainer extends VHost {
  containerStats?: any;
}

interface ContainerSlideoutPanelProps {
  container: SpinForgeContainer | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (id: string, action: string) => void;
}

export function ContainerSlideoutPanel({ 
  container, 
  isOpen,
  onClose, 
  onAction
}: ContainerSlideoutPanelProps) {
  // Early return MUST be before any hooks
  if (!container) return null;
  
  const [activeTab, setActiveTab] = useState<'summary' | 'logs' | 'exec' | 'files'>('summary');
  const [containerWithStats, setContainerWithStats] = useState<SpinForgeContainer>(container);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  // Fetch real-time container stats when panel opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchContainerStats = async () => {
      setIsLoadingStats(true);
      try {
        const stats = await hostingAPI.getContainerStats(container.domain);
        console.log('Raw container stats for', container.domain, ':', stats);
        setContainerWithStats({
          ...container,
          containerStats: stats
        });
      } catch (error) {
        console.error('Failed to fetch container stats:', error);
        // Keep using existing data if stats fetch fails
        setContainerWithStats(container);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchContainerStats();
    
    // Set up periodic refresh for real-time stats
    const interval = setInterval(fetchContainerStats, 5000);
    
    return () => clearInterval(interval);
  }, [container, isOpen]);
  
  // Determine container status based on actual stats data availability
  const status = (() => {
    if (containerWithStats.enabled === false) return 'stopped';
    
    // If stats API returned an error, container is stopped
    if (containerWithStats.containerStats?.error) {
      console.log(`Container ${containerWithStats.domain} detected as STOPPED (API error: ${containerWithStats.containerStats.error})`);
      return 'stopped';
    }
    
    // If we have fresh container stats with actual data, it's running
    if (containerWithStats.containerStats) {
      // Check for specific status field
      if (containerWithStats.containerStats.state?.status) {
        return containerWithStats.containerStats.state.status;
      }
      
      // If we have any stats data (CPU, memory, network), container is running
      if (containerWithStats.containerStats.CPUPerc || 
          containerWithStats.containerStats.MemUsage || 
          containerWithStats.containerStats.NetIO) {
        console.log(`Container ${containerWithStats.domain} detected as RUNNING (has stats: CPU=${containerWithStats.containerStats.CPUPerc}, Mem=${containerWithStats.containerStats.MemUsage}, Net=${containerWithStats.containerStats.NetIO})`);
        return 'running';
      }
      
      // If stats API returns empty/null data, container might be stopped
      if (containerWithStats.containerStats === null || 
          (typeof containerWithStats.containerStats === 'object' && Object.keys(containerWithStats.containerStats).length === 0)) {
        console.log(`Container ${containerWithStats.domain} detected as STOPPED (no stats data)`);
        return 'stopped';
      }
    }
    
    // Fall back to SpinForge enabled flag
    const fallbackStatus = containerWithStats.enabled === true ? 'running' : 'stopped';
    console.log(`Container ${containerWithStats.domain} using fallback status: ${fallbackStatus}`);
    return fallbackStatus;
  })();

  // Determine if container is running for exec tab
  const isContainerRunning = (() => {
    if (containerWithStats.enabled === false) return false;
    if (containerWithStats.containerStats?.error) return false;
    if (containerWithStats.containerStats?.state?.status) {
      return containerWithStats.containerStats.state.status === 'running';
    }
    // Check if container has Docker stats (CPU, Memory, etc.) which indicates it's running
    if (containerWithStats.containerStats && 
        (containerWithStats.containerStats.CPUPerc || containerWithStats.containerStats.MemUsage || containerWithStats.containerStats.NetIO)) {
      return true;
    }
    return false;
  })();

  const tabs = [
    { id: 'summary', label: 'Summary', icon: Container },
    { id: 'logs', label: 'Logs', icon: Terminal },
    { id: 'exec', label: 'Exec', icon: Play, disabled: !isContainerRunning },
    { id: 'files', label: 'Files', icon: FolderOpen }
  ] as const;

  // Switch away from exec tab if container becomes stopped
  React.useEffect(() => {
    if (activeTab === 'exec' && !isContainerRunning) {
      setActiveTab('summary');
    }
  }, [isContainerRunning, activeTab]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Slide-out Panel */}
          <motion.div
            className="fixed top-0 right-0 h-full w-2/3 max-w-4xl bg-white shadow-2xl z-[61] flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-3">
                    <div className={`h-3 w-3 rounded-full ${status === 'running' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <h2 className="text-2xl font-bold text-gray-900">{containerWithStats.domain}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      status === 'running' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {status.toUpperCase()}
                    </span>
                    {isLoadingStats && (
                      <span className="px-2 py-1 text-xs text-gray-500">
                        Updating...
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500 font-mono">{containerWithStats.id}</p>
                </div>
                
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b bg-gray-50">
              <div className="flex space-x-8 px-8">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isDisabled = 'disabled' in tab && tab.disabled;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => !isDisabled && setActiveTab(tab.id)}
                      disabled={isDisabled}
                      className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                        isDisabled
                          ? 'border-transparent text-gray-300 cursor-not-allowed opacity-50'
                          : activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                      {isDisabled && <span className="text-xs">(stopped)</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'summary' && (
                <ContainerSummaryTab container={containerWithStats} onAction={onAction} />
              )}
              {activeTab === 'logs' && (
                <ContainerLogsTab container={containerWithStats} />
              )}
              {activeTab === 'exec' && (
                <ContainerExecTab container={containerWithStats} />
              )}
              {activeTab === 'files' && (
                <ContainerFilesTab container={containerWithStats} />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}