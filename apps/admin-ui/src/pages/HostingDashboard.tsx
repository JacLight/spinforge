/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { useState, useEffect, useRef } from 'react';
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
  Grid3X3,
  Package,
  Upload,
  LayoutDashboard,
  X,
  FolderOpen,
  Network,
  Container,
  LoaderIcon,
  FileArchive,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function HostingDashboard() {
  const [selectedSite, setSelectedSite] = useState<VHost | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploadingZip, setUploadingZip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedSite) return;

    if (!file.name.endsWith('.zip')) {
      toast.error('Please select a valid ZIP file');
      return;
    }

    setUploadingZip(true);
    const formData = new FormData();
    formData.append('zipfile', file);

    try {
      await hostingAPI.uploadStaticSiteZip(selectedSite.domain, formData);
      toast.success('Site files uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: ['vhosts'] });
      // Refresh selected site data
      const updatedSite = await hostingAPI.getVHost(selectedSite.domain);
      setSelectedSite(updatedSite);
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploadingZip(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load hosting data</h2>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Retry
          </button>
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
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Hosting Dashboard
                  </h1>
                  <p className="text-sm text-gray-500">Manage your SpinForge hosted sites</p>
                </div>
              </div>
              
              {/* Enhanced Dashboard Navigation */}
              <div className="hidden lg:flex items-center space-x-2">
                {/* Primary Dashboard Tabs */}
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
                    to="/deploy"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="hidden xl:inline">Deploy</span>
                  </Link>
                  <Link
                    to="/hosting"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-lg"></div>
                    <Globe className="w-4 h-4 relative z-10" />
                    <span className="hidden xl:inline relative z-10">Hosting</span>
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Site</span>
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

          {/* Statistics */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <motion.div 
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Sites</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">{stats.total_sites}</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl">
                    <Globe className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </motion.div>
              <motion.div 
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Static Sites</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.static_sites}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <FolderOpen className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </motion.div>
              <motion.div 
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Proxy Sites</p>
                    <p className="text-2xl font-bold text-green-600">{stats.proxy_sites}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-xl">
                    <Network className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </motion.div>
              <motion.div 
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Container Sites</p>
                    <p className="text-2xl font-bold text-purple-600">{stats.container_sites}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Container className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </motion.div>
              <motion.div 
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Load Balancers</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.loadbalancer_sites}</p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-xl">
                    <Server className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">All Sites</h2>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white/60 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Refresh</span>
              </button>
            </div>
          </div>

          {/* Sites List */}
          <motion.div 
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
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
                      className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-medium text-white ${getTypeColor(
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
          </motion.div>
        </motion.div>
      </div>

      {/* Site Details Modal - Custom Tailwind Implementation */}
      <AnimatePresence>
        {selectedSite && (
          <>
            <motion.div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 z-[60]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSite(null)}
            />
            <motion.div
              className="fixed inset-0 z-[61] overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex min-h-full items-center justify-center p-4">
                <motion.div
                  className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">{selectedSite.domain || selectedSite.id}</h2>
                      <button
                        onClick={() => setSelectedSite(null)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X className="h-5 w-5 text-gray-500" />
                      </button>
                    </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <p className="mt-1">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-medium text-white ${getTypeColor(
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
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                      {selectedSite.type === 'static' && (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".zip"
                            onChange={handleZipUpload}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingZip}
                            className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {uploadingZip ? (
                              <>
                                <LoaderIcon className="h-4 w-4 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <FileArchive className="h-4 w-4" />
                                Upload ZIP
                              </>
                            )}
                          </button>
                        </>
                      )}
                      <a
                        href={getSiteUrl(selectedSite.domain || '')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Visit Site
                      </a>
                      <button
                        onClick={() => handleDelete(selectedSite.id)}
                        className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}