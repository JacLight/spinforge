import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hostingAPI, VHost, HostingStats } from '../services/hosting-api';
import {
  Globe,
  Server,
  Activity,
  Trash2,
  RefreshCw,
  ExternalLink,
  Plus,
  Edit,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function HostingDashboard() {
  const [selectedSite, setSelectedSite] = useState<VHost | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all vhosts
  const { data: vhosts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['vhosts'],
    queryFn: () => hostingAPI.listVHosts(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['hosting-stats'],
    queryFn: () => hostingAPI.getStats(),
    refetchInterval: 30000,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => hostingAPI.deleteVHost(id),
    onSuccess: () => {
      toast.success('Site deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['vhosts'] });
      queryClient.invalidateQueries({ queryKey: ['hosting-stats'] });
      setSelectedSite(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to delete site: ${error.message}`);
    },
  });

  const handleDelete = (id: string) => {
    if (confirm(`Are you sure you want to delete this site?`)) {
      deleteMutation.mutate(id);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'static':
        return 'bg-blue-500';
      case 'proxy':
        return 'bg-green-500';
      case 'container':
        return 'bg-purple-500';
      case 'loadbalancer':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSiteUrl = (domain: string) => {
    return domain ? `http://${domain}` : '#';
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load hosting data</h2>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Hosting Dashboard</h1>
        <p className="text-gray-600">Manage your SpinForge hosted sites</p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sites</p>
                <p className="text-2xl font-bold">{stats.total_sites}</p>
              </div>
              <Globe className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Static Sites</p>
                <p className="text-2xl font-bold">{stats.static_sites}</p>
              </div>
              <div className="h-8 w-8 rounded bg-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Proxy Sites</p>
                <p className="text-2xl font-bold">{stats.proxy_sites}</p>
              </div>
              <div className="h-8 w-8 rounded bg-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Container Sites</p>
                <p className="text-2xl font-bold">{stats.container_sites}</p>
              </div>
              <div className="h-8 w-8 rounded bg-purple-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Load Balancers</p>
                <p className="text-2xl font-bold">{stats.loadbalancer_sites}</p>
              </div>
              <div className="h-8 w-8 rounded bg-orange-500" />
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          Add Site
        </button>
      </div>

      {/* Sites List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Domain
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Target/Path
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-600">Loading sites...</span>
                  </div>
                </td>
              </tr>
            ) : vhosts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No sites found. Create your first site to get started.
                </td>
              </tr>
            ) : (
              vhosts.map((vhost) => (
                <tr
                  key={vhost.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedSite(vhost)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Globe className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="font-medium">{vhost.domain || vhost.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getTypeColor(
                        vhost.type
                      )}`}
                    >
                      {vhost.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vhost.type === 'static' && vhost.static_path}
                    {vhost.type === 'proxy' && vhost.target}
                    {vhost.type === 'container' && 'Container'}
                    {vhost.type === 'loadbalancer' && `${vhost.upstreams?.length || 0} upstreams`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vhost.created_at
                      ? new Date(vhost.created_at).toLocaleDateString()
                      : 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <a
                        href={getSiteUrl(vhost.domain || '')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-900"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(vhost.id);
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Site Details Modal */}
      {selectedSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">{selectedSite.domain || selectedSite.id}</h2>
                <button
                  onClick={() => setSelectedSite(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <p className="mt-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getTypeColor(
                        selectedSite.type
                      )}`}
                    >
                      {selectedSite.type}
                    </span>
                  </p>
                </div>
                {selectedSite.type === 'static' && selectedSite.static_path && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Static Path</label>
                    <p className="mt-1 font-mono text-sm">{selectedSite.static_path}</p>
                  </div>
                )}
                {selectedSite.type === 'proxy' && selectedSite.target && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Proxy Target</label>
                    <p className="mt-1 font-mono text-sm">{selectedSite.target}</p>
                  </div>
                )}
                {selectedSite.headers && Object.keys(selectedSite.headers).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Custom Headers</label>
                    <pre className="mt-1 p-2 bg-gray-100 rounded text-sm">
                      {JSON.stringify(selectedSite.headers, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedSite.rateLimit && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Rate Limit</label>
                    <p className="mt-1">
                      {selectedSite.rateLimit.requests} requests per {selectedSite.rateLimit.per}
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-6">
                  <a
                    href={getSiteUrl(selectedSite.domain || '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit Site
                  </a>
                  <button
                    onClick={() => handleDelete(selectedSite.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}