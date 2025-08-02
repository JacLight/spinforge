import React, { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { hostingAPI } from "../services/hosting-api";
import { toast } from "sonner";
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
} from "lucide-react";

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

interface ApplicationDrawerProps {
  vhost: any | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ApplicationDrawerV2({ vhost, isOpen, onClose, onRefresh }: ApplicationDrawerProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  
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
  const [backendConfigs, setBackendConfigs] = useState<BackendConfig[]>([]);
  const [editingBackendIndex, setEditingBackendIndex] = useState<number | null>(null);
  const [confirmDeleteBackend, setConfirmDeleteBackend] = useState<number | null>(null);
  
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

    // Validate all aliases
    aliases.forEach((alias, index) => {
      if (!validateAlias(alias, index)) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      return;
    }

    const updateData: any = {
      domain,
      aliases,
      customerId,
      enabled,
    };

    if (vhost.type === 'proxy') {
      updateData.target = target;
    }

    if (vhost.type === 'loadbalancer') {
      updateData.backendConfigs = backendConfigs;
      updateData.routingRules = routingRules; // Always send routing rules, even if empty
      updateData.stickySessionDuration = stickySessionDuration;
    }

    updateMutation.mutate(updateData);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const isValidDomain = (domain: string) => {
    if (!domain) return false;
    // Just check it has at least one character and no spaces
    return domain.length > 0 && !domain.includes(' ');
  };

  const handleAddAlias = () => {
    if (!newAlias) return;
    
    if (!isValidDomain(newAlias)) {
      setNewAliasError('Please enter a valid domain');
      return;
    }

    if (aliases.includes(newAlias) || newAlias === domain) {
      setNewAliasError('This domain is already in use for this site');
      return;
    }

    // Check if alias is used by another site
    const isUsedElsewhere = allVhosts.some(v => 
      v.id !== vhost.id && 
      (v.domain === newAlias || v.aliases?.includes(newAlias))
    );
    if (isUsedElsewhere) {
      setNewAliasError('This domain is already in use by another site');
      return;
    }

    setAliases([...aliases, newAlias]);
    setNewAlias('');
    setNewAliasError('');
  };

  const handleDelete = () => {
    const expectedDomain = vhost.domain || '';
    if (deleteConfirmation !== expectedDomain) {
      setDeleteError('Please type the domain name exactly as shown');
      return;
    }
    deleteMutation.mutate();
  };

  const handleRemoveAlias = (aliasToRemove: string) => {
    setAliases(aliases.filter(alias => alias !== aliasToRemove));
  };

  const handleAddBackend = () => {
    if (!newBackend.url) return;

    // Different validation for local vs external backends
    if (newBackend.isLocal) {
      // For local backends, validate it's a valid domain and exists in the system
      if (!newBackend.url.match(/^[a-zA-Z0-9][a-zA-Z0-9-_.]*$/)) {
        setNewBackendError('Please enter a valid domain name');
        return;
      }
      
      // Check if the domain exists in the SpinForge system
      const domainExists = allVhosts.some(v => 
        v.domain === newBackend.url || 
        v.aliases?.includes(newBackend.url)
      );
      
      if (!domainExists) {
        setNewBackendError(`Domain "${newBackend.url}" not found in SpinForge`);
        return;
      }
    } else {
      // For external backends, validate full URL
      try {
        new URL(newBackend.url);
      } catch {
        setNewBackendError('Please enter a valid URL');
        return;
      }
    }

    if (backendConfigs.some(b => b.url === newBackend.url)) {
      setNewBackendError('This backend is already added');
      return;
    }

    // Validate health check path
    if (!newBackend.healthCheck?.path.startsWith('/')) {
      setNewBackendError('Health check path must start with /');
      return;
    }

    setBackendConfigs([...backendConfigs, { ...newBackend }]);
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

  const handleRemoveBackend = (index: number) => {
    setBackendConfigs(backendConfigs.filter((_, i) => i !== index));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'static':
        return FolderOpen;
      case 'proxy':
        return Network;
      case 'container':
        return Package;
      case 'loadbalancer':
        return Server;
      default:
        return Globe;
    }
  };

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'static':
        return { color: 'blue', label: 'Static Site', description: 'Files served directly from disk' };
      case 'proxy':
        return { color: 'green', label: 'Reverse Proxy', description: 'Requests forwarded to target URL' };
      case 'container':
        return { color: 'purple', label: 'Container', description: 'Dockerized application' };
      case 'loadbalancer':
        return { color: 'orange', label: 'Load Balancer', description: 'Traffic distributed across servers' };
      default:
        return { color: 'gray', label: 'Unknown', description: '' };
    }
  };

  if (!vhost) return null;

