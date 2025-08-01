import React, { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { hostingAPI } from "../services/hosting-api";
import { toast } from "sonner";

// Metrics component
function MetricsSection({ subdomain }: { subdomain?: string }) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['vhost-metrics', subdomain],
    queryFn: () => subdomain ? hostingAPI.getVHostMetrics(subdomain) : null,
    enabled: !!subdomain,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (!subdomain || isLoading) {
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
  
  // Form states
  const [domain, setDomain] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [newAlias, setNewAlias] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [target, setTarget] = useState('');
  
  // Validation errors
  const [domainError, setDomainError] = useState('');
  const [aliasErrors, setAliasErrors] = useState<Record<number, string>>({});
  const [newAliasError, setNewAliasError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Initialize form when vhost changes
  React.useEffect(() => {
    if (vhost) {
      setDomain(vhost.domain || `${vhost.subdomain}.spinforge.localhost`);
      setAliases(vhost.aliases || []);
      setCustomerId(vhost.customerId || '');
      setEnabled(vhost.enabled !== false);
      setTarget(vhost.target || '');
      // Clear errors
      setDomainError('');
      setAliasErrors({});
      setNewAliasError('');
      setDeleteError('');
    }
  }, [vhost]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => hostingAPI.updateVHost(vhost.subdomain, data),
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
    mutationFn: () => hostingAPI.deleteVHost(vhost.subdomain),
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
      v.subdomain !== vhost.subdomain && 
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
      v.subdomain !== vhost.subdomain && 
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

    updateMutation.mutate({
      domain,
      aliases,
      customerId,
      enabled,
      target,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const isValidDomain = (domain: string) => {
    if (!domain) return false;
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    return domainRegex.test(domain);
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
      v.subdomain !== vhost.subdomain && 
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
    const expectedDomain = vhost.domain || `${vhost.subdomain}.spinforge.localhost`;
    if (deleteConfirmation !== expectedDomain) {
      setDeleteError('Please type the domain name exactly as shown');
      return;
    }
    deleteMutation.mutate();
  };

  const handleRemoveAlias = (aliasToRemove: string) => {
    setAliases(aliases.filter(alias => alias !== aliasToRemove));
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
  const siteUrl = vhost.domain || `${vhost.subdomain}.spinforge.localhost`;

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
                              {vhost.subdomain}
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
                                  setDomain(vhost.domain || `${vhost.subdomain}.spinforge.localhost`);
                                  setAliases(vhost.aliases || []);
                                  setCustomerId(vhost.customerId || '');
                                  setEnabled(vhost.enabled !== false);
                                  setTarget(vhost.target || '');
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
                                <dd className="text-sm text-gray-900 font-medium">{vhost.subdomain}</dd>
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
                          <MetricsSection subdomain={vhost?.subdomain} />
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
                          Please type <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{vhost?.domain || `${vhost?.subdomain}.spinforge.localhost`}</span> to confirm:
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
                      disabled={deleteMutation.isPending || deleteConfirmation !== (vhost?.domain || `${vhost?.subdomain}.spinforge.localhost`)}
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