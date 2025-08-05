/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hostingAPI, VHost } from '../services/hosting-api';
import { toast } from 'sonner';
import { 
  Play,
  Square,
  RotateCw,
  Trash2,
  Terminal,
  Cpu,
  HardDrive,
  Network,
  Clock,
  AlertCircle,
  X,
  RefreshCw,
  Grid3X3,
  Package,
  LayoutDashboard,
  ChevronRight,
  ChevronDown,
  Container,
  Layers,
  Search,
  CheckCircle,
  XCircle,
  PauseCircle,
  Info,
  Copy,
  Link as LinkIcon,
  Database,
  ExternalLink,
  Activity,
  Shield,
  Box,
  FolderOpen,
  FileText,
  MemoryStick,
  Upload,
  Download,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ContainerStats {
  containerId: string;
  containerName: string;
  image: string;
  status: 'running' | 'stopped' | 'paused' | 'restarting' | 'exited' | 'dead';
  state: {
    running: boolean;
    paused: boolean;
    restarting: boolean;
    pid?: number;
    startedAt?: string;
    finishedAt?: string;
    exitCode?: number;
  };
  created: string;
  ports: Array<{
    containerPort: number;
    hostPort?: number;
    protocol: string;
  }>;
  labels: Record<string, string>;
  networks: string[];
  mounts: Array<{
    type: string;
    source: string;
    destination: string;
  }>;
  env: Record<string, string>;
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  networkRx: number;
  networkTx: number;
  blockRead: number;
  blockWrite: number;
  restartCount: number;
  health?: {
    status: string;
    failingStreak: number;
    log: Array<{
      start: string;
      end: string;
      exitCode: number;
      output: string;
    }>;
  };
}

interface SpinForgeContainer extends VHost {
  containerStats?: ContainerStats;
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
  status: 'all-running' | 'partial-running' | 'all-stopped' | 'mixed';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h ago`;
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  return `${minutes}m ago`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return 'text-green-600 bg-green-50';
    case 'stopped': return 'text-gray-600 bg-gray-50';
    case 'paused': return 'text-yellow-600 bg-yellow-50';
    case 'restarting': return 'text-blue-600 bg-blue-50';
    case 'dead': return 'text-red-600 bg-red-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'running': return CheckCircle;
    case 'stopped': return XCircle;
    case 'paused': return PauseCircle;
    case 'restarting': return RotateCw;
    case 'dead': return AlertCircle;
    default: return Info;
  }
}

export default function ActiveSpinlets() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyRunning, setShowOnlyRunning] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedContainer, setSelectedContainer] = useState<SpinForgeContainer | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  // Fetch SpinForge-hosted containers
  const { data: vhosts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['spinforge-containers'],
    queryFn: async () => {
      try {
        // Get all vhosts
        const allVhosts = await hostingAPI.listVHosts();
        // Filter only container and compose type vhosts
        const containerVhosts = allVhosts.filter(v => v.type === 'container' || v.type === 'compose');
        
        // Fetch container stats for each container vhost
        const containersWithStats = await Promise.all(
          containerVhosts.map(async (vhost) => {
            try {
              const stats = await hostingAPI.getContainerStats(vhost.domain);
              return { ...vhost, containerStats: stats } as SpinForgeContainer;
            } catch (error) {
              console.error(`Failed to fetch stats for ${vhost.domain}:`, error);
              // Return vhost without stats
              return vhost as SpinForgeContainer;
            }
          })
        );
        
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spinforge-containers'] });
      toast.success('Container action completed');
    },
    onError: (error: any) => {
      toast.error(`Failed to perform action: ${error.message}`);
    },
  });

  const handleContainerAction = (domain: string, action: string) => {
    actionMutation.mutate({ domain, action });
  };

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const fetchLogs = async (domain: string) => {
    try {
      const logsData = await hostingAPI.getContainerLogs(domain);
      setLogs(logsData);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLogs('Failed to fetch container logs');
    }
  };

  // Calculate totals
  const totalContainers = vhosts.length;
  const runningContainers = vhosts.filter(v => v.enabled && v.containerStats?.status === 'running').length;
  const totalCpu = vhosts.reduce((sum, v) => sum + (v.containerStats?.cpuUsage || 0), 0);
  const totalMemory = vhosts.reduce((sum, v) => sum + (v.containerStats?.memoryUsage || 0), 0);
  const totalMemoryLimit = vhosts.reduce((sum, v) => sum + (v.containerStats?.memoryLimit || 0), 0);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading containers</h3>
                <p className="mt-2 text-sm text-red-700">{error instanceof Error ? error.message : 'Unknown error'}</p>
              </div>
            </div>
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
                    SpinForge Containers
                  </h1>
                  <p className="text-sm text-gray-500">Manage your hosted containers and applications</p>
                </div>
              </div>
              
              {/* Navigation */}
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
                  <Link
                    to="/active-spinlets"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-lg"></div>
                    <Container className="w-4 h-4 relative z-10" />
                    <span className="hidden xl:inline relative z-10">Containers</span>
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Auto-refresh</span>
              </label>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="p-2 bg-white/60 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
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
          className="space-y-6"
        >
          {/* Resource Usage Summary */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Container CPU usage</div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-gray-900">{totalCpu.toFixed(1)}%</span>
                  <span className="text-sm text-gray-500">/ {vhosts.length * 100}%</span>
                  <span className="text-xs text-gray-400">({vhosts.length} CPUs available)</span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Container memory usage</div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-gray-900">{formatBytes(totalMemory)}</span>
                  <span className="text-sm text-gray-500">/ {formatBytes(totalMemoryLimit)}</span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Total containers</div>
                <div className="text-2xl font-bold text-gray-900">{totalContainers}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Running</div>
                <div className="text-2xl font-bold text-green-600">{runningContainers}</div>
              </div>
            </div>
          </div>

          {/* Search and Controls */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search containers..."
                    className="pl-12 pr-4 py-3 w-full bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <label className="flex items-center space-x-2 px-4 py-3 bg-white/60 border border-gray-200 rounded-xl">
                  <input
                    type="checkbox"
                    checked={showOnlyRunning}
                    onChange={(e) => setShowOnlyRunning(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Only show running containers</span>
                </label>
                
                <div className="flex bg-white/60 rounded-xl p-1 border border-gray-200">
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
                          <ChevronDown className="h-5 w-5 text-gray-600" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-600" />
                        )}
                        {group.isCompose ? (
                          <Layers className="h-5 w-5 text-purple-600" />
                        ) : (
                          <Container className="h-5 w-5 text-blue-600" />
                        )}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {group.isCompose ? 'Compose Stack' : `Customer: ${group.customerId}`}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {group.containers.length} container{group.containers.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            group.status === 'all-running' ? 'bg-green-100 text-green-700' :
                            group.status === 'partial-running' ? 'bg-yellow-100 text-yellow-700' :
                            group.status === 'all-stopped' ? 'bg-gray-100 text-gray-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {group.containers.length} container{group.containers.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Cpu className="h-4 w-4" />
                            <span>{group.totalCpu.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <HardDrive className="h-4 w-4" />
                            <span>{formatBytes(group.totalMemory)} / {formatBytes(group.totalMemoryLimit)}</span>
                          </div>
                        </div>
                        
                        {group.isCompose && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContainerAction(group.name, 'compose-start');
                              }}
                              className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
                              title="Start all"
                            >
                              <Play className="h-4 w-4 text-green-600" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContainerAction(group.name, 'compose-stop');
                              }}
                              className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                              title="Stop all"
                            >
                              <Square className="h-4 w-4 text-red-600" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContainerAction(group.name, 'compose-restart');
                              }}
                              className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Restart all"
                            >
                              <RotateCw className="h-4 w-4 text-blue-600" />
                            </button>
                          </div>
                        )}
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
                      >
                        <div className="divide-y divide-gray-200">
                          {group.containers.map((container) => (
                            <ContainerRow
                              key={container.id}
                              container={container}
                              onAction={handleContainerAction}
                              onSelect={setSelectedContainer}
                              onViewLogs={(c) => {
                                setSelectedContainer(c);
                                setShowLogs(true);
                                fetchLogs(c.id);
                              }}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          ) : (
            // Flat View
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
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
                        Port(s)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CPU (%)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Memory usage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last started
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
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
                        onViewLogs={(c) => {
                          setSelectedContainer(c);
                          setShowLogs(true);
                          fetchLogs(c.id);
                        }}
                        tableView
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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

      {/* Logs Modal */}
      <AnimatePresence>
        {showLogs && selectedContainer && (
          <LogsModal
            container={selectedContainer}
            logs={logs}
            onClose={() => {
              setShowLogs(false);
              setLogs('');
            }}
            onBack={() => setShowLogs(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Container Row Component
function ContainerRow({ 
  container, 
  onAction, 
  onSelect, 
  onViewLogs,
  tableView = false 
}: {
  container: ContainerInfo;
  onAction: (id: string, action: string) => void;
  onSelect: (container: ContainerInfo) => void;
  onViewLogs: (container: ContainerInfo) => void;
  tableView?: boolean;
}) {
  const status = container.enabled !== false ? (container.containerStats?.state?.status || 'unknown') : 'stopped';
  const StatusIcon = getStatusIcon(status);
  
  if (tableView) {
    return (
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <StatusIcon className={`h-5 w-5 ${getStatusColor(status).split(' ')[0]}`} />
            <span className="ml-2 text-sm text-gray-900 capitalize">{status}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900">{container.domain}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-500 font-mono">{container.id.substring(0, 12)}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">{container.image}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-500">
            {container.ports.map(p => p.publicPort ? `${p.publicPort}:${p.privatePort}` : p.privatePort).join(', ') || '-'}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">{container.cpuPercent.toFixed(2)}%</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">
            {formatBytes(container.memoryUsage)} / {formatBytes(container.memoryLimit)}
            <span className="text-xs text-gray-500 ml-1">({container.memoryPercent.toFixed(1)}%)</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-500">
            {container.state.startedAt ? formatUptime(container.state.startedAt) : '-'}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right">
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={() => onSelect(container)}
              className="text-gray-600 hover:text-gray-900"
              title="View details"
            >
              <Info className="h-4 w-4" />
            </button>
            {status === 'running' ? (
              <>
                <button
                  onClick={() => onAction(container.domain, 'stop')}
                  className="text-red-600 hover:text-red-900"
                  title="Stop"
                >
                  <Square className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onAction(container.domain, 'restart')}
                  className="text-blue-600 hover:text-blue-900"
                  title="Restart"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => onAction(container.domain, 'start')}
                className="text-green-600 hover:text-green-900"
                title="Start"
              >
                <Play className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onViewLogs(container)}
              className="text-gray-600 hover:text-gray-900"
              title="View logs"
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
          <StatusIcon className={`h-5 w-5 ${getStatusColor(status).split(' ')[0]}`} />
          
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
                  {container.containerStats?.ports?.map(p => 
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
                {(container.containerStats?.cpuUsage || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">CPU</div>
            </div>
            <div className="text-right">
              <div className="text-gray-900 font-medium">
                {formatBytes(container.containerStats?.memoryUsage || 0)}
              </div>
              <div className="text-xs text-gray-500">
                {((container.containerStats?.memoryUsage || 0) / (container.containerStats?.memoryLimit || 1) * 100).toFixed(1)}% MEM
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onSelect(container)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="View details"
            >
              <Info className="h-4 w-4 text-gray-600" />
            </button>
            {status === 'running' ? (
              <>
                <button
                  onClick={() => onAction(container.domain, 'stop')}
                  className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                  title="Stop"
                >
                  <Square className="h-4 w-4 text-red-600" />
                </button>
                <button
                  onClick={() => onAction(container.domain, 'restart')}
                  className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                  title="Restart"
                >
                  <RotateCw className="h-4 w-4 text-blue-600" />
                </button>
              </>
            ) : (
              <button
                onClick={() => onAction(container.domain, 'start')}
                className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
                title="Start"
              >
                <Play className="h-4 w-4 text-green-600" />
              </button>
            )}
            <button
              onClick={() => onViewLogs(container)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="View logs"
            >
              <Terminal className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={() => onAction(container.domain, 'remove')}
              className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
              title="Remove"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Container Details Slide-out Panel
function ContainerSlideoutPanel({ 
  container, 
  isOpen,
  onClose, 
  onAction
}: {
  container: SpinForgeContainer | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (id: string, action: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'summary' | 'logs' | 'exec' | 'files'>('summary');
  const [logs, setLogs] = useState<string>('');
  const [execCommand, setExecCommand] = useState<string>('');
  const [execOutput, setExecOutput] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [files, setFiles] = useState<any[]>([]);
  
  if (!container) return null;
  
  const status = container.enabled !== false ? (container.containerStats?.state?.status || 'unknown') : 'stopped';
  const StatusIcon = getStatusIcon(status);

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const logsData = await hostingAPI.getContainerLogs(container.domain, { tail: 1000 });
      setLogs(logsData);
    } catch (error) {
      setLogs('Failed to fetch logs');
    }
  };

  // Execute command
  const executeCommand = async () => {
    if (!execCommand.trim()) return;
    try {
      const result = await hostingAPI.execInContainer(container.domain, execCommand);
      setExecOutput(prev => prev + `$ ${execCommand}\n${result.output}\n\n`);
      setExecCommand('');
    } catch (error: any) {
      setExecOutput(prev => prev + `$ ${execCommand}\nError: ${error.message}\n\n`);
      setExecCommand('');
    }
  };

  // Fetch files
  const fetchFiles = async (path: string = '/') => {
    try {
      const filesData = await hostingAPI.getContainerFiles(container.domain, path);
      setFiles(filesData);
      setCurrentPath(path);
    } catch (error) {
      setFiles([]);
    }
  };

  // Load data when tab changes
  useEffect(() => {
    if (!isOpen) return;
    
    switch (activeTab) {
      case 'logs':
        fetchLogs();
        break;
      case 'files':
        fetchFiles(currentPath);
        break;
    }
  }, [activeTab, isOpen, container.domain, currentPath]);
  
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
                    <StatusIcon className={`h-6 w-6 ${getStatusColor(status).split(' ')[0]}`} />
                    <h2 className="text-2xl font-bold text-gray-900">{container.domain}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                      {status.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 font-mono">{container.id}</p>
                </div>
                
                <div className="flex items-center space-x-2">
                  {status === 'running' ? (
                    <>
                      <button
                        onClick={() => onAction(container.domain, 'pause')}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                      >
                        <PauseCircle className="h-4 w-4 inline mr-1" />
                        Pause
                      </button>
                      <button
                        onClick={() => onAction(container.domain, 'stop')}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        <Square className="h-4 w-4 inline mr-1" />
                        Stop
                      </button>
                      <button
                        onClick={() => onAction(container.domain, 'restart')}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      >
                        <RotateCw className="h-4 w-4 inline mr-1" />
                        Restart
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onAction(container.domain, 'start')}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      <Play className="h-4 w-4 inline mr-1" />
                      Start
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-200 rounded-lg"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="px-8 py-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Image</div>
                      <div className="text-sm font-medium text-gray-900">
                        {container.containerConfig?.image || container.containerStats?.image || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Created</div>
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(container.created_at || container.containerStats?.created || '').toLocaleString()}
                      </div>
                    </div>
                    {container.containerStats?.state?.startedAt && (
                      <div>
                        <div className="text-sm text-gray-500">Started</div>
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(container.containerStats.state.startedAt).toLocaleString()}
                        </div>
                      </div>
                    )}
                    {container.containerStats?.state?.finishedAt && (
                      <div>
                        <div className="text-sm text-gray-500">Finished</div>
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(container.containerStats.state.finishedAt).toLocaleString()}
                        </div>
                      </div>
                    )}
                    {(container.containerStats?.restartCount || 0) > 0 && (
                      <div>
                        <div className="text-sm text-gray-500">Restart Count</div>
                        <div className="text-sm font-medium text-gray-900">
                          {container.containerStats?.restartCount}
                        </div>
                      </div>
                    )}
                    {container.containerStats?.state?.pid && (
                      <div>
                        <div className="text-sm text-gray-500">Process ID</div>
                        <div className="text-sm font-medium text-gray-900">
                          {container.containerStats.state.pid}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Ports */}
                {((container.containerStats?.ports?.length || 0) > 0 || container.containerConfig?.port) && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Port Bindings</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="space-y-2">
                        {container.containerStats?.ports?.map((port, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Container Port</span>
                            <span className="font-mono font-medium text-gray-900">
                              {port.hostPort ? `${port.hostPort} → ${port.containerPort}/${port.protocol}` : `${port.containerPort}/${port.protocol}`}
                            </span>
                          </div>
                        )) || (
                          container.containerConfig?.port && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Container Port</span>
                              <span className="font-mono font-medium text-gray-900">
                                {container.containerConfig.port}/tcp
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Environment Variables */}
                {((container.containerStats?.env && Object.keys(container.containerStats.env).length > 0) ||
                  (container.containerConfig?.env && container.containerConfig.env.length > 0)) && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Environment Variables</h3>
                    <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-900">
                        {container.containerStats?.env
                          ? Object.entries(container.containerStats.env)
                              .map(([key, value]) => `${key}=${value}`)
                              .join('\n')
                          : container.containerConfig?.env
                              ?.map(e => `${e.key}=${e.value}`)
                              .join('\n')}
                      </pre>
                    </div>
                  </div>
                )}
                
                {/* Mounts */}
                {container.containerStats?.mounts && container.containerStats.mounts.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Mounts</h3>
                    <div className="space-y-2">
                      {container.containerStats.mounts.map((mount, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Type</span>
                            <span className="font-medium text-gray-900">{mount.type}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-gray-600">Source</span>
                            <span className="font-mono text-gray-900">{mount.source}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-gray-600">Destination</span>
                            <span className="font-mono text-gray-900">{mount.destination}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Networks */}
                {container.containerStats?.networks && container.containerStats.networks.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Networks</h3>
                    <div className="flex flex-wrap gap-2">
                      {container.containerStats.networks.map((network, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {network}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Resource Usage */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Resource Usage</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <Cpu className="h-5 w-5 text-gray-400" />
                        <span className="text-2xl font-bold text-gray-900">
                          {(container.containerStats?.cpuUsage || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">CPU Usage</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <HardDrive className="h-5 w-5 text-gray-400" />
                        <span className="text-2xl font-bold text-gray-900">
                          {formatBytes(container.containerStats?.memoryUsage || 0)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Memory ({((container.containerStats?.memoryUsage || 0) / (container.containerStats?.memoryLimit || 1) * 100).toFixed(1)}%)
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <Network className="h-5 w-5 text-gray-400" />
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">
                            ↓ {formatBytes(container.containerStats?.networkRx || 0)}
                          </div>
                          <div className="text-sm font-bold text-gray-900">
                            ↑ {formatBytes(container.containerStats?.networkTx || 0)}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Network I/O</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <Database className="h-5 w-5 text-gray-400" />
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">
                            R {formatBytes(container.containerStats?.blockRead || 0)}
                          </div>
                          <div className="text-sm font-bold text-gray-900">
                            W {formatBytes(container.containerStats?.blockWrite || 0)}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Disk I/O</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

// Logs Modal
function LogsModal({ 
  container, 
  logs, 
  onClose,
  onBack 
}: {
  container: SpinForgeContainer;
  logs: string;
  onClose: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <motion.div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-0 z-[61] overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            className="relative bg-gray-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Terminal className="h-5 w-5 text-gray-400" />
                  <h2 className="text-lg font-semibold text-white">Container Logs: {container.domain}</h2>
                  <span className="text-sm text-gray-400 font-mono">
                    {container.containerStats?.containerId?.substring(0, 12) || container.id}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={onBack}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                  >
                    Back to Details
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(logs)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                  >
                    <Copy className="h-4 w-4 inline mr-1" />
                    Copy
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-700 rounded-lg"
                  >
                    <AlertCircle className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Logs Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] bg-gray-900">
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">{logs || 'No logs available'}</pre>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

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
    const running = group.containers.filter(c => 
      c.enabled && c.containerStats?.status === 'running'
    ).length;
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
  
  return Array.from(groups.values()).sort((a, b) => {
    // Sort compose groups first, then by customer ID
    if (a.isCompose && !b.isCompose) return -1;
    if (!a.isCompose && b.isCompose) return 1;
    return a.customerId.localeCompare(b.customerId);
  });
}

function filterGroups(groups: ContainerGroup[], searchTerm: string, showOnlyRunning: boolean): ContainerGroup[] {
  return groups
    .map(group => {
      const filteredContainers = group.containers.filter(container => {
        const matchesSearch = !searchTerm || 
          container.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (container.containerStats?.containerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (container.containerStats?.image || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (container.containerStats?.containerId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (container.customerId || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = !showOnlyRunning || 
          (container.enabled && container.containerStats?.status === 'running');
        
        return matchesSearch && matchesStatus;
      });
      
      if (filteredContainers.length === 0) return null;
      
      return {
        ...group,
        containers: filteredContainers,
        totalCpu: filteredContainers.reduce((sum, c) => sum + (c.containerStats?.cpuUsage || 0), 0),
        totalMemory: filteredContainers.reduce((sum, c) => sum + (c.containerStats?.memoryUsage || 0), 0),
        totalMemoryLimit: filteredContainers.reduce((sum, c) => sum + (c.containerStats?.memoryLimit || 0), 0),
        totalNetworkRx: filteredContainers.reduce((sum, c) => sum + (c.containerStats?.networkRx || 0), 0),
        totalNetworkTx: filteredContainers.reduce((sum, c) => sum + (c.containerStats?.networkTx || 0), 0),
      };
    })
    .filter(group => group !== null) as ContainerGroup[];
}
