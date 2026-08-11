/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hostingAPI, VHost } from '../services/hosting-api';
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
  Terminal
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ContainerSlideoutPanel, SpinForgeContainer } from '../components/containers/ContainerSlideoutPanel';
import { ContainerRow } from '../components/containers/ContainerRow';

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

export default function ActiveSpinlets() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyRunning, setShowOnlyRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [selectedContainer, setSelectedContainer] = useState<SpinForgeContainer | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // Fetch SpinForge containers (VHosts of type container or compose)
  const { data: vhosts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['spinforge-containers'],
    queryFn: async (): Promise<SpinForgeContainer[]> => {
      try {
        // Get all VHosts and all container stats in parallel
        const [allVhosts, allStats] = await Promise.all([
          hostingAPI.listVHosts(),
          hostingAPI.getAllContainerStats()
        ]);
        
        const containerVhosts = allVhosts.filter(v => v.type === 'container' || v.type === 'compose');
        
        // Match stats to containers by name pattern
        const containersWithStats = containerVhosts.map((vhost) => {
          const containerName = `spinforge-${vhost.domain.replace(/\./g, '-')}`;
          const stats = allStats.find(s => s.Name === containerName || s.Container === containerName);
          
          if (!stats) {
            // No stats found = container is stopped
            return { ...vhost, containerStats: { error: 'Container not running', status: 'stopped' } } as SpinForgeContainer;
          }
          
          return { ...vhost, containerStats: stats } as SpinForgeContainer;
        });
        
        return containersWithStats;
      } catch (error) {
        console.error('Failed to fetch SpinForge containers:', error);
        return [];
      }
    },
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
      if (!vhost) throw new Error('Container not found');
      
      switch (action) {
        case 'start':
        case 'stop':
        case 'restart':
          return hostingAPI.updateVHost(domain, { enabled: action === 'start' ? true : false });
        case 'remove':
          return hostingAPI.deleteVHost(domain);
        case 'logs':
          return hostingAPI.getContainerLogs(domain);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: (_, { action }) => {
      toast.success(`Container ${action} completed successfully`);
      queryClient.invalidateQueries({ queryKey: ['spinforge-containers'] });
    },
    onError: (error: any, { action }) => {
      toast.error(`Failed to ${action} container: ${error.message}`);
    },
  });

  const handleContainerAction = (id: string, action: string) => {
    actionMutation.mutate({ domain: id, action });
  };

  const handleViewLogs = (container: SpinForgeContainer) => {
    setSelectedContainer(container);
    setShowLogs(true);
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
                    Container Management
                  </h1>
                  <p className="text-sm text-gray-500">SpinForge hosted containers and services</p>
                </div>
              </div>
              
              {/* Dashboard Navigation */}
              <div className="hidden lg:flex items-center space-x-2">
                <div className="flex items-center space-x-1 bg-white/60 backdrop-blur-sm rounded-2xl p-1 border border-white/20 shadow-lg">
                  <Link
                    to="/"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden xl:inline">Dashboard</span>
                  </Link>
                  <Link
                    to="/applications"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <Package className="w-4 h-4" />
                    <span className="hidden xl:inline">Apps</span>
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-white/80 border border-gray-200 text-gray-700 rounded-xl hover:bg-white transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Refresh</span>
              </button>
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
          className="space-y-8"
        >
          {/* Filters and Controls */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search containers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
                  />
                </div>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showOnlyRunning}
                    onChange={(e) => setShowOnlyRunning(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Running only</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Auto-refresh</span>
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grouped')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      viewMode === 'grouped'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Layers className="w-4 h-4 inline mr-1" />
                    Grouped
                  </button>
                  <button
                    onClick={() => setViewMode('flat')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      viewMode === 'flat'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4 inline mr-1" />
                    Flat
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Container List */}
          {isLoading && vhosts.length === 0 ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12">
              <div className="text-center">
                <Container className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No containers found</h3>
                <p className="text-gray-600">
                  {searchTerm || showOnlyRunning
                    ? "Try adjusting your filters"
                    : "Deploy your first container to get started"}
                </p>
              </div>
            </div>
          ) : viewMode === 'grouped' ? (
            // Grouped View
            <div className="space-y-4">
              {filteredGroups.map((group) => (
                <motion.div
                  key={group.name}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Group Header */}
                  <div
                    className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 cursor-pointer hover:from-gray-100 hover:to-gray-150 transition-colors"
                    onClick={() => toggleGroup(group.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {expandedGroups.has(group.name) ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <h3 className="font-semibold text-gray-900">{group.name}</h3>
                        <span className="text-sm text-gray-500">
                          {group.containers.length} container{group.containers.length > 1 ? 's' : ''}
                        </span>
                        {group.isCompose && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            Compose
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${
                            group.status === 'all-running' ? 'bg-green-500' :
                            group.status === 'partial-running' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <span className="text-sm text-gray-600 capitalize">
                            {group.status.replace('-', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group Containers */}
                  <AnimatePresence>
                    {expandedGroups.has(group.name) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="divide-y divide-gray-200"
                      >
                        {group.containers.map((container) => (
                          <ContainerRow
                            key={container.id}
                            container={container}
                            onAction={handleContainerAction}
                            onSelect={setSelectedContainer}
                            onViewLogs={handleViewLogs}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          ) : (
            // Flat Table View
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Container ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CPU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Memory
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredGroups.flatMap(g => g.containers).map((container) => (
                    <ContainerRow
                      key={container.id}
                      container={container}
                      onAction={handleContainerAction}
                      onSelect={setSelectedContainer}
                      onViewLogs={handleViewLogs}
                      tableView={true}
                    />
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Container Details Slide-out Panel */}
      <ContainerSlideoutPanel
        container={selectedContainer}
        isOpen={!!selectedContainer && !showLogs}
        onClose={() => setSelectedContainer(null)}
        onAction={handleContainerAction}
      />
    </div>
  );
}

// Helper Functions
function groupSpinForgeContainers(containers: SpinForgeContainer[]): ContainerGroup[] {
  const groups = new Map<string, ContainerGroup>();
  
  containers.forEach(container => {
    const customerId = container.customerId || 'unknown';
    // Only group containers if they are actual compose deployments
    // Single containers should each be their own group
    const groupName = container.type === 'compose' ? 
      `${customerId}-compose-${container.domain}` : `${customerId}-single-${container.domain}`;
    
    if (!groups.has(groupName)) {
      // Display name: for compose show domain, for single containers show domain too
      const displayName = container.type === 'compose' ? 
        `${container.domain} (Compose)` : container.domain;
        
      groups.set(groupName, {
        name: displayName,
        customerId: customerId,
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
    
    const group = groups.get(groupName)!;
    group.containers.push(container);
    
    if (container.containerStats) {
      group.totalCpu += container.containerStats.cpuUsage || 0;
      group.totalMemory += container.containerStats.memoryUsage || 0;
      group.totalMemoryLimit += container.containerStats.memoryLimit || 0;
      group.totalNetworkRx += container.containerStats.networkRx || 0;
      group.totalNetworkTx += container.containerStats.networkTx || 0;
    }
  });
  
  // Calculate group status
  groups.forEach(group => {
    const running = group.containers.filter(c => {
      // For SpinForge containers, if enabled is not false and no stats error, consider it running
      if (c.enabled === false) return false;
      
      // If we have container stats, check actual status
      if (c.containerStats?.state?.status) {
        return c.containerStats.state.status === 'running';
      }
      
      // Check if container has Docker stats (CPU, Memory, etc.) which indicates it's running
      if (c.containerStats && !c.containerStats.error && 
          (c.containerStats.CPUPerc || c.containerStats.MemUsage || c.containerStats.NetIO)) {
        return true;
      }
      
      // If container has error or no stats, it's stopped
      return false;
    }).length;
    const total = group.containers.length;
    
    if (running === total) {
      group.status = 'all-running';
    } else if (running === 0) {
      group.status = 'all-stopped';
    } else if (running > 0) {
      group.status = 'partial-running';
    } else {
      group.status = 'mixed';
    }
  });
  
  return Array.from(groups.values());
}

function filterGroups(groups: ContainerGroup[], searchTerm: string, showOnlyRunning: boolean): ContainerGroup[] {
  return groups
    .map(group => ({
      ...group,
      containers: group.containers.filter(container => {
        const matchesSearch = !searchTerm || 
          container.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (container.containerConfig?.image || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          container.id.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = !showOnlyRunning || 
          (container.enabled && container.containerStats?.state?.status === 'running');
        
        return matchesSearch && matchesStatus;
      })
    }))
    .filter(group => group.containers.length > 0);
}