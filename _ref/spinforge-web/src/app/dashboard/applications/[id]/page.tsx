"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  ArrowLeft,
  Activity,
  Server,
  Terminal,
  Settings,
  RefreshCw,
  Trash2,
  Save,
  Plus,
  X,
  Globe,
  ExternalLink,
  Clock,
  Cpu,
  HardDrive,
  Network
} from 'lucide-react';

export default function ApplicationDetail() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const spinletId = params.id as string;
  
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [showLogs, setShowLogs] = useState(false);

  // Fetch spinlet details
  const { data: spinlet, isLoading } = useQuery({
    queryKey: ['spinlet', spinletId],
    queryFn: async () => {
      const response = await axios.get(`/api/spinlets/${spinletId}`);
      return response.data;
    },
  });

  // Fetch spinlet logs
  const { data: logs } = useQuery({
    queryKey: ['spinlet-logs', spinletId],
    queryFn: async () => {
      const response = await axios.get(`/api/spinlets/${spinletId}/logs`);
      return response.data;
    },
    enabled: showLogs,
    refetchInterval: showLogs ? 5000 : false,
  });

  // Update environment variables
  const updateEnvMutation = useMutation({
    mutationFn: async (env: Record<string, string>) => {
      const response = await axios.put(`/api/spinlets/${spinletId}/env`, { env });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spinlet', spinletId] });
      toast.success('Environment variables updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update environment');
    },
  });

  // Restart spinlet
  const restartMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/spinlets/${spinletId}/restart`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spinlet', spinletId] });
      toast.success('Application restarted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to restart application');
    },
  });

  // Stop spinlet
  const stopMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/spinlets/${spinletId}/stop`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spinlet', spinletId] });
      toast.success('Application stopped');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to stop application');
    },
  });

  const handleAddEnvVar = () => {
    if (newEnvKey && newEnvValue) {
      const newEnv = { ...envVars, [newEnvKey]: newEnvValue };
      setEnvVars(newEnv);
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  const handleRemoveEnvVar = (key: string) => {
    const newEnv = { ...envVars };
    delete newEnv[key];
    setEnvVars(newEnv);
  };

  const handleSaveEnv = () => {
    updateEnvMutation.mutate(envVars);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!spinlet) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Server className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Application not found
          </h3>
          <div className="mt-6">
            <button
              onClick={() => router.push('/dashboard/applications')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Applications
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/applications')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Applications
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {spinletId.replace(`${spinlet.customerId}-`, '')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage application settings and configuration
            </p>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStateColor(spinlet.state)}`}>
            {spinlet.state}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Overview</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Port</p>
                <p className="font-medium">{spinlet.port}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Process ID</p>
                <p className="font-medium">{spinlet.pid || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Start Time</p>
                <p className="font-medium">
                  {new Date(spinlet.startTime).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Access</p>
                <p className="font-medium">
                  {new Date(spinlet.lastAccess).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Requests</p>
                <p className="font-medium">{spinlet.requests}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Errors</p>
                <p className="font-medium text-red-600">{spinlet.errors}</p>
              </div>
            </div>
          </div>

          {/* Resource Usage */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Resource Usage</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">CPU Usage</span>
                  </div>
                  <span className="text-sm text-gray-900">{spinlet.cpu.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min(spinlet.cpu, 100)}%` }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">Memory Usage</span>
                  </div>
                  <span className="text-sm text-gray-900">
                    {Math.round(spinlet.memory / 1024 / 1024)}MB
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Math.min((spinlet.memory / 512 / 1024 / 1024) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Environment Variables</h2>
              <button
                onClick={handleSaveEnv}
                disabled={updateEnvMutation.isPending}
                className="inline-flex items-center px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </button>
            </div>
            
            <div className="space-y-2">
              {Object.entries(envVars).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={key}
                    disabled
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setEnvVars({ ...envVars, [key]: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                  <button
                    onClick={() => handleRemoveEnvVar(key)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              {/* Add new env var */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <input
                  type="text"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  placeholder="Key"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
                />
                <input
                  type="text"
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
                />
                <button
                  onClick={handleAddEnvVar}
                  disabled={!newEnvKey || !newEnvValue}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Application Logs</h2>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Terminal className="h-4 w-4 mr-1" />
                {showLogs ? 'Hide' : 'Show'} Logs
              </button>
            </div>
            
            {showLogs && (
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                {logs ? (
                  <pre>{logs}</pre>
                ) : (
                  <p className="text-gray-500">Loading logs...</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Actions & Domains */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => restartMutation.mutate()}
                disabled={restartMutation.isPending || spinlet.state === 'stopped'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Restart Application
              </button>
              
              <button
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending || spinlet.state === 'stopped'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <Server className="h-4 w-4" />
                Stop Application
              </button>
              
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this application?')) {
                    // TODO: Implement delete
                    toast.error('Delete not implemented yet');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-md hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete Application
              </button>
            </div>
          </div>

          {/* Domains */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Domains</h2>
            <div className="space-y-2">
              {spinlet.domains?.map((domain: string) => (
                <a
                  key={domain}
                  href={`https://${domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md"
                >
                  <Globe className="h-4 w-4" />
                  <span className="flex-1">{domain}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}