import React, { useState, useEffect, memo, useCallback, useMemo, useRef } from 'react';
import { Shield, Globe, Server, Activity, CheckCircle, XCircle, Plus, Trash2, ExternalLink, ChevronRight, AlertTriangle, Package, Network, Edit2, Settings, Play, Square, RotateCcw, RefreshCw, FileText, Loader2, AlertCircle, Upload, FolderOpen, File, Download, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { hostingAPI } from '../../../services/hosting-api';

interface OverviewTabProps {
  vhost: any;
  isEditing: boolean;
  formData: any;
  setFormData: (data: any) => void;
}

// Memoized Load Balancer Component to prevent re-renders
const LoadBalancerSection = memo(({ 
  vhost, 
  isEditing, 
  backends, 
  stickySessionDuration,
  onBackendsChange,
  onStickySessionChange 
}: {
  vhost: any;
  isEditing: boolean;
  backends: any[];
  stickySessionDuration: number;
  onBackendsChange: (backends: any[]) => void;
  onStickySessionChange: (duration: number) => void;
}) => {
  const [editingBackendIndex, setEditingBackendIndex] = useState<number | null>(null);
  const [tempBackend, setTempBackend] = useState<any>(null);
  const [localBackends, setLocalBackends] = useState(backends);
  const [localStickyDuration, setLocalStickyDuration] = useState(stickySessionDuration);
  const [searchQuery, setSearchQuery] = useState<{[key: number]: string}>({});
  const [showSuggestions, setShowSuggestions] = useState<{[key: number]: boolean}>({});
  
  // Fetch existing applications for local backend selection
  const { data: existingApps } = useQuery({
    queryKey: ['applications'],
    queryFn: () => hostingAPI.listVHosts(),
    select: (data) => data.filter((app: any) => 
      app.type === 'container' || app.type === 'proxy' || app.type === 'static'
    )
  });

  // Only update parent when editing is done
  const handleSaveBackend = useCallback((index: number) => {
    const updatedBackends = [...localBackends];
    updatedBackends[index] = tempBackend;
    setLocalBackends(updatedBackends);
    onBackendsChange(updatedBackends);
    setEditingBackendIndex(null);
    setTempBackend(null);
  }, [localBackends, tempBackend, onBackendsChange]);

  const handleAddBackend = useCallback(() => {
    const newBackend = { 
      url: 'http://backend:3000', 
      weight: 1, 
      enabled: true,
      label: `backend-${localBackends.length + 1}`,
      isLocal: false,
      healthCheck: {
        path: '/health',
        interval: 10,
        timeout: 5,
        unhealthyThreshold: 3,
        healthyThreshold: 2
      }
    };
    const updated = [...localBackends, newBackend];
    setLocalBackends(updated);
    onBackendsChange(updated);
  }, [localBackends, onBackendsChange]);

  const handleRemoveBackend = useCallback((index: number) => {
    const updated = localBackends.filter((_, i) => i !== index);
    setLocalBackends(updated);
    onBackendsChange(updated);
  }, [localBackends, onBackendsChange]);

  // Update sticky session on blur, not on every change
  const handleStickySessionBlur = useCallback(() => {
    onStickySessionChange(localStickyDuration);
  }, [localStickyDuration, onStickySessionChange]);

  return (
    <div className="space-y-6">
      {/* Backend Servers Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Network className="h-5 w-5 text-green-500" />
          Backend Servers
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {localBackends.length} backend servers configured
            </p>
            {isEditing && (
              <button
                onClick={handleAddBackend}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Backend
              </button>
            )}
          </div>

          <div className="space-y-3">
            {localBackends.map((backend: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50">
                  {editingBackendIndex === index && isEditing ? (
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 -m-4 p-4 border-l-4 border-blue-500">
                      <div className="space-y-3">
                        {/* Modern Toggle and URL Input */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setTempBackend({ 
                                  ...(tempBackend || backend), 
                                  isLocal: !(tempBackend?.isLocal ?? backend.isLocal),
                                  url: ''
                                });
                                setSearchQuery({...searchQuery, [index]: ''});
                              }}
                              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                                (tempBackend?.isLocal ?? backend.isLocal) ? 'bg-blue-600' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                                (tempBackend?.isLocal ?? backend.isLocal) ? 'translate-x-8' : 'translate-x-1'
                              }`} />
                            </button>
                            <span className="text-sm font-medium text-gray-900">
                              {(tempBackend?.isLocal ?? backend.isLocal) ? 'Local Service' : 'External URL'}
                            </span>
                          </div>
                          
                          <div className="relative">
                            <input
                              type="text"
                              value={tempBackend?.url ?? backend.url ?? ''}
                              onChange={(e) => {
                                if (tempBackend?.isLocal ?? backend.isLocal) {
                                  setSearchQuery({...searchQuery, [index]: e.target.value});
                                  setShowSuggestions({...showSuggestions, [index]: true});
                                  if (!e.target.value) {
                                    setTempBackend({ ...(tempBackend || backend), url: '' });
                                  }
                                } else {
                                  setTempBackend({ ...(tempBackend || backend), url: e.target.value });
                                }
                              }}
                              onFocus={() => {
                                if (tempBackend?.isLocal ?? backend.isLocal) {
                                  setShowSuggestions({...showSuggestions, [index]: true});
                                }
                              }}
                              onBlur={() => {
                                setTimeout(() => {
                                  setShowSuggestions({...showSuggestions, [index]: false});
                                }, 200);
                              }}
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              placeholder={(tempBackend?.isLocal ?? backend.isLocal) ? "Search services (e.g., api, auth, db)..." : "https://api.example.com"}
                            />
                            
                            {/* Autocomplete Dropdown */}
                            {(tempBackend?.isLocal ?? backend.isLocal) && showSuggestions[index] && existingApps && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {(() => {
                                  const query = (searchQuery[index] || '').toLowerCase();
                                  const filtered = query 
                                    ? existingApps.filter((app: any) => 
                                        app.domain.toLowerCase().includes(query) ||
                                        app.type.toLowerCase().includes(query) ||
                                        (app.containerConfig?.image && app.containerConfig.image.toLowerCase().includes(query))
                                      )
                                    : existingApps;
                                  
                                  if (filtered.length === 0) {
                                    return (
                                      <div className="p-3 text-sm text-gray-500">
                                        No services found matching "{searchQuery[index]}"
                                      </div>
                                    );
                                  }
                                  
                                  return filtered.slice(0, 100).map((app: any) => {
                                    const url = app.type === 'container' 
                                      ? `http://spinforge-${app.domain.replace(/\./g, '-')}:${app.containerConfig?.port || 80}`
                                      : app.target || `http://${app.domain}`;
                                    
                                    return (
                                      <button
                                        key={app.domain}
                                        type="button"
                                        onClick={() => {
                                          setTempBackend({ ...(tempBackend || backend), url });
                                          setSearchQuery({...searchQuery, [index]: url});
                                          setShowSuggestions({...showSuggestions, [index]: false});
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between group border-b border-gray-100 last:border-0"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm text-gray-900 truncate">
                                            {app.domain}
                                          </div>
                                          <div className="text-xs text-gray-500 truncate">
                                            {app.type === 'container' && `${app.containerConfig?.image || 'Container'}`}
                                            {app.type === 'proxy' && 'Reverse Proxy'}
                                            {app.type === 'static' && 'Static Site'}
                                          </div>
                                        </div>
                                        <div className="ml-2 text-xs text-gray-400 group-hover:text-blue-600">
                                          {app.type}
                                        </div>
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Weight and Status */}
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <input
                              type="number"
                              value={tempBackend?.weight || backend.weight || 1}
                              onChange={(e) => setTempBackend({ ...(tempBackend || backend), weight: parseInt(e.target.value) || 1 })}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                              placeholder="Weight"
                              min="1"
                              max="100"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setTempBackend({ ...(tempBackend || backend), enabled: !(tempBackend?.enabled ?? backend.enabled !== false) })}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                              (tempBackend?.enabled ?? backend.enabled !== false)
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {(tempBackend?.enabled ?? backend.enabled !== false) ? 'Active' : 'Inactive'}
                          </button>
                        </div>

                        {/* Health Check Configuration */}
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            Health Check Configuration
                          </h4>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Path</label>
                              <input
                                type="text"
                                value={tempBackend?.healthCheck?.path || backend.healthCheck?.path || '/health'}
                                onChange={(e) => setTempBackend({ 
                                  ...(tempBackend || backend), 
                                  healthCheck: { ...(tempBackend?.healthCheck || backend.healthCheck), path: e.target.value }
                                })}
                                className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded text-sm focus:bg-white focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Interval (s)</label>
                              <input
                                type="number"
                                value={tempBackend?.healthCheck?.interval || backend.healthCheck?.interval || 10}
                                onChange={(e) => setTempBackend({ 
                                  ...(tempBackend || backend), 
                                  healthCheck: { ...(tempBackend?.healthCheck || backend.healthCheck), interval: parseInt(e.target.value) || 10 }
                                })}
                                className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded text-sm focus:bg-white focus:ring-1 focus:ring-blue-500"
                                min="1"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Timeout (s)</label>
                              <input
                                type="number"
                                value={tempBackend?.healthCheck?.timeout || backend.healthCheck?.timeout || 5}
                                onChange={(e) => setTempBackend({ 
                                  ...(tempBackend || backend), 
                                  healthCheck: { ...(tempBackend?.healthCheck || backend.healthCheck), timeout: parseInt(e.target.value) || 5 }
                                })}
                                className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded text-sm focus:bg-white focus:ring-1 focus:ring-blue-500"
                                min="1"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveBackend(index)}
                            className="flex-1 px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg text-sm font-medium hover:from-green-700 hover:to-green-800 transition-all"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={() => {
                              setEditingBackendIndex(null);
                              setTempBackend(null);
                              setSearchQuery({...searchQuery, [index]: ''});
                            }}
                            className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {backend.enabled !== false ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <code className="text-sm font-medium">{backend.url || `Backend ${index + 1}`}</code>
                          {backend.label && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              {backend.label}
                            </span>
                          )}
                          {backend.isLocal && (
                            <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                              Local
                            </span>
                          )}
                          <div className="flex gap-4 mt-1 text-xs text-gray-500">
                            <span>Weight: {backend.weight || 1}</span>
                            {backend.healthCheck && (
                              <span>Health: {backend.healthCheck.path}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isEditing && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingBackendIndex(index);
                              setTempBackend(backend);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveBackend(index)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Sessions */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-500" />
          Sticky Sessions
        </h3>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Keep users connected to the same backend server for session persistence.
          </p>
          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Duration (seconds)
              </label>
              <input
                type="number"
                value={localStickyDuration}
                onChange={(e) => setLocalStickyDuration(parseInt(e.target.value) || 0)}
                onBlur={handleStickySessionBlur}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="0"
                placeholder="3600 (1 hour)"
              />
              <p className="text-xs text-gray-500 mt-1">Set to 0 to disable sticky sessions</p>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 rounded-lg">
              <span className="text-sm">
                {localStickyDuration > 0 
                  ? `Enabled - ${localStickyDuration} seconds`
                  : 'Disabled'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

LoadBalancerSection.displayName = 'LoadBalancerSection';

export default function OverviewTab({ vhost, isEditing, formData, setFormData }: OverviewTabProps) {
  const [newDomain, setNewDomain] = useState('');
  
  const domains = formData.domains || [vhost.domain];

  // Domain management
  const addDomain = () => {
    if (newDomain && !domains.includes(newDomain)) {
      setFormData({ ...formData, domains: [...domains, newDomain] });
      setNewDomain('');
    }
  };

  const removeDomain = (domain: string) => {
    if (domain !== vhost.domain) {
      setFormData({ ...formData, domains: domains.filter((d: string) => d !== domain) });
    }
  };

  // Callbacks for load balancer memoized component
  const handleBackendsChange = useCallback((backends: any[]) => {
    setFormData({ ...formData, backends });
  }, [formData, setFormData]);

  const handleStickySessionChange = useCallback((duration: number) => {
    setFormData({ ...formData, stickySessionDuration: duration });
  }, [formData, setFormData]);


  return (
    <div className="space-y-6">
      {/* Status and Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Status</span>
            <Shield className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex items-center space-x-2">
            {formData.enabled ? (
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
            <Server className="h-4 w-4 text-blue-500" />
          </div>
          <span className="text-lg font-semibold text-gray-900 capitalize">{vhost.type}</span>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">SSL</span>
            <Activity className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex items-center space-x-2">
            {vhost.ssl_enabled ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm text-green-700">Enabled</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">Disabled</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* General Settings */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-500" />
          General Settings
        </h3>
        
        <div className="space-y-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">Application Status</p>
              <p className="text-xs text-gray-500">Enable or disable this application</p>
            </div>
            {isEditing ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            ) : (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                formData.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {formData.enabled ? 'Enabled' : 'Disabled'}
              </span>
            )}
          </div>

          {/* Customer ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.customerId || ''}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                placeholder="Optional customer identifier"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            ) : (
              <code className="block px-3 py-2 bg-gray-100 rounded-lg text-sm">
                {formData.customerId || 'Not set'}
              </code>
            )}
          </div>

          {/* SSL Redirect */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">Force SSL Redirect</p>
              <p className="text-xs text-gray-500">Redirect all HTTP traffic to HTTPS</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              vhost.ssl_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {vhost.ssl_enabled ? 'Active' : 'Configure SSL first'}
            </span>
          </div>
        </div>
      </div>

      {/* Domains Configuration */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Domains & Aliases
          </h3>
          {domains.length > 0 && (
            <a
              href={`https://${vhost.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Visit Site
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="space-y-4">
          {/* Primary Domain */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Primary Domain</label>
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-600" />
                <code className="text-sm font-medium">{vhost.domain}</code>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">Primary</span>
              </div>
            </div>
          </div>

          {/* Domain Aliases */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Domain Aliases</label>
            <div className="space-y-2">
              {domains.slice(1).length > 0 ? (
                domains.slice(1).map((domain: string) => (
                  <div key={domain} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <code className="text-sm">{domain}</code>
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => removeDomain(domain)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                !isEditing && (
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                    No domain aliases configured
                  </div>
                )
              )}

              {/* Add Domain Alias */}
              {isEditing && (
                <div className="pt-2">
                  <label className="block text-xs font-medium text-gray-600 mb-2">Add New Alias</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="www.example.com or subdomain.example.com"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      onKeyPress={(e) => e.key === 'Enter' && addDomain()}
                    />
                    <button
                      onClick={addDomain}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Add Alias
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Type-Specific Configuration */}
      {vhost.type === 'proxy' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ChevronRight className="h-5 w-5 text-green-500" />
            Proxy Configuration
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target URL</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.target}
                  onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="http://localhost:3000"
                />
              ) : (
                <code className="block px-3 py-2 bg-gray-100 rounded-lg text-sm">{vhost.target || 'Not configured'}</code>
              )}
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Preserve Host Header</p>
                <p className="text-xs text-gray-500">Keep original host header when forwarding</p>
              </div>
              {isEditing ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.preserveHost}
                    onChange={(e) => setFormData({ ...formData, preserveHost: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              ) : (
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  formData.preserveHost ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {formData.preserveHost ? 'Enabled' : 'Disabled'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {vhost.type === 'static' && (
        <>
          <StaticSiteManagement vhost={vhost} isEditing={isEditing} formData={formData} setFormData={setFormData} />
        </>
      )}

      {vhost.type === 'container' && (
        <>
          <ContainerManagement vhost={vhost} />
          <ContainerEnvironmentVariables 
            vhost={vhost}
            isEditing={isEditing}
            formData={formData}
            setFormData={setFormData}
          />
        </>
      )}

      {vhost.type === 'loadbalancer' && (
        <LoadBalancerSection
          vhost={vhost}
          isEditing={isEditing}
          backends={formData.backends || []}
          stickySessionDuration={formData.stickySessionDuration || 0}
          onBackendsChange={handleBackendsChange}
          onStickySessionChange={handleStickySessionChange}
        />
      )}
    </div>
  );
}

// Static Site Management Component
function StaticSiteManagement({ vhost, isEditing, formData, setFormData }: { 
  vhost: any; 
  isEditing: boolean;
  formData: any;
  setFormData: (data: any) => void;
}) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'zip'>('zip');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      
      if (uploadMethod === 'zip') {
        // Upload single zip file
        formData.append('zipFile', selectedFiles[0]);
        formData.append('extractZip', 'true');
      } else {
        // Upload multiple files
        for (let i = 0; i < selectedFiles.length; i++) {
          formData.append('files', selectedFiles[i]);
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/static/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (response.ok) {
        toast.success(
          uploadMethod === 'zip' 
            ? 'Zip file uploaded and extracted successfully!' 
            : `${selectedFiles.length} file(s) uploaded successfully!`
        );
        setShowUploadModal(false);
        setSelectedFiles(null);
        
        // Trigger a refresh to update file status
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to upload files');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClearFiles = async () => {
    if (!confirm('Are you sure you want to delete all static files? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/static/clear`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        toast.success('All static files have been deleted');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to delete files');
      }
    } catch (error) {
      console.error('Clear files error:', error);
      toast.error('Failed to delete files');
    }
  };

  return (
    <>
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Static Site Configuration
          </h3>
          {/* Files Status Badge */}
          <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
            vhost.files_exist === false 
              ? 'bg-red-100 text-red-700' 
              : vhost.files_exist === true
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {vhost.files_exist === false ? (
              <>
                <XCircle className="h-4 w-4" />
                Files Missing
              </>
            ) : vhost.files_exist === true ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Files Exist
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                Unknown Status
              </>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          {/* Editable Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Index File</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.indexFile || 'index.html'}
                  onChange={(e) => setFormData({ ...formData, indexFile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="index.html"
                />
              ) : (
                <code className="block px-3 py-2 bg-gray-100 rounded-lg text-sm">
                  {formData.indexFile || 'index.html'}
                </code>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Error Page</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.errorFile || '404.html'}
                  onChange={(e) => setFormData({ ...formData, errorFile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="404.html"
                />
              ) : (
                <code className="block px-3 py-2 bg-gray-100 rounded-lg text-sm">
                  {formData.errorFile || '404.html'}
                </code>
              )}
            </div>
          </div>

          {/* File Management Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
            >
              <Upload className="h-4 w-4" />
              Upload Files
            </button>

            <button
              onClick={handleClearFiles}
              disabled={vhost.files_exist === false}
              className={`p-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                vhost.files_exist === false
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              Clear All Files
            </button>
          </div>

          {/* Static Files Path Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Static Files Location</h4>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Document Root:</label>
                <p className="text-sm text-gray-900 font-mono">
                  {vhost.target || `/data/static/${vhost.domain.replace(/\./g, '_')}`}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Storage Folder:</label>
                <p className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                  {vhost.domain.replace(/\./g, '_')}
                </p>
              </div>
            </div>
          </div>

          {/* Files Status Messages */}
          {vhost.files_exist === false && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm text-red-800 font-medium">No files uploaded yet!</p>
                <p className="text-xs text-red-700">
                  Click "Upload Files" to deploy your static website
                </p>
              </div>
            </div>
          )}
          
          {vhost.files_exist === true && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800">Static files are deployed and serving</span>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" 
            onClick={() => {
              if (!isUploading) {
                setShowUploadModal(false);
                setSelectedFiles(null);
              }
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Upload Static Files</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Deploy your static website files
                </p>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Upload Method Selection */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setUploadMethod('zip');
                      setSelectedFiles(null);
                    }}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      uploadMethod === 'zip'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Archive className="h-5 w-5 mx-auto mb-1 text-indigo-600" />
                    <p className="text-sm font-medium">Upload ZIP</p>
                    <p className="text-xs text-gray-500">Single compressed file</p>
                  </button>
                  
                  <button
                    onClick={() => {
                      setUploadMethod('file');
                      setSelectedFiles(null);
                    }}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      uploadMethod === 'file'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <File className="h-5 w-5 mx-auto mb-1 text-indigo-600" />
                    <p className="text-sm font-medium">Upload Files</p>
                    <p className="text-xs text-gray-500">Multiple files</p>
                  </button>
                </div>

                {/* File Selection */}
                <div>
                  {uploadMethod === 'zip' ? (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select ZIP File
                      </label>
                      <input
                        ref={zipInputRef}
                        type="file"
                        accept=".zip"
                        onChange={(e) => setSelectedFiles(e.target.files)}
                        className="hidden"
                      />
                      <button
                        onClick={() => zipInputRef.current?.click()}
                        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 transition-colors"
                      >
                        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          {selectedFiles && selectedFiles[0]
                            ? selectedFiles[0].name
                            : 'Click to select ZIP file'}
                        </p>
                        {selectedFiles && selectedFiles[0] && (
                          <p className="text-xs text-gray-500 mt-1">
                            Size: {(selectedFiles[0].size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Files
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={(e) => setSelectedFiles(e.target.files)}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 transition-colors"
                      >
                        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          {selectedFiles && selectedFiles.length > 0
                            ? `${selectedFiles.length} file(s) selected`
                            : 'Click to select files'}
                        </p>
                        {selectedFiles && selectedFiles.length > 0 && (
                          <div className="mt-2 max-h-32 overflow-y-auto">
                            {Array.from(selectedFiles).slice(0, 5).map((file, idx) => (
                              <p key={idx} className="text-xs text-gray-500">
                                {file.name}
                              </p>
                            ))}
                            {selectedFiles.length > 5 && (
                              <p className="text-xs text-gray-400">
                                ...and {selectedFiles.length - 5} more
                              </p>
                            )}
                          </div>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* Upload Progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Uploading...</span>
                      <span className="text-gray-900 font-medium">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Info Message */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    {uploadMethod === 'zip' 
                      ? 'ZIP file will be automatically extracted after upload'
                      : 'All existing files will be replaced with the new upload'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFiles(null);
                  }}
                  disabled={isUploading}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFileUpload}
                  disabled={!selectedFiles || selectedFiles.length === 0 || isUploading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// Container Environment Variables Component
function ContainerEnvironmentVariables({ vhost, isEditing, formData, setFormData }: {
  vhost: any;
  isEditing: boolean;
  formData: any;
  setFormData: (data: any) => void;
}) {
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  const addEnvVar = () => {
    if (newEnvKey && newEnvValue) {
      // Ensure env is always an object, not an array
      const currentEnv = formData.containerConfig?.env || {};
      const cleanEnv = Array.isArray(currentEnv) ? {} : currentEnv;
      
      setFormData({
        ...formData,
        containerConfig: {
          ...formData.containerConfig,
          env: {
            ...cleanEnv,
            [newEnvKey]: newEnvValue
          }
        }
      });
      
      setNewEnvKey('');
      setNewEnvValue('');
      toast.success(`Added environment variable: ${newEnvKey}`);
    }
  };

  const removeEnvVar = (key: string) => {
    const currentEnv = formData.containerConfig?.env || {};
    const cleanEnv = Array.isArray(currentEnv) ? {} : currentEnv;
    const { [key]: _, ...restEnv } = cleanEnv;
    
    setFormData({
      ...formData,
      containerConfig: {
        ...formData.containerConfig,
        env: restEnv
      }
    });
    toast.success(`Removed environment variable: ${key}`);
  };

  const updateEnvVar = (oldKey: string, newKey: string, value: string) => {
    const currentEnv = formData.containerConfig?.env || {};
    const cleanEnv = Array.isArray(currentEnv) ? {} : currentEnv;
    
    // If key changed, remove old key
    if (oldKey !== newKey) {
      const { [oldKey]: _, ...restEnv } = cleanEnv;
      setFormData({
        ...formData,
        containerConfig: {
          ...formData.containerConfig,
          env: {
            ...restEnv,
            [newKey]: value
          }
        }
      });
    } else {
      // Just update value
      setFormData({
        ...formData,
        containerConfig: {
          ...formData.containerConfig,
          env: {
            ...cleanEnv,
            [newKey]: value
          }
        }
      });
    }
  };

  // Get clean environment variables
  const getCleanEnvVars = () => {
    const env = formData.containerConfig?.env || {};
    if (Array.isArray(env)) {
      return {};
    }
    // Filter out any numeric keys or invalid entries
    return Object.entries(env).reduce((acc, [key, value]) => {
      if (!isNaN(Number(key)) || typeof value === 'object') {
        return acc;
      }
      return { ...acc, [key]: value };
    }, {} as Record<string, string>);
  };

  const envVars = getCleanEnvVars();
  const envEntries = Object.entries(envVars);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
      <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Package className="h-5 w-5 text-purple-500" />
        Environment Variables
      </h3>

      <div className="space-y-4">
        {/* Display existing environment variables */}
        {envEntries.length > 0 ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Variables</label>
            {envEntries.map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => updateEnvVar(key, e.target.value, value as string)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                      placeholder="KEY"
                    />
                    <span className="text-gray-500">=</span>
                    <input
                      type="text"
                      value={value as string}
                      onChange={(e) => updateEnvVar(key, key, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                      placeholder="VALUE"
                    />
                    <button
                      onClick={() => removeEnvVar(key)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex-1 font-mono text-sm">
                    <span className="text-blue-600">{key}</span>
                    <span className="text-gray-500 mx-2">=</span>
                    <span className="text-gray-700">{value}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500">No environment variables configured</p>
            {!isEditing && (
              <p className="text-xs text-gray-400 mt-1">Click Edit to add environment variables</p>
            )}
          </div>
        )}

        {/* Add new environment variable */}
        {isEditing && (
          <div className="pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-2">Add New Variable</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                placeholder="KEY"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                onKeyPress={(e) => e.key === 'Enter' && newEnvValue && addEnvVar()}
              />
              <span className="flex items-center text-gray-500">=</span>
              <input
                type="text"
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                placeholder="VALUE"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                onKeyPress={(e) => e.key === 'Enter' && newEnvKey && addEnvVar()}
              />
              <button
                onClick={addEnvVar}
                disabled={!newEnvKey || !newEnvValue}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Environment variables will be available in your container. Keys are automatically uppercased.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Container Management Component
function ContainerManagement({ vhost }: { vhost: any }) {
  const [containerStatus, setContainerStatus] = useState<string>('checking');
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});
  const [containerInfo, setContainerInfo] = useState<any>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployImageName, setDeployImageName] = useState('');

  // Check container status
  const checkContainerStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/container/health`);
      if (response.ok) {
        const data = await response.json();
        setContainerStatus(data.status);
        setContainerInfo(data);
      } else {
        setContainerStatus('stopped');
      }
    } catch (error) {
      setContainerStatus('error');
      console.error('Failed to check container status:', error);
    }
  };

  // Container actions
  const containerAction = async (action: string) => {
    setIsLoading(prev => ({ ...prev, [action]: true }));
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/container/${action}`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success(`Container ${action} successful`);
        // Wait a moment then check status
        setTimeout(checkContainerStatus, 2000);
      } else {
        const errorData = await response.json().catch(() => null);
        toast.error(errorData?.error || `Failed to ${action} container`);
      }
    } catch (error) {
      console.error(`Container ${action} error:`, error);
      toast.error(`Failed to ${action} container`);
    } finally {
      setIsLoading(prev => ({ ...prev, [action]: false }));
    }
  };

  const viewContainerLogs = async () => {
    setIsLoading(prev => ({ ...prev, logs: true }));
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/container/logs`);
      if (response.ok) {
        const data = await response.json();
        // Create a new window/modal to show logs
        const logWindow = window.open('', '_blank', 'width=800,height=600');
        if (logWindow) {
          logWindow.document.write(`
            <html>
              <head><title>Container Logs - ${vhost.domain}</title></head>
              <body style="font-family: monospace; background: #1a1a1a; color: #f0f0f0; padding: 20px;">
                <h3>Container Logs for ${vhost.domain}</h3>
                <pre style="white-space: pre-wrap; word-wrap: break-word;">${data.logs || 'No logs available'}</pre>
              </body>
            </html>
          `);
          logWindow.document.close();
        }
      } else {
        toast.error('Failed to fetch container logs');
      }
    } catch (error) {
      toast.error('Failed to fetch container logs');
    } finally {
      setIsLoading(prev => ({ ...prev, logs: false }));
    }
  };

  const handleDeployNewImage = async (newImage: string) => {
    if (!newImage || newImage === containerInfo?.runningImage) {
      toast.info("Image is already running");
      return;
    }

    setIsLoading(prev => ({ ...prev, deploy: true }));
    try {
      // First update the configuration
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          containerConfig: {
            ...vhost.containerConfig,
            image: newImage
          }
        })
      });
      
      // Then rebuild the container with the new image
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/container/rebuild`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success(`Successfully deployed new image: ${newImage}`);
        setShowDeployModal(false);
        setDeployImageName('');
        
        // Refetch health status after deployment
        setTimeout(checkContainerStatus, 3000);
      } else {
        const errorData = await response.json().catch(() => null);
        toast.error(errorData?.error || 'Failed to deploy new image');
      }
    } catch (error) {
      console.error('Deploy error:', error);
      toast.error('Failed to deploy new image');
    } finally {
      setIsLoading(prev => ({ ...prev, deploy: false }));
    }
  };

  // Check status on mount and set up interval
  useEffect(() => {
    checkContainerStatus();
    const interval = setInterval(checkContainerStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [vhost.domain]);

  const getStatusColor = () => {
    switch (containerStatus) {
      case 'running': return 'text-green-600';
      case 'stopped': return 'text-red-600';
      case 'restarting': return 'text-yellow-600';
      case 'checking': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (containerStatus) {
      case 'running': return <CheckCircle className="h-4 w-4" />;
      case 'stopped': return <XCircle className="h-4 w-4" />;
      case 'restarting': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'checking': return <Loader2 className="h-4 w-4 animate-spin" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
      <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Package className="h-5 w-5 text-purple-500" />
        Container Management
      </h3>

      {/* Container Status */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Container Status</h4>
        <div className={`flex items-center gap-2 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="font-medium capitalize">{containerStatus}</span>
          {containerInfo?.uptime && (
            <span className="text-xs text-gray-500 ml-2">
              Uptime: {containerInfo.uptime}
            </span>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => containerAction('start')}
          disabled={isLoading.start || containerStatus === 'running'}
          className={`p-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            containerStatus === 'running' 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isLoading.start ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Start
        </button>

        <button
          onClick={() => containerAction('stop')}
          disabled={isLoading.stop || containerStatus === 'stopped'}
          className={`p-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            containerStatus === 'stopped'
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          {isLoading.stop ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
          Stop
        </button>

        <button
          onClick={() => containerAction('restart')}
          disabled={isLoading.restart}
          className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
        >
          {isLoading.restart ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Restart
        </button>

        <button
          onClick={() => containerAction('rebuild')}
          disabled={isLoading.rebuild}
          className="p-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
        >
          {isLoading.rebuild ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Rebuild
        </button>
      </div>

      {/* View Container Logs */}
      <button
        onClick={viewContainerLogs}
        disabled={isLoading.logs}
        className="w-full p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
      >
        {isLoading.logs ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        View Container Logs
      </button>

      {/* Deploy New Image Button */}
      <button
        onClick={() => {
          setDeployImageName(vhost.containerConfig?.image || '');
          setShowDeployModal(true);
        }}
        disabled={isLoading.deploy}
        className="w-full mt-2 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
        title="Deploy a new container image"
      >
        {isLoading.deploy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
        Deploy New Image
      </button>

      {/* Container Info Display */}
      {containerInfo && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="space-y-2 text-sm">
            {containerInfo.runningImage && (
              <div className="flex items-start gap-2">
                <span className="text-gray-600 font-medium">Running Image:</span>
                <code className={`text-xs ${
                  containerInfo.runningImage !== vhost.containerConfig?.image 
                    ? 'text-amber-600 font-semibold' 
                    : 'text-gray-700'
                }`}>
                  {containerInfo.runningImage}
                </code>
              </div>
            )}
            {containerInfo.runningImage && containerInfo.runningImage !== vhost.containerConfig?.image && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">Image mismatch - rebuild to update</span>
              </div>
            )}
            {containerInfo.configuredImage && (
              <div className="flex items-start gap-2">
                <span className="text-gray-600 font-medium">Configured Image:</span>
                <code className="text-xs text-gray-700">{containerInfo.configuredImage}</code>
              </div>
            )}
            {containerInfo.health && (
              <div className="flex items-start gap-2">
                <span className="text-gray-600 font-medium">Health:</span>
                <span className="text-xs text-gray-700">{containerInfo.health}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deploy Modal */}
      {showDeployModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" 
            onClick={() => {
              setShowDeployModal(false);
              setDeployImageName('');
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Deploy New Container Image</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Enter the new image name to deploy
                </p>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Image
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <code className="text-sm text-gray-600">
                      {containerInfo?.runningImage || vhost.containerConfig?.image || 'Not set'}
                    </code>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Image Name
                  </label>
                  <input
                    type="text"
                    value={deployImageName}
                    onChange={(e) => setDeployImageName(e.target.value)}
                    placeholder="e.g., nginx:latest, node:18-alpine"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && deployImageName) {
                        handleDeployNewImage(deployImageName);
                      } else if (e.key === 'Escape') {
                        setShowDeployModal(false);
                        setDeployImageName('');
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Examples: nginx:latest, node:18-alpine, python:3.11
                  </p>
                </div>
                
                {deployImageName && deployImageName !== (containerInfo?.runningImage || vhost.containerConfig?.image) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      This will rebuild the container with the new image
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowDeployModal(false);
                    setDeployImageName('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeployNewImage(deployImageName)}
                  disabled={!deployImageName || deployImageName === (containerInfo?.runningImage || vhost.containerConfig?.image) || isLoading.deploy}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading.deploy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4" />
                      Deploy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}