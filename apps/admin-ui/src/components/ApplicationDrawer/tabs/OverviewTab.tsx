import React, { useState, useEffect } from 'react';
import { Shield, Globe, Server, Activity, CheckCircle, XCircle, Plus, Trash2, ExternalLink, ChevronRight, AlertTriangle, Package, Network, Edit2, Settings, Play, Square, RotateCcw, RefreshCw, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface OverviewTabProps {
  vhost: any;
  isEditing: boolean;
  formData: any;
  setFormData: (data: any) => void;
}

export default function OverviewTab({ vhost, isEditing, formData, setFormData }: OverviewTabProps) {
  const [newDomain, setNewDomain] = useState('');
  const [editingBackendIndex, setEditingBackendIndex] = useState<number | null>(null);
  
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

  // Backend management for load balancer
  const addBackend = () => {
    const newBackend = { url: 'http://backend:3000', weight: 1, enabled: true };
    setFormData({ 
      ...formData, 
      backends: [...(formData.backends || []), newBackend] 
    });
  };

  const updateBackend = (index: number, backend: any) => {
    const updatedBackends = [...formData.backends];
    updatedBackends[index] = backend;
    setFormData({ ...formData, backends: updatedBackends });
  };

  const removeBackend = (index: number) => {
    setFormData({ 
      ...formData, 
      backends: formData.backends.filter((_: any, i: number) => i !== index) 
    });
  };


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
            {/* Editable Configuration - At the Top */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Index File - Editable */}
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

              {/* Error Page - Editable */}
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

            {/* Static Files Path Information - Below */}
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
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Container Path:</label>
                  <p className="text-sm text-gray-900 font-mono">
                    /data/static/{vhost.domain.replace(/\./g, '_')}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Host Path (Upload here):</label>
                  <p className="text-sm text-gray-900 font-mono">
                    hosting/data/static/{vhost.domain.replace(/\./g, '_')}
                  </p>
                </div>
              </div>
            </div>

            {/* Files Status */}
            {vhost.files_exist === false && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm text-red-800 font-medium">Static files not found!</p>
                  <p className="text-xs text-red-700">
                    Upload your files to: hosting/data/static/{vhost.domain.replace(/\./g, '_')}/
                  </p>
                </div>
              </div>
            )}
            
            {vhost.files_exist === true && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">Static files found and serving</span>
              </div>
            )}
          </div>
        </div>
      )}

      {vhost.type === 'container' && <ContainerManagement vhost={vhost} />}

      {vhost.type === 'loadbalancer' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Network className="h-5 w-5 text-green-500" />
            Load Balancer Configuration
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {formData.backends?.length || 0} backend servers configured
              </p>
              {isEditing && (
                <button
                  onClick={addBackend}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Backend
                </button>
              )}
            </div>

            <div className="space-y-2">
              {(formData.backends || []).map((backend: any, index: number) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  {editingBackendIndex === index && isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={backend.url}
                        onChange={(e) => updateBackend(index, { ...backend, url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="http://backend:3000"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={backend.weight || 1}
                          onChange={(e) => updateBackend(index, { ...backend, weight: parseInt(e.target.value) })}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Weight"
                        />
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={backend.enabled !== false}
                            onChange={(e) => updateBackend(index, { ...backend, enabled: e.target.checked })}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="text-sm">Enabled</span>
                        </label>
                        <button
                          onClick={() => setEditingBackendIndex(null)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm"
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
                        <code className="text-sm">{backend.url || `Backend ${index + 1}`}</code>
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                          Weight: {backend.weight || 1}
                        </span>
                      </div>
                      {isEditing && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingBackendIndex(index)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeBackend(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Container Management Component
function ContainerManagement({ vhost }: { vhost: any }) {
  const [containerStatus, setContainerStatus] = useState<string>('checking');
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});
  const [containerInfo, setContainerInfo] = useState<any>(null);

  // Check container status
  const checkContainerStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/container/health`);
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/container/${action}`, {
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/container/logs`);
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
    </div>
  );
}