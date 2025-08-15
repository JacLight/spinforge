/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { hostingAPI } from "../services/customer-api";
import { toast } from "sonner";
import SSLCertificateManager from "./SSLCertificateManager";
import {
  X,
  Globe,
  Server,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Edit2,
  Save,
  FolderOpen,
  Network,
  Package,
  Copy,
  RefreshCw,
  Trash2,
  Info,
  Plus,
  AlertTriangle,
  Check,
  XCircle,
  Link,
  Tag,
  User,
  Calendar,
  Shield,
  ChevronRight,
  Activity,
  Clock,
  Users,
  Zap,
  BarChart3,
  TrendingUp,
  Settings,
  Lock,
} from "lucide-react";

// Helper function for domain validation
function isValidDomain(domain: string): boolean {
  if (!domain) return false;
  
  // Allow localhost and IP addresses
  if (domain === 'localhost' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(domain)) {
    return true;
  }
  
  // Regular domain validation
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  return domainRegex.test(domain);
}

// Metrics component
function MetricsSection({ domain }: { domain?: string }) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['vhost-metrics', domain],
    queryFn: () => domain ? hostingAPI.getVHostMetrics(domain) : null,
    enabled: !!domain,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (!domain || isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-100 rounded-lg h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8 text-gray-500">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>No metrics available yet</p>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">Total Requests</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-900">{formatNumber(metrics.totalRequests)}</p>
          <p className="text-xs text-blue-600 mt-1">
            {metrics.metrics.requests} in last {metrics.timeRange}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-700">Bandwidth</span>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-900">{formatBytes(metrics.totalBandwidth)}</p>
          <p className="text-xs text-green-600 mt-1">
            {formatBytes(metrics.metrics.bandwidth)} in last {metrics.timeRange}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-700">Unique Visitors</span>
            <Users className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-900">{formatNumber(metrics.uniqueVisitors)}</p>
          <p className="text-xs text-purple-600 mt-1">Today</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-yellow-700">Avg Response</span>
            <Zap className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-yellow-900">{metrics.metrics.avgResponseTime}ms</p>
          <p className="text-xs text-yellow-600 mt-1">
            Error rate: {(metrics.metrics.errorRate * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Last Accessed */}
      {metrics.lastAccessed && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Last Accessed</span>
          </div>
          <p className="text-sm text-gray-900 mt-1">
            {new Date(metrics.lastAccessed).toLocaleString()}
          </p>
        </div>
      )}

      {/* Status Code Distribution */}
      {metrics.metrics.statusCodes && Object.keys(metrics.metrics.statusCodes).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Response Status Distribution</h4>
          <div className="space-y-2">
            {Object.entries(metrics.metrics.statusCodes).map(([status, count]) => {
              const total = Object.values(metrics.metrics.statusCodes).reduce((a, b) => a + b, 0);
              const percentage = (count / total) * 100;
              const isError = parseInt(status) >= 400;
              
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className={`text-sm font-medium w-12 ${
                    isError ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {status}
                  </span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isError ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-20 text-right">
                    {count} ({percentage.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Logs Preview */}
      {metrics.recentLogs && metrics.recentLogs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">Recent Requests</h4>
            <a
              href={`#logs`}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              View all logs →
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {metrics.recentLogs.slice(0, 5).map((log, index) => (
              <div key={index} className="px-4 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      log.status >= 400 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {log.status}
                    </span>
                    <span className="text-gray-700">{log.method}</span>
                    <span className="text-gray-600 truncate max-w-xs">{log.path}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500">
                    <span>{log.responseTime}ms</span>
                    <span>{formatBytes(log.bytes)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Container Management Component
function ContainerManagement({ vhost }: { vhost: any }) {
  const [logs, setLogs] = useState<string>('');
  const [showLogs, setShowLogs] = useState(false);
  const [containerStatus, setContainerStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown');
  const [isLoading, setIsLoading] = useState(false);

  // Check container health
  const { data: health, refetch: refetchHealth } = useQuery({
    queryKey: ['container-health', vhost.domain],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/sites/${vhost.domain}/container/health`);
      if (!response.ok) throw new Error('Failed to get container health');
      return response.json();
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  React.useEffect(() => {
    if (health) {
      setContainerStatus(health.status === 'running' ? 'running' : 'stopped');
    }
  }, [health]);

  const handleContainerAction = async (action: 'start' | 'stop' | 'restart') => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/sites/${vhost.domain}/container/${action}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} container`);
      }
      
      toast.success(`Container ${action}ed successfully`);
      
      // Refetch health status after action
      setTimeout(() => {
        refetchHealth();
      }, 2000);
    } catch (error: any) {
      toast.error(`Failed to ${action} container: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/sites/${vhost.domain}/container/logs?lines=200`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setLogs(data.logs);
      setShowLogs(true);
    } catch (error) {
      toast.error('Failed to fetch container logs');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Container Management
        </label>
        
        {/* Container Status */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Container Status</p>
              <div className="flex items-center mt-1">
                {containerStatus === 'running' ? (
                  <>
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                    <span className="text-sm text-green-700">Running</span>
                  </>
                ) : containerStatus === 'stopped' ? (
                  <>
                    <div className="h-2 w-2 bg-red-500 rounded-full mr-2" />
                    <span className="text-sm text-red-700">Stopped</span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 bg-gray-500 rounded-full mr-2" />
                    <span className="text-sm text-gray-700">Unknown</span>
                  </>
                )}
              </div>
            </div>
            
            {health && health.health && health.health !== 'no healthcheck' && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">Health Check</p>
                <p className="text-sm text-gray-600 mt-1">{health.health}</p>
              </div>
            )}
          </div>
          
          {/* Container Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => handleContainerAction('start')}
              disabled={isLoading || containerStatus === 'running'}
              className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Start
            </button>
            <button
              onClick={() => handleContainerAction('stop')}
              disabled={isLoading || containerStatus === 'stopped'}
              className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Stop
            </button>
            <button
              onClick={() => handleContainerAction('restart')}
              disabled={isLoading || containerStatus !== 'running'}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4 inline mr-1" />
              Restart
            </button>
          </div>
        </div>
        
        {/* View Logs Button */}
        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
        >
          View Container Logs
        </button>
      </div>
      
      {/* Logs Modal */}
      <AnimatePresence>
        {showLogs && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-[70]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogs(false)}
            />
            <motion.div
              className="fixed inset-0 z-[71] flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold">Container Logs</h3>
                  <button
                    onClick={() => setShowLogs(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-6">
                  <pre className="text-xs font-mono bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    {logs || 'No logs available'}
                  </pre>
                </div>
                <div className="p-6 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={() => setShowLogs(false)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ApplicationDrawerProps {
  vhost: any | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ApplicationDrawerV2({ vhost: initialVhost, isOpen, onClose, onRefresh }: ApplicationDrawerProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [activeSection, setActiveSection] = useState<string>('overview');
  
  // Fetch fresh site data when drawer opens
  const { data: vhost, refetch: refetchSite } = useQuery({
    queryKey: ['site', initialVhost?.domain],
    queryFn: async () => {
      if (!initialVhost?.domain) return initialVhost;
      return hostingAPI.getVHost(initialVhost.domain);
    },
    enabled: isOpen && !!initialVhost?.domain,
    initialData: initialVhost,
  });
  
  interface BackendConfig {
    url: string;
    isLocal?: boolean;
    label?: string;
    enabled?: boolean;
    healthCheck?: {
      path: string;
      interval: number;
      timeout: number;
      unhealthyThreshold: number;
      healthyThreshold: number;
    };
  }

  // Form states
  const [domain, setDomain] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [newAlias, setNewAlias] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [target, setTarget] = useState('');
  const [preserveHost, setPreserveHost] = useState(false);
  const [backendConfigs, setBackendConfigs] = useState<BackendConfig[]>([]);
  const [editingBackendIndex, setEditingBackendIndex] = useState<number | null>(null);
  const [confirmDeleteBackend, setConfirmDeleteBackend] = useState<number | null>(null);
  
  // Static site specific states
  const [indexFile, setIndexFile] = useState('index.html');
  const [errorFile, setErrorFile] = useState('');
  
  interface RoutingRule {
    type: 'cookie' | 'query' | 'header';
    name: string;
    matchType: 'exact' | 'regex' | 'prefix';
    value: string;
    targetLabel: string;
    priority?: number;
  }
  
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [newRule, setNewRule] = useState<RoutingRule>({
    type: 'cookie',
    name: '',
    matchType: 'exact',
    value: '',
    targetLabel: '',
    priority: 1,
  });
  const [stickySessionDuration, setStickySessionDuration] = useState<number>(3600);
  
  // Container configuration states
  const [containerImage, setContainerImage] = useState('');
  const [containerPort, setContainerPort] = useState(3000);
  const [containerEnv, setContainerEnv] = useState<{ key: string; value: string }[]>([]);
  const [containerCpuLimit, setContainerCpuLimit] = useState('');
  const [containerMemoryLimit, setContainerMemoryLimit] = useState('');
  const [containerRestartPolicy, setContainerRestartPolicy] = useState('unless-stopped');
  
  // SSL configuration state
  const [sslEnabled, setSslEnabled] = useState(false);
  const [sslRedirect, setSslRedirect] = useState(false);
  
  const [newBackend, setNewBackend] = useState<BackendConfig>({
    url: '',
    isLocal: false,
    label: '',
    healthCheck: {
      path: '/health',
      interval: 10,
      timeout: 5,
      unhealthyThreshold: 3,
      healthyThreshold: 2,
    }
  });
  
  // Validation errors
  const [domainError, setDomainError] = useState('');
  const [aliasErrors, setAliasErrors] = useState<Record<number, string>>({});
  const [newAliasError, setNewAliasError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [backendErrors, setBackendErrors] = useState<Record<number, string>>({});
  const [newBackendError, setNewBackendError] = useState('');

  // Initialize form when vhost changes
  React.useEffect(() => {
    if (vhost) {
      setDomain(vhost.domain || '');
      setAliases(vhost.aliases || []);
      setCustomerId(vhost.customerId || '');
      setEnabled(vhost.enabled !== false);
      setTarget(vhost.target || '');
      setPreserveHost(vhost.preserve_host || false);
      setIndexFile(vhost.index_file || 'index.html');
      setErrorFile(vhost.error_file || '');
      
      // Convert old format to new format
      if (vhost.backendConfigs) {
        // Ensure all backends have healthCheck initialized
        setBackendConfigs(vhost.backendConfigs.map((backend: BackendConfig) => ({
          ...backend,
          healthCheck: backend.healthCheck || {
            path: '/health',
            interval: 10,
            timeout: 5,
            unhealthyThreshold: 3,
            healthyThreshold: 2,
          }
        })));
      } else if (vhost.backends) {
        setBackendConfigs(vhost.backends.map((url: string) => ({
          url,
          healthCheck: {
            path: '/health',
            interval: 10,
            timeout: 5,
            unhealthyThreshold: 3,
            healthyThreshold: 2,
          }
        })));
      } else {
        setBackendConfigs([]);
      }
      
      // Set routing rules
      setRoutingRules(vhost.routingRules || []);
      
      // Set sticky session duration
      setStickySessionDuration(vhost.stickySessionDuration || 3600);
      
      // Set container configuration
      if (vhost.containerConfig) {
        setContainerImage(vhost.containerConfig.image || '');
        setContainerPort(vhost.containerConfig.port || 3000);
        setContainerEnv(vhost.containerConfig.env || []);
        setContainerCpuLimit(vhost.containerConfig.cpuLimit || '');
        setContainerMemoryLimit(vhost.containerConfig.memoryLimit || '');
        setContainerRestartPolicy(vhost.containerConfig.restartPolicy || 'unless-stopped');
      }
      
      // Set SSL configuration
      setSslEnabled(vhost.ssl_enabled || false);
      setSslRedirect(vhost.config?.sslRedirect || false);
      
      // Clear errors
      setDomainError('');
      setAliasErrors({});
      setNewAliasError('');
      setDeleteError('');
      setBackendErrors({});
      setNewBackendError('');
    }
  }, [vhost]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => hostingAPI.updateVHost(vhost.domain, data),
    onSuccess: () => {
      toast.success("Application updated successfully");
      queryClient.invalidateQueries({ queryKey: ["vhosts"] });
      setIsEditing(false);
      onRefresh();
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => hostingAPI.deleteVHost(vhost.domain),
    onSuccess: () => {
      toast.success("Application deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["vhosts"] });
      setShowDeleteModal(false);
      onClose();
    },
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  // Get all vhosts for validation
  const { data: allVhosts = [] } = useQuery({
    queryKey: ["all-vhosts"],
    queryFn: () => hostingAPI.listVHosts(),
    staleTime: 60000,
  });

  const validateDomain = (value: string) => {
    if (!isValidDomain(value)) {
      setDomainError('Please enter a valid domain');
      return false;
    }
    
    const isDuplicateDomain = allVhosts.some(v => 
      v.id !== vhost.id && 
      (v.domain === value || v.aliases?.includes(value))
    );
    if (isDuplicateDomain) {
      setDomainError('This domain is already in use by another site');
      return false;
    }
    
    setDomainError('');
    return true;
  };

  const validateAlias = (value: string, index: number) => {
    if (!isValidDomain(value)) {
      setAliasErrors({ ...aliasErrors, [index]: 'Please enter a valid domain' });
      return false;
    }
    
    const isDuplicate = allVhosts.some(v => 
      v.id !== vhost.id && 
      (v.domain === value || v.aliases?.includes(value))
    );
    if (isDuplicate) {
      setAliasErrors({ ...aliasErrors, [index]: 'This domain is already in use by another site' });
      return false;
    }
    
    const newErrors = { ...aliasErrors };
    delete newErrors[index];
    setAliasErrors(newErrors);
    return true;
  };

  const handleSave = () => {
    let hasErrors = false;
    
    // Validate domain
    if (!validateDomain(domain)) {
      hasErrors = true;
    }
    
    // Validate aliases
    aliases.forEach((alias, index) => {
      if (!validateAlias(alias, index)) {
        hasErrors = true;
      }
    });
    
    if (hasErrors) {
      toast.error('Please fix the errors before saving');
      return;
    }
    
    const updatedData: any = {
      domain,
      aliases,
      customerId,
      enabled,
      ssl_enabled: sslEnabled,
      config: {
        sslRedirect: sslRedirect
      }
    };
    
    // Add static site specific fields
    if (vhost.type === 'static') {
      updatedData.index_file = indexFile;
      updatedData.error_file = errorFile;
    }
    
    if (vhost.type === 'proxy') {
      updatedData.target = target;
      updatedData.preserve_host = preserveHost;
    }
    
    if (vhost.type === 'loadbalancer') {
      updatedData.backendConfigs = backendConfigs;
      updatedData.routingRules = routingRules;
      updatedData.stickySessionDuration = stickySessionDuration;
    }
    
    if (vhost.type === 'container') {
      updatedData.containerConfig = {
        image: containerImage,
        port: containerPort,
        env: containerEnv,
        cpuLimit: containerCpuLimit,
        memoryLimit: containerMemoryLimit,
        restartPolicy: containerRestartPolicy,
      };
    }
    
    updateMutation.mutate(updatedData);
  };

  const handleDelete = () => {
    if (deleteConfirmation !== vhost.domain) {
      setDeleteError('Please type the exact domain name to confirm');
      return;
    }
    deleteMutation.mutate();
  };

  const addAlias = () => {
    if (!isValidDomain(newAlias)) {
      setNewAliasError('Please enter a valid domain');
      return;
    }
    
    const isDuplicate = allVhosts.some(v => 
      v.id !== vhost.id && 
      (v.domain === newAlias || v.aliases?.includes(newAlias))
    );
    if (isDuplicate) {
      setNewAliasError('This domain is already in use by another site');
      return;
    }
    
    setAliases([...aliases, newAlias]);
    setNewAlias('');
    setNewAliasError('');
  };

  const removeAlias = (index: number) => {
    setAliases(aliases.filter((_, i) => i !== index));
    const newErrors = { ...aliasErrors };
    delete newErrors[index];
    setAliasErrors(newErrors);
  };

  const addBackend = () => {
    const errors: string[] = [];
    
    if (!newBackend.url) {
      errors.push('URL is required');
    } else {
      try {
        new URL(newBackend.url);
      } catch {
        errors.push('Please enter a valid URL');
      }
    }
    
    if (errors.length > 0) {
      setNewBackendError(errors.join(', '));
      return;
    }
    
    setBackendConfigs([...backendConfigs, newBackend]);
    setNewBackend({
      url: '',
      isLocal: false,
      label: '',
      healthCheck: {
        path: '/health',
        interval: 10,
        timeout: 5,
        unhealthyThreshold: 3,
        healthyThreshold: 2,
      }
    });
    setNewBackendError('');
  };

  const removeBackend = (index: number) => {
    setBackendConfigs(backendConfigs.filter((_, i) => i !== index));
    const newErrors = { ...backendErrors };
    delete newErrors[index];
    setBackendErrors(newErrors);
    setConfirmDeleteBackend(null);
  };

  const updateBackend = (index: number, updatedBackend: BackendConfig) => {
    const newBackends = [...backendConfigs];
    newBackends[index] = updatedBackend;
    setBackendConfigs(newBackends);
  };

  const addRoutingRule = () => {
    if (!newRule.name || !newRule.value || !newRule.targetLabel) {
      toast.error('Please fill all fields for the routing rule');
      return;
    }
    
    setRoutingRules([...routingRules, { ...newRule, priority: routingRules.length + 1 }]);
    setNewRule({
      type: 'cookie',
      name: '',
      matchType: 'exact',
      value: '',
      targetLabel: '',
      priority: 1,
    });
  };

  const removeRoutingRule = (index: number) => {
    setRoutingRules(routingRules.filter((_, i) => i !== index));
  };

  const getSiteUrl = (vhostData: any) => {
    if (!vhostData?.domain) return null;
    return `http://${vhostData.domain}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'static':
        return <FolderOpen className="h-5 w-5" />;
      case 'proxy':
        return <Network className="h-5 w-5" />;
      case 'container':
        return <Package className="h-5 w-5" />;
      case 'loadbalancer':
        return <Server className="h-5 w-5" />;
      default:
        return <Globe className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'static':
        return 'text-blue-600 bg-blue-50';
      case 'proxy':
        return 'text-green-600 bg-green-50';
      case 'container':
        return 'text-purple-600 bg-purple-50';
      case 'loadbalancer':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (!vhost) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-gray-500 bg-opacity-75 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-y-0 right-0 z-[61] w-full max-w-full lg:max-w-5xl xl:max-w-7xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 shadow-2xl flex flex-col">
              {/* Enhanced Header */}
              <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
                <div className="px-6 lg:px-8 py-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-xl ${getTypeColor(vhost.type)} shadow-sm`}>
                        {getTypeIcon(vhost.type)}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                          {vhost.domain || vhost.id || 'Application Details'}
                        </h2>
                        <p className="text-sm text-gray-500 capitalize flex items-center gap-2 mt-1">
                          {vhost.type} Application
                          {vhost.enabled !== false ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4" />
                              Disabled
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex items-center gap-3 mt-6 flex-wrap">
                    {getSiteUrl(vhost) && (
                      <a
                        href={getSiteUrl(vhost)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/80 transition-all duration-200 shadow-sm"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Visit Site
                      </a>
                    )}
                    {!isEditing ? (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/80 transition-all duration-200 shadow-sm"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit Configuration
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setIsEditing(false);
                            // Reset form values
                            setDomain(vhost.domain || '');
                            setAliases(vhost.aliases || []);
                            setEnabled(vhost.enabled !== false);
                            setTarget(vhost.target || '');
                            setPreserveHost(vhost.preserve_host || false);
                            setIndexFile(vhost.index_file || 'index.html');
                            setErrorFile(vhost.error_file || '');
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all duration-200 shadow-sm"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={updateMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                        >
                          {updateMutation.isPending ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              Save Changes
                            </>
                          )}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        refetchSite();
                        toast.success('Site data refreshed');
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/80 transition-all duration-200 shadow-sm"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </button>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700 hover:bg-red-100 transition-all duration-200 shadow-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                  
                  {/* Quick Navigation */}
                  <div className="mt-4 flex space-x-1">
                    {[
                      { id: 'overview', label: 'Overview', icon: Info },
                      { id: 'domains', label: 'Domains', icon: Globe },
                      { id: 'metrics', label: 'Metrics', icon: ChevronRight },
                      { id: 'settings', label: 'Settings', icon: Shield },
                      { id: 'ssl', label: 'SSL Certificate', icon: Lock }
                    ].map((section) => (
                      <button
                        key={section.id}
                        onClick={() => {
                          setActiveSection(section.id);
                          if (section.id !== 'ssl') {
                            setTimeout(() => {
                              document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: 'smooth' });
                            }, 100);
                          }
                        }}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                          activeSection === section.id
                            ? 'bg-white/80 text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                        }`}
                      >
                        <section.icon className="h-3 w-3" />
                        {section.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Content - Split into scrollable and fixed sections */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Show either main content or SSL section based on active section */}
                {activeSection === 'ssl' ? (
                  /* SSL Certificate Section - Full height */
                  <div className="flex-1 overflow-y-auto bg-white">
                    <div className="px-6 lg:px-8 py-8">
                      <h2 className="text-lg font-semibold text-gray-900 mb-6">SSL Certificate Management</h2>
                      <SSLCertificateManager 
                        domain={vhost.domain || vhost.id || ''} 
                        applicationId={vhost.id || ''}
                      />
                    </div>
                  </div>
                ) : (
                  /* Scrollable main content */
                  <div className="flex-1 overflow-y-auto">
                    <div className="px-6 lg:px-8 py-8 space-y-8">
                  {/* Overview Section */}
                  <section id="section-overview" className="space-y-6">
                    <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Overview</h2>
                    
                    {/* Status Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Status</span>
                          <Shield className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="flex items-center space-x-2">
                          {vhost.enabled !== false ? (
                            <>
                              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-lg font-semibold text-green-700">Active</span>
                            </>
                          ) : (
                            <>
                              <div className="h-2 w-2 bg-red-500 rounded-full" />
                              <span className="text-lg font-semibold text-red-700">Disabled</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Type</span>
                          {getTypeIcon(vhost.type)}
                        </div>
                        <p className="text-lg font-semibold text-gray-900 capitalize">{vhost.type}</p>
                      </div>
                      
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Created</span>
                          <Calendar className="h-4 w-4 text-gray-400" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                          {vhost.created_at || vhost.createdAt
                            ? new Date(vhost.created_at || vhost.createdAt).toLocaleDateString()
                            : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Type-specific configuration cards */}
                    {vhost.type === 'static' && (
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-medium text-gray-900">Static Site Configuration</h4>
                          {vhost.files_exist === false && (
                            <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 px-3 py-1 rounded-lg">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm font-medium">Files Missing</span>
                            </div>
                          )}
                          {vhost.files_exist === true && (
                            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-lg">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">Files Exist</span>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Index File</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={indexFile}
                                onChange={(e) => setIndexFile(e.target.value)}
                                placeholder="index.html"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <p className="text-base font-medium text-gray-900">{vhost.index_file || 'index.html'}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Error File</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={errorFile}
                                onChange={(e) => setErrorFile(e.target.value)}
                                placeholder="404.html (optional)"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <p className="text-base font-medium text-gray-900">{vhost.error_file || 'Not configured'}</p>
                            )}
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm text-gray-600">Static Files Path</p>
                            <div className="space-y-1">
                              {vhost.static_path && (
                                <div>
                                  <span className="text-xs text-gray-500">Container:</span>
                                  <code className="text-sm bg-gray-100 px-2 py-0.5 rounded ml-2 text-gray-800">
                                    {vhost.static_path}
                                  </code>
                                </div>
                              )}
                              {vhost.host_static_path && (
                                <div>
                                  <span className="text-xs text-gray-500">Host:</span>
                                  <code className="text-sm bg-gray-100 px-2 py-0.5 rounded ml-2 text-gray-800">
                                    {vhost.host_static_path}
                                  </code>
                                </div>
                              )}
                            </div>
                          </div>
                          {vhost.actual_domain && vhost.actual_domain !== vhost.domain && (
                            <div className="md:col-span-2">
                              <p className="text-sm text-gray-600">Deployed Domain</p>
                              <p className="text-sm text-yellow-700 bg-yellow-50 px-3 py-1 rounded-lg inline-block">
                                <AlertTriangle className="h-3 w-3 inline mr-1" />
                                Files deployed for: <strong>{vhost.actual_domain}</strong>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {vhost.type === 'proxy' && (
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-4">Proxy Configuration</h4>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                            <code className="text-sm bg-white px-3 py-1 rounded-lg border border-gray-200">
                              {vhost.target || 'Not configured'}
                            </code>
                          </div>
                          {vhost.preserve_host && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Shield className="h-4 w-4 text-blue-500" />
                              <span>Preserving original host header</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {vhost.type === 'container' && (
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Container Configuration</h4>
                        {isEditing ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Docker Image
                                  {vhost.containerConfig?.image && containerImage !== vhost.containerConfig.image && (
                                    <span className="ml-2 text-xs text-amber-600">
                                      (Container will be rebuilt with new image)
                                    </span>
                                  )}
                                </label>
                                <input
                                  type="text"
                                  value={containerImage}
                                  onChange={(e) => setContainerImage(e.target.value)}
                                  placeholder="nginx:latest"
                                  className="w-full px-3 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                {vhost.containerConfig?.image && containerImage !== vhost.containerConfig.image && (
                                  <p className="mt-1 text-xs text-gray-500">
                                    Current: {vhost.containerConfig.image}
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Container Port</label>
                                <input
                                  type="number"
                                  value={containerPort}
                                  onChange={(e) => setContainerPort(parseInt(e.target.value) || 3000)}
                                  placeholder="3000"
                                  className="w-full px-3 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">CPU Limit</label>
                                <input
                                  type="text"
                                  value={containerCpuLimit}
                                  onChange={(e) => setContainerCpuLimit(e.target.value)}
                                  placeholder="0.5 or 500m"
                                  className="w-full px-3 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">e.g., 0.5 (half CPU) or 2 (2 CPUs)</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Memory Limit</label>
                                <input
                                  type="text"
                                  value={containerMemoryLimit}
                                  onChange={(e) => setContainerMemoryLimit(e.target.value)}
                                  placeholder="512m or 1g"
                                  className="w-full px-3 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">e.g., 512m, 1g, 2g</p>
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Restart Policy</label>
                              <select
                                value={containerRestartPolicy}
                                onChange={(e) => setContainerRestartPolicy(e.target.value)}
                                className="w-full px-3 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="no">No</option>
                                <option value="always">Always</option>
                                <option value="on-failure">On Failure</option>
                                <option value="unless-stopped">Unless Stopped</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Environment Variables</label>
                              <div className="space-y-2">
                                {containerEnv.map((env, index) => (
                                  <div key={index} className="flex gap-2">
                                    <input
                                      type="text"
                                      value={env.key}
                                      onChange={(e) => {
                                        const newEnv = [...containerEnv];
                                        newEnv[index].key = e.target.value;
                                        setContainerEnv(newEnv);
                                      }}
                                      placeholder="KEY"
                                      className="flex-1 px-3 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <input
                                      type="text"
                                      value={env.value}
                                      onChange={(e) => {
                                        const newEnv = [...containerEnv];
                                        newEnv[index].value = e.target.value;
                                        setContainerEnv(newEnv);
                                      }}
                                      placeholder="VALUE"
                                      className="flex-1 px-3 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <button
                                      onClick={() => setContainerEnv(containerEnv.filter((_, i) => i !== index))}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => setContainerEnv([...containerEnv, { key: '', value: '' }])}
                                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg text-sm"
                                >
                                  <Plus className="h-4 w-4" />
                                  Add Environment Variable
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          vhost.containerConfig && (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-medium text-gray-700">Image</p>
                                  <code className="text-sm text-gray-600">{vhost.containerConfig.image}</code>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-700">Port</p>
                                  <code className="text-sm text-gray-600">{vhost.containerConfig.port}</code>
                                </div>
                              </div>
                              
                              {(vhost.containerConfig.cpuLimit || vhost.containerConfig.memoryLimit) && (
                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                                  {vhost.containerConfig.cpuLimit && (
                                    <div>
                                      <p className="text-sm font-medium text-gray-700">CPU Limit</p>
                                      <code className="text-sm text-gray-600">{vhost.containerConfig.cpuLimit}</code>
                                    </div>
                                  )}
                                  {vhost.containerConfig.memoryLimit && (
                                    <div>
                                      <p className="text-sm font-medium text-gray-700">Memory Limit</p>
                                      <code className="text-sm text-gray-600">{vhost.containerConfig.memoryLimit}</code>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {vhost.containerConfig.env && vhost.containerConfig.env.length > 0 && (
                                <div className="pt-3 border-t border-gray-200">
                                  <p className="text-sm font-medium text-gray-700 mb-2">Environment Variables</p>
                                  <div className="space-y-1">
                                    {vhost.containerConfig.env.map((env: any, index: number) => (
                                      <div key={index} className="text-sm">
                                        <code className="text-gray-600">{env.key}={env.value}</code>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Container Management */}
                              <ContainerManagement vhost={vhost} />
                            </div>
                          )
                        )}
                      </div>
                    )}
                    
                    {vhost.type === 'loadbalancer' && (
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Load Balancer Configuration</h4>
                        {(() => {
                          const backends = vhost.backendConfigs || (vhost.backends?.map((url: string) => ({ url }))) || [];
                          return backends.length > 0 ? (
                            <div className="space-y-3">
                              <p className="text-sm text-gray-600">
                                {backends.length} backend server{backends.length !== 1 ? 's' : ''} configured
                              </p>
                              <div className="space-y-2">
                                {backends.map((backend: any, index: number) => (
                                  <div key={index} className="bg-white rounded-lg border border-gray-200 p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3">
                                        {backend.enabled !== false ? (
                                          <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        <code className="text-sm">{backend.url}</code>
                                        {backend.label && (
                                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                            {backend.label}
                                          </span>
                                        )}
                                      </div>
                                      {backend.isLocal && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                          Local
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No backends configured</p>
                          );
                        })()}
                      </div>
                    )}
                  </section>
                  
                  {/* Domains Section */}
                  <section id="section-domains" className="space-y-6">
                    <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Domain Configuration</h2>
                    
                    {/* Primary Domain */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Primary Domain
                      </label>
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={domain}
                            onChange={(e) => {
                              setDomain(e.target.value);
                              validateDomain(e.target.value);
                            }}
                            className={`w-full px-4 py-3 bg-white/60 backdrop-blur-sm border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              domainError ? 'border-red-300' : 'border-white/20'
                            }`}
                            placeholder="example.com"
                          />
                          {domainError && (
                            <p className="text-sm text-red-600">{domainError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <code className="text-lg bg-white/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
                            {vhost.domain || 'Not configured'}
                          </code>
                          <button
                            onClick={() => copyToClipboard(vhost.domain)}
                            className="p-2 hover:bg-white/60 rounded-lg transition-colors"
                            title="Copy to clipboard"
                          >
                            <Copy className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Domain Aliases */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Domain Aliases
                      </label>
                      {isEditing ? (
                        <div className="space-y-3">
                          {aliases.map((alias, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={alias}
                                onChange={(e) => {
                                  const newAliases = [...aliases];
                                  newAliases[index] = e.target.value;
                                  setAliases(newAliases);
                                  validateAlias(e.target.value, index);
                                }}
                                className={`flex-1 px-4 py-3 bg-white/60 backdrop-blur-sm border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                  aliasErrors[index] ? 'border-red-300' : 'border-white/20'
                                }`}
                              />
                              <button
                                onClick={() => removeAlias(index)}
                                className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          {aliasErrors && Object.entries(aliasErrors).map(([index, error]) => (
                            <p key={index} className="text-sm text-red-600">{error}</p>
                          ))}
                          
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newAlias}
                              onChange={(e) => {
                                setNewAlias(e.target.value);
                                setNewAliasError('');
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && addAlias()}
                              placeholder="Add new alias"
                              className={`flex-1 px-4 py-3 bg-white/60 backdrop-blur-sm border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                newAliasError ? 'border-red-300' : 'border-white/20'
                              }`}
                            />
                            <button
                              onClick={addAlias}
                              className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          {newAliasError && (
                            <p className="text-sm text-red-600">{newAliasError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {vhost.aliases && vhost.aliases.length > 0 ? (
                            vhost.aliases.map((alias: string, index: number) => (
                              <div
                                key={index}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-xl border border-white/20"
                              >
                                <Link className="h-3 w-3 text-gray-500" />
                                <span className="text-sm">{alias}</span>
                                <button
                                  onClick={() => copyToClipboard(alias)}
                                  className="ml-1 hover:text-gray-700"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500">No aliases configured</p>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                  
                  {/* Metrics Section */}
                  <section id="section-metrics" className="space-y-6">
                    <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Hosting Metrics</h2>
                    <MetricsSection domain={vhost?.domain} />
                  </section>
                  
                  {/* Settings Section */}
                  <section id="section-settings" className="space-y-6">
                    <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Settings</h2>
                    
                    {/* Customer Assignment */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Customer ID
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={customerId}
                          onChange={(e) => setCustomerId(e.target.value)}
                          className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="customer-123"
                        />
                      ) : (
                        <code className="text-sm bg-white/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
                          {vhost.customerId || 'Not assigned'}
                        </code>
                      )}
                    </div>
                    
                    {/* Status Toggle */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Application Status
                      </label>
                      {isEditing ? (
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setEnabled(e.target.checked)}
                            className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">
                            {enabled ? 'Application is enabled' : 'Application is disabled'}
                          </span>
                        </label>
                      ) : (
                        <div className="flex items-center gap-2">
                          {vhost.enabled !== false ? (
                            <>
                              <CheckCircle className="h-5 w-5 text-green-500" />
                              <span className="text-sm text-green-700">Enabled</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-5 w-5 text-red-500" />
                              <span className="text-sm text-red-700">Disabled</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    
                    
                    {/* Type-specific settings */}
                    {vhost.type === 'proxy' && isEditing && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Proxy Target URL
                          </label>
                          <input
                            type="text"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="http://localhost:3000"
                          />
                        </div>
                        
                        <div className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={preserveHost}
                              onChange={(e) => setPreserveHost(e.target.checked)}
                              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-700">Preserve Host Header</span>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Forward the original host header to the backend server (useful for multi-tenant applications)
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}
                    
                    {vhost.type === 'loadbalancer' && isEditing && (
                      <div className="space-y-6">
                        {/* Backend Servers */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Backend Servers
                          </label>
                          <div className="space-y-3">
                            {backendConfigs.map((backend, index) => (
                              <div key={index} className="bg-white/60 backdrop-blur-sm rounded-xl border border-white/20 p-4">
                                {editingBackendIndex === index ? (
                                  <div className="space-y-3">
                                    <input
                                      type="text"
                                      value={backend.url}
                                      onChange={(e) => updateBackend(index, { ...backend, url: e.target.value })}
                                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg"
                                      placeholder="http://backend-server:port"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                      <input
                                        type="text"
                                        value={backend.label || ''}
                                        onChange={(e) => updateBackend(index, { ...backend, label: e.target.value })}
                                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                                        placeholder="e.g., variant-a, beta"
                                      />
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={backend.enabled !== false}
                                          onChange={(e) => updateBackend(index, { ...backend, enabled: e.target.checked })}
                                          className="h-4 w-4"
                                        />
                                        <span className="text-sm">Enabled</span>
                                      </label>
                                    </div>
                                    <div className="border-t pt-3">
                                      <h6 className="text-xs font-medium text-gray-700 mb-2">Health Check Configuration</h6>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-xs text-gray-600 mb-0.5">Health Path</label>
                                          <input
                                            type="text"
                                            value={backend.healthCheck?.path || '/health'}
                                            onChange={(e) => {
                                              const updatedBackends = [...backendConfigs];
                                              updatedBackends[index] = {
                                                ...backend,
                                                healthCheck: {
                                                  ...backend.healthCheck!,
                                                  path: e.target.value
                                                }
                                              };
                                              setBackendConfigs(updatedBackends);
                                            }}
                                            className="w-full px-2 py-1 text-sm bg-white border border-gray-300 rounded"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-600 mb-0.5">Interval (s)</label>
                                          <input
                                            type="number"
                                            value={backend.healthCheck?.interval || 10}
                                            onChange={(e) => {
                                              const updatedBackends = [...backendConfigs];
                                              updatedBackends[index] = {
                                                ...backend,
                                                healthCheck: {
                                                  ...backend.healthCheck!,
                                                  interval: parseInt(e.target.value)
                                                }
                                              };
                                              setBackendConfigs(updatedBackends);
                                            }}
                                            className="w-full px-2 py-1 text-sm bg-white border border-gray-300 rounded"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-3">
                                      <button
                                        onClick={() => setEditingBackendIndex(null)}
                                        className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                      >
                                        Done
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      {backend.enabled !== false ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                      )}
                                      <code className="text-sm">{backend.url}</code>
                                      {backend.label && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                          {backend.label}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setEditingBackendIndex(index)}
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </button>
                                      {confirmDeleteBackend === index ? (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-red-600">Delete?</span>
                                          <button
                                            onClick={() => removeBackend(index)}
                                            className="text-xs text-red-600 hover:text-red-700"
                                          >
                                            Yes
                                          </button>
                                          <button
                                            onClick={() => setConfirmDeleteBackend(null)}
                                            className="text-xs text-gray-600 hover:text-gray-700"
                                          >
                                            No
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setConfirmDeleteBackend(index)}
                                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            
                            {/* Add New Backend */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                              <h5 className="text-sm font-medium text-gray-700">Add New Backend</h5>
                              <input
                                type="text"
                                value={newBackend.url}
                                onChange={(e) => setNewBackend({ ...newBackend, url: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg"
                                placeholder="http://backend-server:port"
                              />
                              <div className="grid grid-cols-2 gap-3">
                                <input
                                  type="text"
                                  value={newBackend.label || ''}
                                  onChange={(e) => setNewBackend({ ...newBackend, label: e.target.value })}
                                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                                  placeholder="Label (optional)"
                                />
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={newBackend.isLocal}
                                    onChange={(e) => setNewBackend({ ...newBackend, isLocal: e.target.checked })}
                                    className="h-4 w-4"
                                  />
                                  <span className="text-sm">Local Backend</span>
                                </label>
                              </div>
                              {newBackendError && (
                                <p className="text-sm text-red-600">{newBackendError}</p>
                              )}
                              <button
                                onClick={addBackend}
                                className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700"
                              >
                                <Plus className="h-4 w-4 inline mr-2" />
                                Add Backend
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Sticky Sessions */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sticky Session Duration (seconds)
                          </label>
                          <input
                            type="number"
                            value={stickySessionDuration}
                            onChange={(e) => setStickySessionDuration(parseInt(e.target.value))}
                            className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="3600"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            How long to maintain session affinity (0 to disable)
                          </p>
                        </div>
                        
                        {/* Routing Rules */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Advanced Routing Rules
                          </label>
                          <div className="space-y-3">
                            {routingRules.map((rule, index) => (
                              <div key={index} className="bg-white/60 backdrop-blur-sm rounded-xl border border-white/20 p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">
                                    {rule.type === 'cookie' ? '🍪' : rule.type === 'header' ? '📋' : '❓'} 
                                    {' '}{rule.type} Rule #{index + 1}
                                  </span>
                                  <button
                                    onClick={() => removeRoutingRule(index)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="text-sm text-gray-600">
                                  <p>Match: {rule.name} {rule.matchType} "{rule.value}"</p>
                                  <p>Target: {rule.targetLabel}</p>
                                </div>
                              </div>
                            ))}
                            
                            {/* Add New Rule */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                              <h5 className="text-sm font-medium text-gray-700">Add Routing Rule</h5>
                              <div className="grid grid-cols-2 gap-3">
                                <select
                                  value={newRule.type}
                                  onChange={(e) => setNewRule({ ...newRule, type: e.target.value as any })}
                                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                                >
                                  <option value="cookie">Cookie</option>
                                  <option value="header">Header</option>
                                  <option value="query">Query Parameter</option>
                                </select>
                                <select
                                  value={newRule.matchType}
                                  onChange={(e) => setNewRule({ ...newRule, matchType: e.target.value as any })}
                                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                                >
                                  <option value="exact">Exact Match</option>
                                  <option value="prefix">Prefix Match</option>
                                  <option value="regex">Regex Match</option>
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <input
                                  type="text"
                                  value={newRule.name}
                                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                                  placeholder="Name (e.g., user_id)"
                                />
                                <input
                                  type="text"
                                  value={newRule.value}
                                  onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg"
                                  placeholder="Value to match"
                                />
                              </div>
                              <input
                                type="text"
                                value={newRule.targetLabel}
                                onChange={(e) => setNewRule({ ...newRule, targetLabel: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg"
                                placeholder="Target backend label"
                              />
                              <button
                                onClick={addRoutingRule}
                                className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700"
                              >
                                <Plus className="h-4 w-4 inline mr-2" />
                                Add Rule
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Delete Confirmation Modal */}
              <AnimatePresence>
                {showDeleteModal && (
                  <>
                    <motion.div
                      className="fixed inset-0 bg-gray-500 bg-opacity-75 z-[70]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => {
                        setShowDeleteModal(false);
                        setDeleteConfirmation('');
                        setDeleteError('');
                      }}
                    />
                    <motion.div
                      className="fixed inset-0 z-[71] flex items-center justify-center p-4"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                          </div>
                          <div className="ml-4 flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              Delete Application
                            </h3>
                            <div className="mt-4">
                              <p className="text-sm text-gray-500">
                                This action cannot be undone. This will permanently delete the application
                                and all associated data.
                              </p>
                              <p className="mt-4 text-sm font-medium text-gray-700">
                                Please type <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                                  {vhost.domain}
                                </span> to confirm:
                              </p>
                              <input
                                type="text"
                                value={deleteConfirmation}
                                onChange={(e) => {
                                  setDeleteConfirmation(e.target.value);
                                  setDeleteError('');
                                }}
                                placeholder="Type the domain name"
                                className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                              />
                              {deleteError && (
                                <p className="mt-2 text-sm text-red-600">{deleteError}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-6 flex flex-row-reverse gap-3">
                          <button
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                            className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium shadow-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                          </button>
                          <button
                            onClick={() => {
                              setShowDeleteModal(false);
                              setDeleteConfirmation('');
                              setDeleteError('');
                            }}
                            className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}