  const Icon = getTypeIcon(vhost.type);
  const typeInfo = getTypeInfo(vhost.type);
  const siteUrl = vhost.domain || '';

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-3xl">
                  <div className="flex h-full flex-col bg-white shadow-2xl">
                    {/* Header */}
                    <div className="bg-white px-6 py-5 border-b border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg bg-${typeInfo.color}-50`}>
                            <Icon className={`h-6 w-6 text-${typeInfo.color}-600`} />
                          </div>
                          <div>
                            <Dialog.Title className="text-xl font-semibold text-gray-900">
                              {vhost.id}
                            </Dialog.Title>
                            <p className="text-sm text-gray-500 mt-0.5">{typeInfo.description}</p>
                          </div>
                        </div>
                        <button
                          onClick={onClose}
                          className="rounded-lg p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      {/* Action Bar */}
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <a
                            href={`http://${siteUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Visit Site
                          </a>
                          <button
                            onClick={onRefresh}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                          </button>
                        </div>
                        <div className="flex items-center space-x-2">
                          {!isEditing ? (
                            <button
                              onClick={() => setIsEditing(true)}
                              className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                            >
                              <Edit2 className="h-4 w-4" />
                              Edit
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={handleSave}
                                disabled={updateMutation.isPending}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
                              >
                                <Save className="h-4 w-4" />
                                Save Changes
                              </button>
                              <button
                                onClick={() => {
                                  setIsEditing(false);
                                  // Reset form
                                  setDomain(vhost.domain || '');
                                  setAliases(vhost.aliases || []);
                                  setCustomerId(vhost.customerId || '');
                                  setEnabled(vhost.enabled !== false);
                                  setTarget(vhost.target || '');
                                  
                                  // Reset backend configs
                                  if (vhost.backendConfigs) {
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
                                  setRoutingRules(vhost.routingRules || []);
                                  setNewRule({
                                    type: 'cookie',
                                    name: '',
                                    matchType: 'exact',
                                    value: '',
                                    targetLabel: '',
                                    priority: 1,
                                  });
                                  setStickySessionDuration(vhost.stickySessionDuration || 3600);
                                  // Reset backend editing states
                                  setEditingBackendIndex(null);
                                  setConfirmDeleteBackend(null);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Quick Navigation */}
                      <div className="mt-4 flex space-x-1">
                        {[
                          { id: 'overview', label: 'Overview', icon: Info },
                          { id: 'domains', label: 'Domains', icon: Globe },
                          { id: 'metrics', label: 'Metrics', icon: ChevronRight },
                          { id: 'settings', label: 'Settings', icon: Shield }
                        ].map((section) => (
                          <button
                            key={section.id}
                            onClick={() => {
                              document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-3 py-2 text-sm font-medium rounded-lg transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-1"
                          >
                            <section.icon className="h-3 w-3" />
                            {section.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Content - All sections visible */}
                    <div className="flex-1 overflow-y-auto">
                      <div className="p-6 space-y-8">
                        {/* Overview Section */}
                        <section id="section-overview" className="space-y-6">
                          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Overview</h2>
                          {/* Status Cards */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">Status</span>
                                <Shield className="h-4 w-4 text-gray-400" />
                              </div>
                              <div className="flex items-center space-x-2">
                                {vhost.enabled !== false ? (
                                  <>
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                    <span className="text-lg font-semibold text-green-700">Active</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-5 w-5 text-gray-400" />
                                    <span className="text-lg font-semibold text-gray-500">Disabled</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">Type</span>
                                <Icon className="h-4 w-4 text-gray-400" />
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-${typeInfo.color}-100 text-${typeInfo.color}-700`}>
                                  {typeInfo.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Details Section */}
                          <div className="bg-white border border-gray-200 rounded-lg">
                            <div className="px-4 py-3 border-b border-gray-200">
                              <h3 className="text-sm font-semibold text-gray-900">Application Details</h3>
                            </div>
                            <dl className="divide-y divide-gray-200">
                              <div className="px-4 py-4 flex items-center">
                                <dt className="flex items-center text-sm font-medium text-gray-500 w-40">
                                  <Tag className="h-4 w-4 mr-2" />
                                  Site Name
                                </dt>
                                <dd className="text-sm text-gray-900 font-medium">{vhost.id}</dd>
                              </div>
                              
