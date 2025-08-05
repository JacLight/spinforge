/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { 
  Globe, 
  Package, 
  Trash2, 
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Play,
  Pause,
  RotateCw,
  Settings,
  Activity,
  Server,
  Plus,
  ChevronRight,
  Clock,
  Timer
} from 'lucide-react';

interface Route {
  domain: string;
  spinletId: string;
  customerId: string;
  buildPath: string;
  framework: string;
  config?: {
    memory?: string;
    cpu?: string;
  };
}

interface Spinlet {
  spinletId: string;
  customerId: string;
  state: 'running' | 'stopped' | 'crashed' | 'idle';
  port: number;
  pid?: number;
  startTime: number;
  lastAccess: number;
  requests: number;
  errors: number;
  memory: number;
  cpu: number;
  idleTime?: number;
}

interface IdleInfo {
  idleMinutes: number;
  lastActivity: string;
  willShutdownAt: string;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatDeploymentTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  } else if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return 'Just now';
  }
}

export default function Applications() {
  const [selectedApp, setSelectedApp] = useState<Route | null>(null);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  // Fetch routes and spinlets
  const { data: routes, isLoading: routesLoading } = useQuery<Route[]>({
    queryKey: ['routes'],
    queryFn: async () => {
      const response = await axios.get('/api/routes');
      return response.data;
    },
  });

  const { data: spinlets, isLoading: spinletsLoading } = useQuery<Record<string, Spinlet>>({
    queryKey: ['spinlets'],
    queryFn: async () => {
      const response = await axios.get('/api/spinlets');
      return response.data;
    },
    refetchInterval: 5000,
  });

  // Get idle information for a spinlet
  const { data: idleInfo } = useQuery<IdleInfo>({
    queryKey: ['idle-info', showDetails],
    queryFn: async () => {
      if (!showDetails) return null;
      const response = await axios.get(`/api/spinlets/${showDetails}/idle-info`);
      return response.data;
    },
    enabled: !!showDetails,
    refetchInterval: 10000,
  });

  // Delete route mutation
  const deleteRouteMutation = useMutation({
    mutationFn: async (domain: string) => {
      const response = await axios.delete(`/api/routes/${domain}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Application removed successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to remove application');
    },
  });

  // Stop spinlet mutation
  const stopSpinletMutation = useMutation({
    mutationFn: async (spinletId: string) => {
      const response = await axios.post(`/api/spinlets/${spinletId}/stop`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spinlets'] });
      toast.success('Application stopped');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to stop application');
    },
  });

  // Restart spinlet mutation
  const restartSpinletMutation = useMutation({
    mutationFn: async (spinletId: string) => {
      const response = await axios.post(`/api/spinlets/${spinletId}/restart`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spinlets'] });
      toast.success('Application restarted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to restart application');
    },
  });

  // Wake up spinlet mutation
  const wakeUpMutation = useMutation({
    mutationFn: async (spinletId: string) => {
      const response = await axios.post(`/api/spinlets/${spinletId}/wake`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spinlets'] });
      toast.success('Application is waking up');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to wake application');
    },
  });

  // Retry deployment mutation
  const retryDeploymentMutation = useMutation({
    mutationFn: async (deploymentName: string) => {
      const response = await axios.post(`/api/deployments/${deploymentName}/retry`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      toast.success('Deployment retry started');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to retry deployment');
    },
  });

  const getStateColor = (state: string) => {
    switch (state) {
      case 'running':
        return 'text-green-600 bg-green-100';
      case 'idle':
        return 'text-yellow-600 bg-yellow-100';
      case 'stopped':
        return 'text-gray-600 bg-gray-100';
      case 'crashed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const isLoading = routesLoading || spinletsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const appGroups = routes?.reduce((acc, route) => {
    const key = route.customerId + '-' + route.spinletId;
    if (!acc[key]) {
      acc[key] = {
        ...route,
        domains: [route.domain],
      };
    } else {
      acc[key].domains.push(route.domain);
    }
    return acc;
  }, {} as Record<string, Route & { domains: string[] }>);

  const applications = Object.values(appGroups || {});

  return (
    <div className="p-6 space-y-6">
      {/* Description */}
      <p className="text-sm text-gray-500">
        View and manage your running applications
      </p>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {applications.map((app) => {
          const spinlet = spinlets?.[app.spinletId];
          const isIdle = spinlet?.state === 'idle';
          const isCrashed = spinlet?.state === 'crashed';
          const isStopped = spinlet?.state === 'stopped';
          
          return (
            <div
              key={app.spinletId}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      isCrashed ? 'bg-red-100' : 
                      isIdle ? 'bg-yellow-100' : 
                      isStopped ? 'bg-gray-100' :
                      'bg-blue-100'
                    }`}>
                      <Package className={`h-5 w-5 ${
                        isCrashed ? 'text-red-600' : 
                        isIdle ? 'text-yellow-600' : 
                        isStopped ? 'text-gray-600' :
                        'text-blue-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {app.spinletId.replace(`${app.customerId}-`, '')}
                      </h3>
                      <p className="text-sm text-gray-500">{app.framework}</p>
                    </div>
                  </div>
                  {spinlet && (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStateColor(spinlet.state)}`}>
                      {spinlet.state}
                    </span>
                  )}
                </div>

                {/* Domains */}
                <div className="space-y-2 mb-4">
                  {app.domains.map((domain) => (
                    <a
                      key={domain}
                      href={`https://${domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Globe className="h-4 w-4" />
                      <span>{domain}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>

                {/* Idle Warning */}
                {isIdle && idleInfo && showDetails === app.spinletId && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Timer className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-yellow-800 font-medium">
                          Application is idle
                        </p>
                        <p className="text-yellow-700">
                          Idle for {idleInfo.idleMinutes} minutes
                        </p>
                        <p className="text-yellow-600 text-xs mt-1">
                          Will shut down at {new Date(idleInfo.willShutdownAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Crashed Error */}
                {isCrashed && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-sm text-red-800">
                        Application crashed. Check logs for details.
                      </p>
                    </div>
                  </div>
                )}

                {/* Stats */}
                {spinlet && spinlet.state === 'running' && (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Uptime</p>
                      <p className="text-sm font-medium">
                        {formatUptime(Date.now() - spinlet.startTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Requests</p>
                      <p className="text-sm font-medium">{spinlet.requests}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Memory</p>
                      <p className="text-sm font-medium">
                        {Math.round(spinlet.memory / 1024 / 1024)}MB
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {isIdle && (
                    <button
                      onClick={() => wakeUpMutation.mutate(app.spinletId)}
                      disabled={wakeUpMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" />
                      Wake Up
                    </button>
                  )}
                  {isCrashed && (
                    <button
                      onClick={() => restartSpinletMutation.mutate(app.spinletId)}
                      disabled={restartSpinletMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <RotateCw className="h-4 w-4" />
                      Restart
                    </button>
                  )}
                  {spinlet && spinlet.state === 'running' && (
                    <>
                      <button
                        onClick={() => setShowDetails(
                          showDetails === app.spinletId ? null : app.spinletId
                        )}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                      >
                        <Activity className="h-4 w-4" />
                        Details
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/applications/${app.spinletId}`)}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                      >
                        <Settings className="h-4 w-4" />
                        Manage
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Remove application ${app.spinletId}?`)) {
                        deleteRouteMutation.mutate(app.domains[0]);
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Expanded Details */}
                {showDetails === app.spinletId && spinlet && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Process ID</p>
                        <p className="font-medium">{spinlet.pid || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Port</p>
                        <p className="font-medium">{spinlet.port}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">CPU Usage</p>
                        <p className="font-medium">{spinlet.cpu.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Errors</p>
                        <p className="font-medium">{spinlet.errors}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Last Activity</p>
                        <p className="font-medium">
                          {formatDeploymentTime(new Date(spinlet.lastAccess).toISOString())}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Resources</p>
                        <p className="font-medium">
                          {app.config?.memory || '512MB'} / {app.config?.cpu || '0.5'} CPU
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {(!applications || applications.length === 0) && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No applications deployed
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Deploy your first application to get started.
          </p>
          <div className="mt-6">
            <button
              onClick={() => router.push('/dashboard/deployments')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Deploy Application
            </button>
          </div>
        </div>
      )}
    </div>
  );
}