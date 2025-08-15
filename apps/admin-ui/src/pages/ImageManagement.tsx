/**
 * SpinForge - Docker Image Management
 * View and manage Docker images on the system
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Package,
  Trash2,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle,
  HardDrive,
  Clock,
  Layers,
  Search,
  Filter,
  X,
  Info,
  AlertCircle,
  Archive,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  imageId: string;
  created: string;
  size: string;
  sizeBytes: number;
  digest: string | null;
  inUse: boolean;
}

interface ImageResponse {
  success: boolean;
  images: DockerImage[];
  total: number;
  totalSize: number;
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 30) {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  } else if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

export default function ImageManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyInUse, setShowOnlyInUse] = useState(false);
  const [selectedImage, setSelectedImage] = useState<DockerImage | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pullModalOpen, setPullModalOpen] = useState(false);
  const [newImageName, setNewImageName] = useState('');

  // Fetch images
  const { data, isLoading, error, refetch } = useQuery<ImageResponse>({
    queryKey: ['docker-images'],
    queryFn: async () => {
      const response = await fetch('/api/images');
      if (!response.ok) throw new Error('Failed to fetch images');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ imageId, force }: { imageId: string; force: boolean }) => {
      const response = await fetch(`/api/images/${imageId}?force=${force}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete image');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Image deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['docker-images'] });
      setDeleteModalOpen(false);
      setSelectedImage(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Pull mutation
  const pullMutation = useMutation({
    mutationFn: async (image: string) => {
      const response = await fetch('/api/images/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to pull image');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Image pulled successfully');
      queryClient.invalidateQueries({ queryKey: ['docker-images'] });
      setPullModalOpen(false);
      setNewImageName('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Prune mutation
  const pruneMutation = useMutation({
    mutationFn: async (all: boolean) => {
      const response = await fetch('/api/images/prune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to prune images');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Pruned images. Space reclaimed: ${data.spaceReclaimed}`);
      queryClient.invalidateQueries({ queryKey: ['docker-images'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Filter images
  const filteredImages = data?.images.filter(image => {
    const matchesSearch = 
      image.repository.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.imageId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesInUse = !showOnlyInUse || image.inUse;
    
    return matchesSearch && matchesInUse;
  }) || [];

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertCircle className="h-8 w-8" />
              <div>
                <h2 className="text-xl font-semibold">Failed to load images</h2>
                <p className="text-gray-600">{error.message}</p>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Image Management</h1>
                <p className="text-sm text-gray-500">
                  {data?.total || 0} images • {formatBytes(data?.totalSize || 0)} total
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => pruneMutation.mutate(false)}
                disabled={pruneMutation.isPending}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                <Archive className="h-4 w-4" />
                <span>Prune Unused</span>
              </button>
              
              <button
                onClick={() => setPullModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                <span>Pull Image</span>
              </button>
              
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Search and Filters */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search images..."
                  className="pl-10 pr-4 py-2 w-full bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyInUse}
                  onChange={(e) => setShowOnlyInUse(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Show only in use</span>
              </label>
            </div>
          </div>

          {/* Images List */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12">
              <div className="text-center">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No images found</h3>
                <p className="text-gray-600">
                  {searchTerm ? 'Try adjusting your search' : 'Pull an image to get started'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tag
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredImages.map((image) => (
                    <tr key={image.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {image.repository}
                            </div>
                            <div className="text-xs text-gray-500">
                              {image.imageId.substring(0, 12)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                          {image.tag}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {image.size}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(image.created)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {image.inUse ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            <span className="text-xs">In Use</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-400">
                            <HardDrive className="h-4 w-4 mr-1" />
                            <span className="text-xs">Idle</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedImage(image);
                            setDeleteModalOpen(true);
                          }}
                          disabled={image.inUse}
                          className={`text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-not-allowed`}
                          title={image.inUse ? 'Cannot delete image in use' : 'Delete image'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteModalOpen && selectedImage && (
          <>
            <motion.div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteModalOpen(false)}
            />
            <motion.div
              className="fixed inset-0 z-50 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex min-h-full items-center justify-center p-4">
                <motion.div
                  className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div className="flex items-start">
                    <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">Delete Image</h3>
                      <p className="mt-2 text-sm text-gray-500">
                        Are you sure you want to delete this image?
                      </p>
                      <div className="mt-3 bg-gray-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-900">
                          {selectedImage.repository}:{selectedImage.tag}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Size: {selectedImage.size} • ID: {selectedImage.imageId.substring(0, 12)}
                        </p>
                      </div>
                      
                      {selectedImage.inUse && (
                        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-yellow-800">
                            This image is currently in use. Force delete will remove it anyway.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setDeleteModalOpen(false)}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate({ 
                        imageId: selectedImage.imageId, 
                        force: selectedImage.inUse 
                      })}
                      disabled={deleteMutation.isPending}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? 'Deleting...' : selectedImage.inUse ? 'Force Delete' : 'Delete'}
                    </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Pull Modal */}
      <AnimatePresence>
        {pullModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPullModalOpen(false)}
            />
            <motion.div
              className="fixed inset-0 z-50 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex min-h-full items-center justify-center p-4">
                <motion.div
                  className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Pull Docker Image</h3>
                    <p className="mt-2 text-sm text-gray-500">
                      Enter the image name and tag to pull from Docker Hub or a registry.
                    </p>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Image Name
                      </label>
                      <input
                        type="text"
                        value={newImageName}
                        onChange={(e) => setNewImageName(e.target.value)}
                        placeholder="e.g., nginx:latest or myregistry.com/myimage:v1.0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        Examples: nginx:latest, node:18-alpine, postgres:15
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setPullModalOpen(false);
                        setNewImageName('');
                      }}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => pullMutation.mutate(newImageName)}
                      disabled={!newImageName || pullMutation.isPending}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {pullMutation.isPending ? 'Pulling...' : 'Pull Image'}
                    </button>
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