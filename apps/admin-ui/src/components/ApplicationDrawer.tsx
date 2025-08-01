import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hostingAPI } from "../services/hosting-api";
import { toast } from "sonner";
import {
  X,
  Globe,
  Server,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Edit,
  Save,
  FolderOpen,
  Network,
  Package,
  Copy,
  RefreshCw,
  Trash2,
  Info,
} from "lucide-react";

interface ApplicationDrawerProps {
  vhost: any | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ApplicationDrawer({ vhost, isOpen, onClose, onRefresh }: ApplicationDrawerProps) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const updateMutation = useMutation({
    mutationFn: (data: any) => hostingAPI.updateVHost(vhost.subdomain, data),
    onSuccess: () => {
      toast.success("Application updated successfully");
      queryClient.invalidateQueries({ queryKey: ["vhosts"] });
      setEditMode(false);
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
      onClose();
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
      domain: vhost?.domain || `${vhost?.subdomain}.spinforge.localhost`,
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

  if (!vhost) return null;

  const Icon = getTypeIcon(vhost.type);
  const siteUrl = vhost.domain ? `http://${vhost.domain}` : `http://${vhost.subdomain}.spinforge.localhost`;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-500 transform"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-500 transform"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto relative w-screen max-w-4xl">
                  <div className="flex h-full flex-col overflow-y-auto bg-white shadow-2xl border-l border-gray-200">
                    {/* Header */}
                    <div className="bg-gray-50 px-8 py-5 border-b shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <Dialog.Title className="text-2xl font-semibold text-gray-900">
                            {vhost.subdomain}
                          </Dialog.Title>
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
                        <button
                          type="button"
                          className="rounded-md bg-white p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                          onClick={onClose}
                        >
                          <span className="sr-only">Close panel</span>
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 px-8 py-6 space-y-6 max-w-3xl mx-auto w-full">
                      {/* Quick Actions */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <a
                          href={siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Visit Site
                        </a>
                        {!editMode ? (
                          <button
                            onClick={handleEdit}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={handleSave}
                              disabled={updateMutation.isPending}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                            >
                              <Save className="h-4 w-4" />
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditMode(false);
                                setEditData({});
                              }}
                              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <button
                          onClick={onRefresh}
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>

                      {/* Overview */}
                      <div className="bg-gray-50 rounded-lg p-6">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Overview</h3>
                        <dl className="space-y-4">
                          <div>
                            <dt className="text-sm font-medium text-gray-500 mb-1">Subdomain (Identifier)</dt>
                            <dd className="font-medium text-sm text-gray-900">{vhost.subdomain}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500 mb-1">Full Domain</dt>
                            <dd>
                              {editMode ? (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={editData.domain}
                                    onChange={(e) => setEditData({ ...editData, domain: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="example.com or subdomain.example.com"
                                  />
                                  <p className="text-xs text-gray-500">Enter any custom domain or leave as default</p>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-gray-900 break-all">{vhost.domain || `${vhost.subdomain}.spinforge.localhost`}</span>
                                  <button
                                    onClick={() => handleCopy(vhost.domain || `${vhost.subdomain}.spinforge.localhost`)}
                                    className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </dd>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Customer ID</dt>
                              <dd>
                                {editMode ? (
                                  <input
                                    type="text"
                                    value={editData.customerId}
                                    onChange={(e) => setEditData({ ...editData, customerId: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                  />
                                ) : (
                                  <span className="font-medium text-sm text-gray-900">{vhost.customerId || 'Unknown'}</span>
                                )}
                              </dd>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Status</dt>
                              <dd>
                                {editMode ? (
                                  <label className="flex items-center text-sm">
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
                                        <span className="text-green-700 font-medium text-sm">Enabled</span>
                                      </>
                                    ) : (
                                      <>
                                        <AlertCircle className="h-4 w-4 text-gray-400 mr-1" />
                                        <span className="text-gray-500 font-medium text-sm">Disabled</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Created</dt>
                              <dd className="font-medium text-sm text-gray-900">
                                {new Date(vhost.created_at || vhost.createdAt || '').toLocaleDateString()}
                              </dd>
                            </div>
                          </div>
                        </dl>
                      </div>

                      {/* Type-specific Configuration */}
                      {vhost.type === 'static' && (
                        <div className="bg-gray-50 rounded-lg p-6">
                          <h3 className="text-base font-semibold text-gray-900 mb-4">Static Site Configuration</h3>
                          <dl className="space-y-3">
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Static Path</dt>
                              <dd className="font-mono text-xs bg-white p-2 rounded text-gray-900">
                                {vhost.static_path || `/data/static/${vhost.subdomain}`}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Files Status</dt>
                              <dd>
                                {vhost.files_exist ? (
                                  <span className="flex items-center text-green-700 text-sm">
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Files deployed
                                  </span>
                                ) : (
                                  <span className="flex items-center text-yellow-700 text-sm">
                                    <AlertCircle className="h-4 w-4 mr-1" />
                                    Files not found
                                  </span>
                                )}
                              </dd>
                            </div>
                            {vhost.actual_domain && (
                              <div>
                                <dt className="text-sm font-medium text-gray-500 mb-1">Actual Domain (from deploy.json)</dt>
                                <dd className="font-medium text-sm text-gray-900">{vhost.actual_domain}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      )}

                      {vhost.type === 'proxy' && (
                        <div className="bg-gray-50 rounded-lg p-6">
                          <h3 className="text-base font-semibold text-gray-900 mb-4">Proxy Configuration</h3>
                          <dl className="space-y-3">
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Target URL</dt>
                              <dd>
                                {editMode ? (
                                  <input
                                    type="text"
                                    value={editData.target}
                                    onChange={(e) => setEditData({ ...editData, target: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 font-mono"
                                    placeholder="http://example.com"
                                  />
                                ) : (
                                  <span className="font-mono text-sm bg-white p-2 rounded block text-gray-900">
                                    {vhost.target || 'Not configured'}
                                  </span>
                                )}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      )}

                      {vhost.type === 'container' && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Container Configuration</h3>
                          <dl className="space-y-3">
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Container Target</dt>
                              <dd className="font-mono text-sm bg-white p-2 rounded text-gray-900">
                                {vhost.target || 'Not configured'}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      )}

                      {vhost.type === 'loadbalancer' && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Load Balancer Configuration</h3>
                          {vhost.upstreams && vhost.upstreams.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-sm text-gray-500 mb-2">Upstream Servers</p>
                              {vhost.upstreams.map((upstream: any, index: number) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-white rounded text-sm">
                                  <span className="font-mono text-xs">{upstream.url}</span>
                                  {upstream.weight && (
                                    <span className="text-xs text-gray-500">Weight: {upstream.weight}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm">No upstream servers configured</p>
                          )}
                        </div>
                      )}

                      {/* Advanced Configuration */}
                      {(vhost.headers || vhost.rateLimit || vhost.cookieRouting) && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Advanced Configuration</h3>
                          
                          {vhost.headers && Object.keys(vhost.headers).length > 0 && (
                            <div className="mb-3">
                              <h4 className="text-xs font-medium text-gray-700 mb-1">Custom Headers</h4>
                              <div className="bg-white p-2 rounded">
                                <pre className="text-xs overflow-x-auto">
                                  {JSON.stringify(vhost.headers, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}

                          {vhost.rateLimit && (
                            <div className="mb-3">
                              <h4 className="text-xs font-medium text-gray-700 mb-1">Rate Limiting</h4>
                              <p className="text-sm bg-white p-2 rounded">
                                {vhost.rateLimit.requests} requests per {vhost.rateLimit.per}
                              </p>
                            </div>
                          )}

                          {vhost.cookieRouting && vhost.cookieRouting.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium text-gray-700 mb-1">Cookie-based Routing</h4>
                              <div className="space-y-2">
                                {vhost.cookieRouting.map((rule: any, index: number) => (
                                  <div key={index} className="bg-white p-2 rounded text-xs">
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

                      {/* Metadata */}
                      {vhost.metadata && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Metadata</h3>
                          <div className="bg-white p-2 rounded">
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(vhost.metadata, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Help */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <div className="flex items-start">
                          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div className="ml-3">
                            <h3 className="text-base font-medium text-blue-900">About {vhost.type} hosting</h3>
                            <p className="text-sm text-blue-700 mt-2">
                              {vhost.type === 'static' && "Static sites are served directly from the file system."}
                              {vhost.type === 'proxy' && "Proxy routes forward requests to the configured target URL."}
                              {vhost.type === 'container' && "Container routes connect to Docker containers."}
                              {vhost.type === 'loadbalancer' && "Load balancers distribute traffic across multiple upstream servers."}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Danger Zone */}
                      <div className="border-t pt-6">
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete ${vhost.subdomain}?`)) {
                              deleteMutation.mutate();
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Application
                        </button>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}