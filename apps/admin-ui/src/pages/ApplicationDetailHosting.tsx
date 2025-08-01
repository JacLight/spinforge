import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hostingAPI } from "../services/hosting-api";
import { toast } from "sonner";
import {
  ArrowLeft,
  Globe,
  Server,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Edit,
  Save,
  X,
  FolderOpen,
  Network,
  Package,
  Clock,
  User,
  Settings,
  Info,
  Copy,
  RefreshCw,
} from "lucide-react";

export default function ApplicationDetailHosting() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});


  const {
    data: vhost,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ["vhost-detail", id],
    queryFn: () => hostingAPI.getVHost(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => hostingAPI.updateVHost(id!, data),
    onSuccess: () => {
      toast.success("Application updated successfully");
      queryClient.invalidateQueries({ queryKey: ["vhost-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["vhosts"] });
      setEditMode(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => hostingAPI.deleteVHost(id!),
    onSuccess: () => {
      toast.success("Application deleted successfully");
      navigate("/applications");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const handleEdit = () => {
    setEditMode(true);
    setEditData({
      customerId: vhost?.customerId || '',
      enabled: vhost?.enabled !== false,
      target: vhost?.target || '',
      headers: vhost?.headers || {},
      rateLimit: vhost?.rateLimit || null,
    });
  };

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !vhost) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Application not found</h2>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : `No application found for: ${domain}`}
          </p>
          <button
            onClick={() => navigate("/applications")}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Back to Applications
          </button>
        </div>
      </div>
    );
  }

  const Icon = getTypeIcon(vhost.type);
  const siteUrl = vhost.domain ? `http://${vhost.domain}` : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate("/applications")}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{vhost.domain || vhost.id}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(vhost.type)}`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {vhost.type}
                    </span>
                    {vhost.enabled === false && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        Disabled
                      </span>
                    )}
                    {vhost.type === 'static' && vhost.files_exist === false && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                        Files Missing
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  Visit Site
                </a>
                {!editMode ? (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        setEditData({});
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Overview</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Domain</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <span className="font-medium">{vhost.domain || ''}</span>
                    <button
                      onClick={() => handleCopy(vhost.domain || '')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Customer ID</dt>
                  <dd className="mt-1">
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.customerId}
                        onChange={(e) => setEditData({ ...editData, customerId: e.target.value })}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <span className="font-medium">{vhost.customerId || 'Unknown'}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd className="mt-1">
                    {editMode ? (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editData.enabled}
                          onChange={(e) => setEditData({ ...editData, enabled: e.target.checked })}
                          className="mr-2"
                        />
                        Enabled
                      </label>
                    ) : (
                      <div className="flex items-center">
                        {vhost.enabled !== false ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                            <span className="text-green-700 font-medium">Enabled</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-gray-400 mr-1" />
                            <span className="text-gray-500 font-medium">Disabled</span>
                          </>
                        )}
                      </div>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Created</dt>
                  <dd className="mt-1 font-medium">
                    {new Date(vhost.created_at || vhost.createdAt || '').toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Type-specific Configuration */}
            {vhost.type === 'static' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Static Site Configuration</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-gray-500">Static Path</dt>
                    <dd className="mt-1 font-mono text-sm bg-gray-50 p-2 rounded">
                      {vhost.static_path || `/data/static/${vhost.id}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Files Status</dt>
                    <dd className="mt-1">
                      {vhost.files_exist ? (
                        <span className="flex items-center text-green-700">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Files deployed
                        </span>
                      ) : (
                        <span className="flex items-center text-yellow-700">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Files not found
                        </span>
                      )}
                    </dd>
                  </div>
                  {vhost.actual_domain && (
                    <div>
                      <dt className="text-sm text-gray-500">Actual Domain (from deploy.json)</dt>
                      <dd className="mt-1 font-medium">{vhost.actual_domain}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {vhost.type === 'proxy' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Proxy Configuration</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-gray-500">Target URL</dt>
                    <dd className="mt-1">
                      {editMode ? (
                        <input
                          type="text"
                          value={editData.target}
                          onChange={(e) => setEditData({ ...editData, target: e.target.value })}
                          className="w-full px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                          placeholder="http://example.com"
                        />
                      ) : (
                        <span className="font-mono text-sm bg-gray-50 p-2 rounded block">
                          {vhost.target || 'Not configured'}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {vhost.type === 'container' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Container Configuration</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-gray-500">Container Target</dt>
                    <dd className="mt-1 font-mono text-sm bg-gray-50 p-2 rounded">
                      {vhost.target || 'Not configured'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {vhost.type === 'loadbalancer' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Load Balancer Configuration</h2>
                {vhost.upstreams && vhost.upstreams.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500 mb-2">Upstream Servers</p>
                    {vhost.upstreams.map((upstream, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="font-mono text-sm">{upstream.url}</span>
                        {upstream.weight && (
                          <span className="text-sm text-gray-500">Weight: {upstream.weight}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No upstream servers configured</p>
                )}
              </div>
            )}

            {/* Advanced Configuration */}
            {(vhost.headers || vhost.rateLimit || vhost.cookieRouting) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Advanced Configuration</h2>
                
                {vhost.headers && Object.keys(vhost.headers).length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Custom Headers</h3>
                    <div className="bg-gray-50 p-3 rounded">
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(vhost.headers, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {vhost.rateLimit && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Rate Limiting</h3>
                    <p className="text-sm bg-gray-50 p-3 rounded">
                      {vhost.rateLimit.requests} requests per {vhost.rateLimit.per}
                    </p>
                  </div>
                )}

                {vhost.cookieRouting && vhost.cookieRouting.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Cookie-based Routing</h3>
                    <div className="space-y-2">
                      {vhost.cookieRouting.map((rule, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded text-sm">
                          <p><strong>Name:</strong> {rule.name}</p>
                          <p><strong>Cookie:</strong> {rule.cookie}</p>
                          <p><strong>Target:</strong> {rule.target}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={() => refetch()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ${vhost.domain || vhost.id}?`)) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Delete Application
                </button>
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Metadata</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm">
                    {new Date(vhost.updated_at || vhost.updatedAt || '').toLocaleString()}
                  </dd>
                </div>
                {vhost.metadata && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-2">Additional Info</dt>
                    <dd className="text-sm bg-gray-50 p-2 rounded">
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(vhost.metadata, null, 2)}
                      </pre>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Help */}
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-900">Need Help?</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    {vhost.type === 'static' && "Static sites are served directly from the file system."}
                    {vhost.type === 'proxy' && "Proxy routes forward requests to the configured target URL."}
                    {vhost.type === 'container' && "Container routes connect to Docker containers."}
                    {vhost.type === 'loadbalancer' && "Load balancers distribute traffic across multiple upstream servers."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}