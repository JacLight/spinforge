/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hostingAPI, VHost } from '@/services/customer-api';
import { toast } from 'sonner';
import { 
  RefreshCw,
  Grid3X3,
  LayoutDashboard,
  ChevronRight,
  ChevronDown,
  Container,
  Layers,
  Search,
  CheckCircle,
  XCircle,
  Package,
  Terminal,
  Plus,
  Eye,
  Trash2,
  Play,
  Square,
  RotateCw,
  Activity,
  HardDrive,
  Network,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import axios from 'axios';

interface SpinForgeContainer extends VHost {
  containerStats?: {
    Container?: string;
    Name?: string;
    ID?: string;
    CPUPerc?: string;
    MemUsage?: string;
    MemPerc?: string;
    NetIO?: string;
    BlockIO?: string;
    PIDs?: string;
    status?: string;
    error?: string;
  };
}

interface ContainerGroup {
  name: string;
  customerId: string;
  containers: SpinForgeContainer[];
  isCompose: boolean;
  totalCpu: number;
  totalMemory: number;
  totalMemoryLimit: number;
  totalNetworkRx: number;
  totalNetworkTx: number;
  status: 'all-running' | 'all-stopped' | 'partial-running' | 'mixed';
}

function groupSpinForgeContainers(containers: SpinForgeContainer[]): ContainerGroup[] {
  const groups = new Map<string, ContainerGroup>();
  
  containers.forEach(container => {
    const groupKey = container.type === 'compose' ? container.domain : `single-${container.domain}`;
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        name: container.domain,
        customerId: container.customer || 'default',
        containers: [],
        isCompose: container.type === 'compose',
        totalCpu: 0,
        totalMemory: 0,
        totalMemoryLimit: 0,
        totalNetworkRx: 0,
        totalNetworkTx: 0,
        status: 'all-stopped'
      });
    }
    
    const group = groups.get(groupKey)!;
    group.containers.push(container);
    
    // Update stats
    if (container.containerStats && !container.containerStats.error) {
      const cpuPerc = parseFloat(container.containerStats.CPUPerc?.replace('%', '') || '0');
      group.totalCpu += cpuPerc;
      
      if (container.containerStats.MemUsage) {
        const memParts = container.containerStats.MemUsage.split(' / ');
        if (memParts.length === 2) {
          group.totalMemory += parseMemoryValue(memParts[0]);
          group.totalMemoryLimit += parseMemoryValue(memParts[1]);
        }
      }
      
      if (container.containerStats.NetIO) {
        const netParts = container.containerStats.NetIO.split(' / ');
        if (netParts.length === 2) {
          group.totalNetworkRx += parseMemoryValue(netParts[0]);
          group.totalNetworkTx += parseMemoryValue(netParts[1]);
        }
      }
    }
  });
  
  // Update group status
  groups.forEach(group => {
    const runningCount = group.containers.filter(c => 
      c.containerStats && c.containerStats.status !== 'stopped' && !c.containerStats.error
    ).length;
    
    if (runningCount === 0) {
      group.status = 'all-stopped';
    } else if (runningCount === group.containers.length) {
      group.status = 'all-running';
    } else {
      group.status = 'partial-running';
    }
  });
  
  return Array.from(groups.values());
}

function parseMemoryValue(value: string): number {
  const match = value.match(/^([\d.]+)([KMGT]i?B)?$/);
  if (!match) return 0;
  
  const num = parseFloat(match[1]);
  const unit = match[2] || 'B';
  
  const multipliers: { [key: string]: number } = {
    'B': 1,
    'KB': 1024,
    'KiB': 1024,
    'MB': 1024 * 1024,
    'MiB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'GiB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
    'TiB': 1024 * 1024 * 1024 * 1024,
  };
  
  return num * (multipliers[unit] || 1);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function filterGroups(groups: ContainerGroup[], searchTerm: string, showOnlyRunning: boolean): ContainerGroup[] {
  return groups.filter(group => {
    if (showOnlyRunning && group.status === 'all-stopped') return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return group.name.toLowerCase().includes(search) ||
             group.containers.some(c => c.domain.toLowerCase().includes(search));
    }
    return true;
  });
}