                              <div className="px-4 py-4 flex items-center">
                                <dt className="flex items-center text-sm font-medium text-gray-500 w-40">
                                  <Link className="h-4 w-4 mr-2" />
                                  Primary Domain
                                </dt>
                                <dd className="flex items-center space-x-2">
                                  <span className="text-sm text-gray-900">{siteUrl}</span>
                                  <button
                                    onClick={() => handleCopy(siteUrl)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </dd>
                              </div>

                              <div className="px-4 py-4 flex items-center">
                                <dt className="flex items-center text-sm font-medium text-gray-500 w-40">
                                  <User className="h-4 w-4 mr-2" />
                                  Customer
                                </dt>
                                <dd className="text-sm text-gray-900">{vhost.customerId || 'Not assigned'}</dd>
                              </div>

                              <div className="px-4 py-4 flex items-center">
                                <dt className="flex items-center text-sm font-medium text-gray-500 w-40">
                                  <Calendar className="h-4 w-4 mr-2" />
                                  Created
                                </dt>
                                <dd className="text-sm text-gray-900">
                                  {new Date(vhost.created_at || vhost.createdAt || '').toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </dd>
                              </div>
                            </dl>
                          </div>

                          {/* Type-specific info */}
                          {vhost.type === 'static' && vhost.files_exist !== undefined && (
                            <div className={`rounded-lg p-4 ${
                              vhost.files_exist ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
                            }`}>
                              <div className="flex items-start">
                                {vhost.files_exist ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                ) : (
                                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                                )}
                                <div className="ml-3">
                                  <h4 className={`text-sm font-medium ${
                                    vhost.files_exist ? 'text-green-900' : 'text-yellow-900'
                                  }`}>
                                    {vhost.files_exist ? 'Files Deployed' : 'Files Missing'}
                                  </h4>
                                  <p className={`text-sm mt-1 ${
                                    vhost.files_exist ? 'text-green-700' : 'text-yellow-700'
                                  }`}>
                                    {vhost.files_exist 
                                      ? 'Static files are deployed and ready to serve'
                                      : 'No files found in the deployment directory'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {vhost.type === 'proxy' && (
                            <div className="bg-gray-50 rounded-lg p-4">
                              <h4 className="text-sm font-medium text-gray-900 mb-2">Proxy Configuration</h4>
                              <div className="flex items-center space-x-2">
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                                <code className="text-sm bg-white px-2 py-1 rounded border border-gray-200">
                                  {vhost.target || 'Not configured'}
                                </code>
                              </div>
                            </div>
                          )}

                          {vhost.type === 'loadbalancer' && (
                            <div className="bg-gray-50 rounded-lg p-4">
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
                                        <div key={index} className="bg-white rounded border border-gray-200 p-3">
                                          <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center space-x-2">
                                              <Server className="h-4 w-4 text-gray-400" />
                                              <div className="flex items-center gap-2">
                                                <code className={`text-sm font-medium ${backend.enabled === false ? 'text-gray-400 line-through' : ''}`}>
                                                  {backend.url}
                                                </code>
                                                {backend.isLocal && (
                                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Local</span>
                                                )}
                                                {backend.label && (
                                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{backend.label}</span>
                                                )}
                                                {backend.enabled === false && (
                                                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Disabled</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          {backend.healthCheck && (
                                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                              <div>
                                                <span className="text-gray-500">Health check:</span>
                                                <code className="ml-1">{backend.healthCheck.path}</code>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Interval:</span>
                                                <span className="ml-1">{backend.healthCheck.interval}s</span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Timeout:</span>
                                                <span className="ml-1">{backend.healthCheck.timeout}s</span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Unhealthy threshold:</span>
                                                <span className="ml-1">{backend.healthCheck.unhealthyThreshold}</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">No backend servers configured</p>
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
                                    if (domainError) validateDomain(e.target.value);
                                  }}
                                  onBlur={() => validateDomain(domain)}
                                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                    domainError ? 'border-red-300' : 'border-gray-300'
                                  }`}
                                  placeholder="example.com"
                                />
                                {domainError && (
                                  <p className="text-sm text-red-600">{domainError}</p>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                                <Globe className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium">{domain}</span>
                                <button
                                  onClick={() => handleCopy(domain)}
                                  className="ml-auto text-gray-400 hover:text-gray-600"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Domain Aliases */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700">
                                Domain Aliases
                              </label>
                              <span className="text-xs text-gray-500">
                                {aliases.length} alias{aliases.length !== 1 ? 'es' : ''}
                              </span>
                            </div>
                            
                            {isEditing ? (
                              <div className="space-y-3">
                                {aliases.map((alias, index) => (
                                  <div key={index} className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="text"
                                        value={alias}
                                        onChange={(e) => {
                                          const newAliases = [...aliases];
                                          newAliases[index] = e.target.value;
                                          setAliases(newAliases);
                                          if (aliasErrors[index]) validateAlias(e.target.value, index);
                                        }}
                                        onBlur={() => validateAlias(alias, index)}
                                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                          aliasErrors[index] ? 'border-red-300' : 'border-gray-300'
                                        }`}
                                      />
                                      <button
                                        onClick={() => {
                                          handleRemoveAlias(alias);
                                          const newErrors = { ...aliasErrors };
                                          delete newErrors[index];
                                          setAliasErrors(newErrors);
                                        }}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                    {aliasErrors[index] && (
                                      <p className="text-sm text-red-600 ml-1">{aliasErrors[index]}</p>
                                    )}
                                  </div>
                                ))}
                                
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="text"
                                      value={newAlias}
                                      onChange={(e) => {
                                        setNewAlias(e.target.value);
                                        if (newAliasError) setNewAliasError('');
                                      }}
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleAddAlias();
                                        }
                                      }}
                                      placeholder="Add domain alias (e.g., www.example.com)"
                                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                        newAliasError ? 'border-red-300' : 'border-gray-300'
                                      }`}
                                    />
                                    <button
                                      onClick={handleAddAlias}
                                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                  </div>
                                  {newAliasError && (
                                    <p className="text-sm text-red-600 ml-1">{newAliasError}</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {aliases.length > 0 ? (
                                  aliases.map((alias, index) => (
                                    <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                                      <Globe className="h-4 w-4 text-gray-400" />
                                      <span className="text-sm">{alias}</span>
                                      <button
                                        onClick={() => handleCopy(alias)}
                                        className="ml-auto text-gray-400 hover:text-gray-600"
                                      >
                                        <Copy className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                                    <Globe className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">No domain aliases configured</p>
                                  </div>
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter customer ID"
                              />
                            ) : (
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm">{customerId || 'Not assigned'}</span>
                              </div>
                            )}
                          </div>

                          {/* Status Toggle */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Application Status
                            </label>
                            {isEditing ? (
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => setEnabled(true)}
                                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                    enabled
                                      ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  <Check className="h-4 w-4 inline mr-2" />
                                  Enabled
                                </button>
                                <button
                                  onClick={() => setEnabled(false)}
                                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                    !enabled
                                      ? 'bg-red-100 text-red-700 ring-2 ring-red-500'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  <X className="h-4 w-4 inline mr-2" />
                                  Disabled
                                </button>
                              </div>
                            ) : (
                              <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
                                enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {enabled ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Enabled
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Disabled
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Proxy Target (if applicable) */}
                          {vhost.type === 'proxy' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Proxy Target URL
                              </label>
                              {isEditing ? (
                                <input
                                  type="url"
                                  value={target}
                                  onChange={(e) => setTarget(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                  placeholder="https://example.com"
                                />
                              ) : (
                                <div className="p-3 bg-gray-50 rounded-lg">
                                  <code className="text-sm">{target || 'Not configured'}</code>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Load Balancer Backends (if applicable) */}
                          {vhost.type === 'loadbalancer' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Backend Servers
                              </label>
                              {isEditing ? (
                                <div className="space-y-3">
                                  {/* Existing backends */}
                                  {backendConfigs.map((backend, index) => (
                                    <div key={index} className={`bg-gray-50 rounded-lg p-3 border ${backend.enabled === false ? 'border-gray-300 opacity-75' : 'border-gray-200'}`}>
                                      {confirmDeleteBackend === index ? (
                                        // Delete confirmation
                                        <div className="space-y-3">
                                          <p className="text-sm text-red-600 font-medium">Are you sure you want to delete this backend?</p>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                handleRemoveBackend(index);
                                                setConfirmDeleteBackend(null);
                                              }}
                                              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                            >
                                              Yes, Delete
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setConfirmDeleteBackend(null)}
                                              className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : editingBackendIndex === index ? (
                                        // Edit mode for this backend
                                        <>
                                          <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                              <Server className="h-4 w-4 text-gray-500" />
                                              Backend #{index + 1} - Editing
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingBackendIndex(null);
                                                  // Clear any errors for this backend
                                                  const newErrors = { ...backendErrors };
                                                  delete newErrors[index];
                                                  setBackendErrors(newErrors);
                                                }}
                                                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                              >
                                                Done
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  // Reset to original values (from vhost)
                                                  if (vhost.backendConfigs) {
                                                    setBackendConfigs(vhost.backendConfigs);
                                                  }
                                                  setEditingBackendIndex(null);
                                                  const newErrors = { ...backendErrors };
                                                  delete newErrors[index];
                                                  setBackendErrors(newErrors);
                                                }}
                                                className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                          
                                          <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                              <input
                                                type="checkbox"
                                                id={`isLocal-${index}`}
                                                checked={backend.isLocal || false}
                                                onChange={(e) => {
                                                  const updatedBackends = [...backendConfigs];
                                                  updatedBackends[index] = { ...backend, isLocal: e.target.checked, url: '' };
                                                  setBackendConfigs(updatedBackends);
                                                  const newErrors = { ...backendErrors };
                                                  delete newErrors[index];
                                                  setBackendErrors(newErrors);
                                                }}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                              />
                                              <label htmlFor={`isLocal-${index}`} className="text-xs font-medium text-gray-700">
                                                This is a local SpinForge service
                                              </label>
                                            </div>
                                            
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                {backend.isLocal ? 'Domain Name' : 'Backend URL'}
                                              </label>
                                              <input
                                                type={backend.isLocal ? "text" : "url"}
                                                value={backend.url}
                                                onChange={(e) => {
                                                  const updatedBackends = [...backendConfigs];
                                                  updatedBackends[index] = { ...backend, url: e.target.value };
                                                  setBackendConfigs(updatedBackends);
                                                  if (backendErrors[index]) {
                                                    const newErrors = { ...backendErrors };
                                                    delete newErrors[index];
                                                    setBackendErrors(newErrors);
                                                  }
                                                }}
                                                onBlur={() => {
                                                  if (backend.isLocal) {
                                                    if (!backend.url.match(/^[a-zA-Z0-9][a-zA-Z0-9-_.]*$/)) {
                                                      setBackendErrors({ ...backendErrors, [index]: 'Please enter a valid domain name' });
                                                      return;
                                                    }
                                                    const domainExists = allVhosts.some(v => 
                                                      v.domain === backend.url || 
                                                      v.aliases?.includes(backend.url)
                                                    );
                                                    if (!domainExists) {
                                                      setBackendErrors({ ...backendErrors, [index]: `Domain "${backend.url}" not found in SpinForge` });
                                                    }
                                                  } else {
                                                    try {
                                                      new URL(backend.url);
                                                    } catch {
                                                      setBackendErrors({ ...backendErrors, [index]: 'Please enter a valid URL' });
                                                    }
                                                  }
                                                }}
                                                className={`block w-full rounded-md border ${
                                                  backendErrors[index] ? 'border-red-300' : 'border-gray-300'
                                                } py-1.5 px-2 text-sm font-mono`}
                                                placeholder={backend.isLocal ? "test-shop.localhost" : "http://backend.example.com:8080"}
                                              />
                                              {backendErrors[index] && (
                                                <p className="text-xs text-red-600 mt-1">{backendErrors[index]}</p>
                                              )}
                                            </div>
                                            
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Backend Label (optional)
                                              </label>
                                              <input
                                                type="text"
                                                value={backend.label || ''}
                                                onChange={(e) => {
                                                  const updatedBackends = [...backendConfigs];
                                                  updatedBackends[index] = { ...backend, label: e.target.value };
                                                  setBackendConfigs(updatedBackends);
                                                }}
                                                className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                                placeholder="e.g., variant-a, beta"
                                              />
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
                                                        healthCheck: { ...backend.healthCheck!, path: e.target.value }
                                                      };
                                                      setBackendConfigs(updatedBackends);
                                                    }}
                                                    className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-xs text-gray-600 mb-0.5">Interval (s)</label>
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    max="300"
                                                    value={backend.healthCheck?.interval || 10}
                                                    onChange={(e) => {
                                                      const updatedBackends = [...backendConfigs];
                                                      updatedBackends[index] = {
                                                        ...backend,
                                                        healthCheck: { ...backend.healthCheck!, interval: parseInt(e.target.value) || 10 }
                                                      };
                                                      setBackendConfigs(updatedBackends);
                                                    }}
                                                    className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-xs text-gray-600 mb-0.5">Timeout (s)</label>
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    value={backend.healthCheck?.timeout || 5}
                                                    onChange={(e) => {
                                                      const updatedBackends = [...backendConfigs];
                                                      updatedBackends[index] = {
                                                        ...backend,
                                                        healthCheck: { ...backend.healthCheck!, timeout: parseInt(e.target.value) || 5 }
                                                      };
                                                      setBackendConfigs(updatedBackends);
                                                    }}
                                                    className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-xs text-gray-600 mb-0.5">Unhealthy After</label>
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    value={backend.healthCheck?.unhealthyThreshold || 3}
                                                    onChange={(e) => {
                                                      const updatedBackends = [...backendConfigs];
                                                      updatedBackends[index] = {
                                                        ...backend,
                                                        healthCheck: { ...backend.healthCheck!, unhealthyThreshold: parseInt(e.target.value) || 3 }
                                                      };
                                                      setBackendConfigs(updatedBackends);
                                                    }}
                                                    className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </>
                                      ) : (
                                        // Read-only view for this backend
                                        <>
                                          <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <Server className="h-4 w-4 text-gray-500" />
                                              <div className="flex items-center gap-2">
                                                <code className={`text-sm font-medium ${backend.enabled === false ? 'text-gray-400 line-through' : ''}`}>
                                                  {backend.url}
                                                </code>
                                                {backend.isLocal && (
                                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Local</span>
                                                )}
                                                {backend.label && (
                                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{backend.label}</span>
                                                )}
                                                {backend.enabled === false && (
                                                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Disabled</span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => setEditingBackendIndex(index)}
                                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                              >
                                                <Edit2 className="h-3 w-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updatedBackends = [...backendConfigs];
                                                  updatedBackends[index] = { ...backend, enabled: !(backend.enabled !== false) };
                                                  setBackendConfigs(updatedBackends);
                                                }}
                                                className={`px-2 py-1 text-xs rounded ${
                                                  backend.enabled === false 
                                                    ? 'bg-green-600 text-white hover:bg-green-700' 
                                                    : 'bg-gray-600 text-white hover:bg-gray-700'
                                                }`}
                                              >
                                                {backend.enabled === false ? 'Enable' : 'Disable'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setConfirmDeleteBackend(index)}
                                                className="text-red-600 hover:bg-red-50 rounded p-1"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                          {backend.healthCheck && (
                                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                              <div>
                                                <span className="text-gray-500">Health check:</span>
                                                <code className="ml-1">{backend.healthCheck.path}</code>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Interval:</span>
                                                <span className="ml-1">{backend.healthCheck.interval}s</span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Timeout:</span>
                                                <span className="ml-1">{backend.healthCheck.timeout}s</span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Unhealthy after:</span>
                                                <span className="ml-1">{backend.healthCheck.unhealthyThreshold} failures</span>
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  ))}
                                  {/* Add new backend form */}
                                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 space-y-3">
                                    <h5 className="text-xs font-medium text-gray-700">Add Backend Server</h5>
                                    
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        id="isLocal"
                                        checked={newBackend.isLocal}
                                        onChange={(e) => {
                                          setNewBackend({ ...newBackend, isLocal: e.target.checked, url: '' });
                                          setNewBackendError('');
                                        }}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                      />
                                      <label htmlFor="isLocal" className="text-sm font-medium text-gray-700">
                                        This is a local SpinForge service
                                      </label>
                                    </div>
                                    
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">
                                        {newBackend.isLocal ? 'Domain Name' : 'Backend URL'}
                                      </label>
                                      <input
                                        type={newBackend.isLocal ? "text" : "url"}
                                        value={newBackend.url}
                                        onChange={(e) => {
                                          setNewBackend({ ...newBackend, url: e.target.value });
                                          if (newBackendError) setNewBackendError('');
                                        }}
                                        className={`block w-full rounded-md border ${
                                          newBackendError ? 'border-red-300' : 'border-gray-300'
                                        } py-1.5 px-2 text-sm font-mono`}
                                        placeholder={newBackend.isLocal ? "test-shop.localhost" : "http://backend.example.com:8080"}
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Backend Label (optional)
                                      </label>
                                      <input
                                        type="text"
                                        value={newBackend.label || ''}
                                        onChange={(e) => setNewBackend({
                                          ...newBackend,
                                          label: e.target.value
                                        })}
                                        className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                        placeholder="e.g., variant-a, beta"
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-0.5">Health Path</label>
                                        <input
                                          type="text"
                                          value={newBackend.healthCheck?.path || '/health'}
                                          onChange={(e) => setNewBackend({
                                            ...newBackend,
                                            healthCheck: { ...newBackend.healthCheck!, path: e.target.value }
                                          })}
                                          className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-0.5">Interval (s)</label>
                                        <input
                                          type="number"
                                          min="1"
                                          max="300"
                                          value={newBackend.healthCheck?.interval || 10}
                                          onChange={(e) => setNewBackend({
                                            ...newBackend,
                                            healthCheck: { ...newBackend.healthCheck!, interval: parseInt(e.target.value) || 10 }
                                          })}
                                          className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-0.5">Timeout (s)</label>
                                        <input
                                          type="number"
                                          min="1"
                                          max="60"
                                          value={newBackend.healthCheck?.timeout || 5}
                                          onChange={(e) => setNewBackend({
                                            ...newBackend,
                                            healthCheck: { ...newBackend.healthCheck!, timeout: parseInt(e.target.value) || 5 }
                                          })}
                                          className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-0.5">Unhealthy After</label>
                                        <input
                                          type="number"
                                          min="1"
                                          max="10"
                                          value={newBackend.healthCheck?.unhealthyThreshold || 3}
                                          onChange={(e) => setNewBackend({
                                            ...newBackend,
                                            healthCheck: { ...newBackend.healthCheck!, unhealthyThreshold: parseInt(e.target.value) || 3 }
                                          })}
                                          className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                        />
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={handleAddBackend}
                                      className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                    >
                                      Add Backend
                                    </button>
                                    
                                    {newBackendError && (
                                      <p className="text-xs text-red-600">{newBackendError}</p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {backendConfigs.length > 0 ? (
                                    backendConfigs.map((backend, index) => (
                                      <div key={index} className={`bg-gray-50 rounded-lg p-3 border ${backend.enabled === false ? 'border-gray-300 opacity-60' : 'border-gray-200'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center space-x-2">
                                            <Server className="h-4 w-4 text-gray-400" />
                                            <div className="flex items-center gap-2">
                                              <code className={`text-sm ${backend.enabled === false ? 'text-gray-400 line-through' : ''}`}>
                                                {backend.url}
                                              </code>
                                              {backend.isLocal && (
                                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Local</span>
                                              )}
                                              {backend.label && (
                                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{backend.label}</span>
                                              )}
                                              {backend.enabled === false && (
                                                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Disabled</span>
                                              )}
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => handleCopy(backend.url)}
                                            className="text-gray-400 hover:text-gray-600"
                                          >
                                            <Copy className="h-4 w-4" />
                                          </button>
                                        </div>
                                        {backend.healthCheck && (
                                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                            <div>
                                              <span className="text-gray-500">Health check:</span>
                                              <code className="ml-1">{backend.healthCheck.path}</code>
                                            </div>
                                            <div>
                                              <span className="text-gray-500">Interval:</span>
                                              <span className="ml-1">{backend.healthCheck.interval}s</span>
                                            </div>
                                            <div>
                                              <span className="text-gray-500">Timeout:</span>
                                              <span className="ml-1">{backend.healthCheck.timeout}s</span>
                                            </div>
                                            <div>
                                              <span className="text-gray-500">Unhealthy after:</span>
                                              <span className="ml-1">{backend.healthCheck.unhealthyThreshold} failures</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                                      <Server className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                      <p className="text-sm text-gray-500">No backend servers configured</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sticky Session Duration (if load balancer) */}
                          {vhost.type === 'loadbalancer' && (
                            <div className="mt-6">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Sticky Session Duration
                              </label>
                              {isEditing ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="number"
                                      min="0"
                                      max="86400"
                                      value={stickySessionDuration}
                                      onChange={(e) => setStickySessionDuration(parseInt(e.target.value) || 3600)}
                                      className="w-32 rounded-md border border-gray-300 py-1.5 px-2 text-sm"
                                    />
                                    <span className="text-sm text-gray-600">seconds</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setStickySessionDuration(300)}
                                      className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                                    >
                                      5 min
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setStickySessionDuration(1800)}
                                      className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                                    >
                                      30 min
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setStickySessionDuration(3600)}
                                      className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                                    >
                                      1 hour
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setStickySessionDuration(86400)}
                                      className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                                    >
                                      24 hours
                                    </button>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    How long users stay on the same backend server. Set to 0 to disable sticky sessions.
                                  </p>
                                </div>
                              ) : (
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <span className="text-sm">
                                    {stickySessionDuration === 0 ? 'Disabled' : 
                                     stickySessionDuration < 3600 ? `${Math.floor(stickySessionDuration / 60)} minutes` :
                                     stickySessionDuration < 86400 ? `${Math.floor(stickySessionDuration / 3600)} hour${stickySessionDuration >= 7200 ? 's' : ''}` :
                                     `${Math.floor(stickySessionDuration / 86400)} day${stickySessionDuration >= 172800 ? 's' : ''}`
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Routing Rules for A/B Testing (if load balancer) */}
                          {vhost.type === 'loadbalancer' && backendConfigs.length > 0 && (
                            <div className="mt-6">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                A/B Testing Routing Rules
                              </label>
                              {isEditing ? (
                                <div className="space-y-3">
                                  {/* Existing rules */}
                                  {routingRules.map((rule, index) => (
                                    <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 text-sm">
                                            <span className="font-semibold uppercase text-xs">{rule.type}</span>
                                            <code>{rule.name}</code>
                                            <span className="text-gray-500">{rule.matchType}</span>
                                            <code className="font-mono bg-white px-1 py-0.5 rounded text-xs">{rule.value}</code>
                                            <span className="text-gray-500">→</span>
                                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">{rule.targetLabel}</span>
                                            {rule.priority && rule.priority > 1 && (
                                              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">Priority: {rule.priority}</span>
                                            )}
                                          </div>
                                          <div className="text-xs text-gray-600 mt-1">
                                            {rule.type === 'cookie' && <span>When cookie <code>{rule.name}={rule.value}</code></span>}
                                            {rule.type === 'query' && <span>When URL has <code>?{rule.name}={rule.value}</code></span>}
                                            {rule.type === 'header' && <span>When header <code>{rule.name}: {rule.value}</code></span>}
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setRoutingRules(routingRules.filter((_, i) => i !== index))}
                                          className="text-red-600 hover:bg-red-50 rounded p-1"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* Add new rule form */}
                                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 space-y-3">
                                    <h5 className="text-xs font-medium text-gray-700">Add Routing Rule</h5>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-0.5">Rule Type</label>
                                        <select
                                          value={newRule.type}
                                          onChange={(e) => setNewRule({ ...newRule, type: e.target.value as 'cookie' | 'query' | 'header' })}
                                          className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                        >
                                          <option value="cookie">Cookie</option>
                                          <option value="query">Query Parameter</option>
                                          <option value="header">Header</option>
                                        </select>
                                      </div>
                                      
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-0.5">
                                          {newRule.type === 'cookie' ? 'Cookie Name' : 
                                           newRule.type === 'query' ? 'Parameter Name' : 'Header Name'}
                                        </label>
                                        <input
                                          type="text"
                                          value={newRule.name}
                                          onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                                          className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                          placeholder={newRule.type === 'cookie' ? 'session_variant' : 
                                                     newRule.type === 'query' ? 'variant' : 'X-Variant'}
                                        />
                                      </div>
                                      
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-0.5">Match Type</label>
                                        <select
                                          value={newRule.matchType}
                                          onChange={(e) => setNewRule({ ...newRule, matchType: e.target.value as 'exact' | 'regex' | 'prefix' })}
                                          className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                        >
                                          <option value="exact">Exact Match</option>
                                          <option value="prefix">Prefix Match</option>
                                          <option value="regex">Regular Expression</option>
                                        </select>
                                      </div>
                                      
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-0.5">Match Value</label>
                                        <input
                                          type="text"
                                          value={newRule.value}
                                          onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                                          className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs font-mono"
                                          placeholder={newRule.matchType === 'regex' ? '^(beta|test).*' : 'beta'}
                                        />
                                        {newRule.matchType === 'regex' && (
                                          <div className="mt-1 space-y-1">
                                            <p className="text-xs text-gray-500">Examples:</p>
                                            <div className="grid grid-cols-2 gap-1">
                                              {[
                                                { p: '^beta.*', d: 'Starts with' },
                                                { p: '.*(a|b).*', d: 'Contains a or b' },
                                                { p: '^v[0-9]+$', d: 'Version (v1, v2)' },
                                                { p: '[0-9]{4}', d: '4 digits' },
                                              ].map(({ p, d }) => (
                                                <button
                                                  key={p}
                                                  type="button"
                                                  onClick={() => setNewRule({ ...newRule, value: p })}
                                                  className="text-xs bg-gray-100 hover:bg-gray-200 px-1 py-0.5 rounded text-left"
                                                >
                                                  <code>{p}</code>
                                                  <span className="text-gray-500 ml-1">- {d}</span>
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-0.5">Target Backend Label</label>
                                        <select
                                          value={newRule.targetLabel}
                                          onChange={(e) => setNewRule({ ...newRule, targetLabel: e.target.value })}
                                          className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                        >
                                          <option value="">Select backend label</option>
                                          {Array.from(new Set(backendConfigs.filter(b => b.label).map(b => b.label))).map(label => (
                                            <option key={label} value={label}>{label}</option>
                                          ))}
                                        </select>
                                      </div>
                                      
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-0.5">Priority</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={newRule.priority}
                                          onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 1 })}
                                          className="block w-full rounded border border-gray-300 py-1 px-1.5 text-xs"
                                        />
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (newRule.name && newRule.value && newRule.targetLabel) {
                                          setRoutingRules([...routingRules, { ...newRule }]);
                                          setNewRule({
                                            type: 'cookie',
                                            name: '',
                                            matchType: 'exact',
                                            value: '',
                                            targetLabel: '',
                                            priority: 1,
                                          });
                                        }
                                      }}
                                      disabled={!newRule.name || !newRule.value || !newRule.targetLabel}
                                      className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Add Routing Rule
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {routingRules.length > 0 ? (
                                    routingRules.map((rule, index) => (
                                      <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="font-semibold uppercase text-xs">{rule.type}</span>
                                          <code>{rule.name}</code>
                                          <span className="text-gray-500">{rule.matchType}</span>
                                          <code>{rule.value}</code>
                                          <span className="text-gray-500">→</span>
                                          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">{rule.targetLabel}</span>
                                          {rule.priority && rule.priority > 1 && (
                                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">Priority: {rule.priority}</span>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                                      <Info className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                      <p className="text-sm text-gray-500">No routing rules configured</p>
                                      <p className="text-xs text-gray-400 mt-1">Add rules to enable A/B testing</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {!isEditing && (
                                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <div className="flex items-start">
                                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                                    <div className="ml-2">
                                      <p className="text-xs text-blue-700">
                                        Routing rules enable A/B testing by directing traffic based on cookies, query params, or headers.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Danger Zone */}
                          <div className="pt-6 border-t border-gray-200">
                            <h3 className="text-sm font-medium text-red-900 mb-4">Danger Zone</h3>
                            <button
                              onClick={() => {
                                setShowDeleteModal(true);
                                setDeleteConfirmation('');
                              }}
                              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Application
                            </button>
                          </div>
                        </section>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Transition.Root show={showDeleteModal} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setShowDeleteModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        Delete Application
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          This action cannot be undone. This will permanently delete the application and all associated data.
                        </p>
                        <p className="mt-3 text-sm font-medium text-gray-700">
                          Please type <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{vhost?.domain || ''}</span> to confirm:
                        </p>
                        <input
                          type="text"
                          value={deleteConfirmation}
                          onChange={(e) => {
                            setDeleteConfirmation(e.target.value);
                            if (deleteError) setDeleteError('');
                          }}
                          placeholder="Type the domain name"
                          className={`mt-2 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                            deleteError ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {deleteError && (
                          <p className="text-sm text-red-600 mt-1">{deleteError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending || deleteConfirmation !== (vhost?.domain || '')}
                      className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto"
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteModal(false);
                        setDeleteConfirmation('');
                      }}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </Transition.Root>
  );
}