export default function SpinLetsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyRunning, setShowOnlyRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [selectedContainer, setSelectedContainer] = useState<SpinForgeContainer | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch SpinForge containers (VHosts of type container or compose)
  const { data: vhosts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['spinforge-containers', user?.customerId],
    queryFn: async (): Promise<SpinForgeContainer[]> => {
      try {
        // Get all VHosts from customer API
        const allVhosts = await hostingAPI.listVHosts();
        
        // Filter for container and compose types
        const containerVhosts = allVhosts.filter((v: VHost) => 
          v.type === 'container' || v.type === 'compose'
        );
        
        // Get container stats if available
        try {
          const statsResponse = await axios.get('/api/containers/stats');
          const allStats = statsResponse.data;
          
          // Match stats to containers by name pattern
          const containersWithStats = containerVhosts.map((vhost: VHost) => {
            const containerName = `spinforge-${vhost.domain.replace(/\./g, '-')}`;
            const stats = allStats.find((s: any) => 
              s.Name === containerName || s.Container === containerName
            );
            
            if (!stats) {
              // No stats found = container is stopped
              return { 
                ...vhost, 
                containerStats: { 
                  error: 'Container not running', 
                  status: 'stopped' 
                } 
              } as SpinForgeContainer;
            }
            
            return { ...vhost, containerStats: stats } as SpinForgeContainer;
          });
          
          return containersWithStats;
        } catch (statsError) {
          // If stats fail, just return vhosts without stats
          return containerVhosts.map((v: VHost) => ({
            ...v,
            containerStats: { error: 'Stats unavailable', status: 'unknown' }
          } as SpinForgeContainer));
        }
      } catch (error) {
        console.error('Failed to fetch SpinForge containers:', error);
        return [];
      }
    },
    enabled: !!user?.customerId,
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Group containers by customer or compose project
  const containerGroups = groupSpinForgeContainers(vhosts);

  // Filter containers based on search and status
  const filteredGroups = filterGroups(containerGroups, searchTerm, showOnlyRunning);

  // Container actions
  const actionMutation = useMutation({
    mutationFn: async ({ domain, action }: { domain: string; action: string }) => {
      const vhost = vhosts.find(v => v.domain === domain);
      if (!vhost) throw new Error('SpinLet not found');
      
      switch (action) {
        case 'start':
          return hostingAPI.updateVHost(domain, { enabled: true } as VHost);
        case 'stop':
          return hostingAPI.updateVHost(domain, { enabled: false } as VHost);
        case 'restart':
          // Stop then start
          await hostingAPI.updateVHost(domain, { enabled: false } as VHost);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return hostingAPI.updateVHost(domain, { enabled: true } as VHost);
        case 'remove':
          return hostingAPI.deleteVHost(domain);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: (_, { action }) => {
      toast.success(`SpinLet ${action} completed successfully`);
      queryClient.invalidateQueries({ queryKey: ['spinforge-containers'] });
    },
    onError: (error: any, { action }) => {
      toast.error(`Failed to ${action} SpinLet: ${error.message}`);
    },
  });

  const handleContainerAction = (id: string, action: string) => {
    actionMutation.mutate({ domain: id, action });
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'all-running':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'all-stopped':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'partial-running':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      'all-running': { bg: 'bg-green-50', text: 'text-green-700', label: 'Running' },
      'all-stopped': { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Stopped' },
      'partial-running': { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Partial' },
      'mixed': { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Mixed' },
    }[status] || { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Unknown' };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-8">
          <div className="flex items-center">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
            <span className="ml-3 text-gray-600">Loading SpinLets...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Container className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    SpinLets
                  </h1>
                  <p className="text-sm text-gray-500">Manage your containerized applications</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-xl px-3 py-1.5">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="autoRefresh" className="text-sm text-gray-700">
                  Auto-refresh
                </label>
              </div>
              
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-white/80 border border-gray-200 text-gray-700 rounded-xl hover:bg-white transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Refresh</span>
              </button>
              
              <Link
                href="/dashboard/deploy"
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Deploy SpinLet</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Content */}
      <div className="px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search SpinLets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowOnlyRunning(!showOnlyRunning)}
                className={`px-4 py-2 rounded-xl transition-all duration-200 ${
                  showOnlyRunning 
                    ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                    : 'bg-white/80 text-gray-700 border border-gray-200'
                }`}
              >
                <Activity className="h-4 w-4 inline mr-2" />
                Running Only
              </button>
              
              <button
                onClick={() => setViewMode(viewMode === 'grouped' ? 'flat' : 'grouped')}
                className="px-4 py-2 bg-white/80 text-gray-700 border border-gray-200 rounded-xl hover:bg-white transition-colors"
              >
                {viewMode === 'grouped' ? (
                  <>
                    <Layers className="h-4 w-4 inline mr-2" />
                    Grouped
                  </>
                ) : (
                  <>
                    <Grid3X3 className="h-4 w-4 inline mr-2" />
                    Flat
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Container Groups */}
          {filteredGroups.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-12">
              <div className="text-center">
                <Container className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No SpinLets found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm 
                    ? "Try adjusting your search or filters"
                    : "Deploy your first SpinLet to get started"}
                </p>
                {!searchTerm && (
                  <Link
                    href="/dashboard/deploy"
                    className="mt-4 inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Deploy Your First SpinLet
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map(group => (
                <motion.div
                  key={group.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden"
                >
                  {/* Group Header */}
                  <div
                    onClick={() => toggleGroup(group.name)}
                    className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-white/90 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <button className="p-1">
                        {expandedGroups.has(group.name) ? (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        )}
                      </button>
                      
                      <div className="flex items-center space-x-3">
                        {group.isCompose ? (
                          <Layers className="h-5 w-5 text-purple-600" />
                        ) : (
                          <Container className="h-5 w-5 text-blue-600" />
                        )}
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{group.name}</h3>
                          <p className="text-xs text-gray-500">
                            {group.containers.length} container{group.containers.length !== 1 ? 's' : ''}
                            {group.isCompose && ' (Compose Stack)'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      {/* Resource Stats */}
                      {group.status !== 'all-stopped' && (
                        <>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">CPU:</span> {group.totalCpu.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Memory:</span> {formatBytes(group.totalMemory)} / {formatBytes(group.totalMemoryLimit)}
                          </div>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Network:</span> ↓{formatBytes(group.totalNetworkRx)} ↑{formatBytes(group.totalNetworkTx)}
                          </div>
                        </>
                      )}
                      
                      {getStatusBadge(group.status)}
                      
                      {/* Quick Actions */}
                      <div className="flex items-center space-x-2">
                        {group.status === 'all-stopped' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              group.containers.forEach(c => handleContainerAction(c.domain, 'start'));
                            }}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Start all"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              group.containers.forEach(c => handleContainerAction(c.domain, 'stop'));
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Stop all"
                          >
                            <Square className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            group.containers.forEach(c => handleContainerAction(c.domain, 'restart'));
                          }}
                          className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                          title="Restart all"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Container List */}
                  <AnimatePresence>
                    {expandedGroups.has(group.name) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-gray-200"
                      >
                        {group.containers.map(container => (
                          <div
                            key={container.domain}
                            className="px-6 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-3">
                                  {container.containerStats && !container.containerStats.error ? (
                                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                                  ) : (
                                    <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{container.domain}</p>
                                    <p className="text-xs text-gray-500">
                                      {container.containerStats?.Container || container.containerStats?.Name || 'Container'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-4">
                                {/* Container Stats */}
                                {container.containerStats && !container.containerStats.error && (
                                  <>
                                    <div className="text-xs text-gray-600">
                                      <span className="font-medium">CPU:</span> {container.containerStats.CPUPerc || '0%'}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      <span className="font-medium">Mem:</span> {container.containerStats.MemUsage || 'N/A'}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      <span className="font-medium">PIDs:</span> {container.containerStats.PIDs || '0'}
                                    </div>
                                  </>
                                )}
                                
                                {/* Actions */}
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => router.push(`/dashboard/applications/${container.domain}`)}
                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedContainer(container);
                                      setShowLogs(true);
                                    }}
                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="View logs"
                                  >
                                    <Terminal className="h-4 w-4" />
                                  </button>
                                  {container.containerStats && !container.containerStats.error ? (
                                    <button
                                      onClick={() => handleContainerAction(container.domain, 'stop')}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Stop"
                                    >
                                      <Square className="h-4 w-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleContainerAction(container.domain, 'start')}
                                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                      title="Start"
                                    >
                                      <Play className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleContainerAction(container.domain, 'restart')}
                                    className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                                    title="Restart"
                                  >
                                    <RotateCw className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to remove SpinLet ${container.domain}?`)) {
                                        handleContainerAction(container.domain, 'remove');
                                      }
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}