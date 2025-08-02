import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { 
  Activity,
  Server,
  Clock,
  Timer,
  Cpu,
  HardDrive,
  Hash,
  Globe,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Zap,
  Grid3X3,
  Package,
  Upload,
  LayoutDashboard
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatLastAccess(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return `${seconds}s ago`;
  }
}

export default function ActiveSpinlets() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: routesWithStates = [], isLoading, error } = useQuery({
    queryKey: ['active-spinlets'],
    queryFn: async () => {
      const routes = await api.getRoutesWithStates();
      // Filter only running spinlets
      return routes.filter(r => r.spinletState?.state === 'running');
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const totalActive = routesWithStates.length;
  const totalRequests = routesWithStates.reduce((sum, r) => sum + (r.spinletState?.requests || 0), 0);
  const totalErrors = routesWithStates.reduce((sum, r) => sum + (r.spinletState?.errors || 0), 0);
  const totalMemory = routesWithStates.reduce((sum, r) => sum + (r.spinletState?.memory || 0), 0);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading active spinlets</h3>
                <p className="mt-2 text-sm text-red-700">{error instanceof Error ? error.message : 'Unknown error'}</p>
              </div>
            </div>
          </div>
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
                  <Grid3X3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Active Spinlets
                  </h1>
                  <p className="text-sm text-gray-500">Real-time monitoring of running processes</p>
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
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <Globe className="w-4 h-4" />
                    <span className="hidden xl:inline">Hosting</span>
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Auto-refresh (5s)</span>
              </label>
              {isLoading && (
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
              )}
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
          {/* Page Header */}
          <div className="mb-8">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Running Processes
            </h2>
            <p className="text-lg text-gray-600 mt-2">
              Real-time monitoring of currently active spinlet processes
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Spinlets</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalActive}</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Requests</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalRequests.toLocaleString()}</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="flex items-center">
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Errors</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalErrors}</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <HardDrive className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Memory Usage</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatMemory(totalMemory)}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Active Spinlets Table */}
          <motion.div 
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            {isLoading && routesWithStates.length === 0 ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : routesWithStates.length === 0 ? (
              <div className="text-center p-12">
                <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
                  <Zap className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No active spinlets</h3>
                <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                  All spinlets are currently idle or stopped. They will automatically start when accessed.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Spinlet ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Domain
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Process
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uptime
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Access
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        TTL
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requests
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resources
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {routesWithStates.map((route) => {
                      const spinlet = route.spinletState!;
                      const idleInfo = route.idleInfo;
                      const uptime = Date.now() - spinlet.startTime;
                      
                      return (
                        <tr key={route.spinletId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Hash className="h-4 w-4 text-gray-400 mr-2" />
                              <div>
                                <div className="text-sm font-medium text-gray-900 font-mono">
                                  {spinlet.spinletId}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {route.customerId}
                                </div>
                                {spinlet.mode && (
                                  <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    spinlet.mode === 'development' 
                                      ? 'bg-purple-100 text-purple-700' 
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {spinlet.mode === 'development' ? 'DEV' : 'PROD'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Globe className="h-4 w-4 text-gray-400 mr-2" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {route.domain}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {route.framework}
                                  {spinlet.packageVersion && (
                                    <span className="ml-2">v{spinlet.packageVersion}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="flex items-center">
                                <Server className="h-4 w-4 text-gray-400 mr-1" />
                                <span className="font-medium text-gray-900">Port: {spinlet.port}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                PID: {spinlet.pid}
                              </div>
                              {spinlet.runCommand && (
                                <div className="text-xs text-gray-400 mt-1 font-mono truncate max-w-xs" title={spinlet.runCommand}>
                                  {spinlet.runCommand}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-900">
                                {formatUptime(uptime)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatLastAccess(spinlet.lastAccess)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(spinlet.lastAccess).toLocaleTimeString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {idleInfo ? (
                              <div className="flex items-center">
                                <Timer className="h-4 w-4 text-gray-400 mr-2" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {idleInfo.timeRemainingFormatted}
                                  </div>
                                  {idleInfo.ttl < 60 && (
                                    <div className="text-xs text-red-600 font-medium">
                                      Expires soon
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="flex items-center">
                                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                                <span className="text-gray-900">{spinlet.requests.toLocaleString()}</span>
                              </div>
                              {spinlet.errors > 0 && (
                                <div className="flex items-center mt-1">
                                  <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                                  <span className="text-red-600 text-xs">{spinlet.errors} errors</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="flex items-center">
                                <HardDrive className="h-4 w-4 text-gray-400 mr-1" />
                                <span className="text-gray-900">{formatMemory(spinlet.memory)}</span>
                              </div>
                              <div className="flex items-center mt-1">
                                <Cpu className="h-4 w-4 text-gray-400 mr-1" />
                                <span className="text-xs text-gray-500">{spinlet.cpu.toFixed(1)}%</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Additional Info */}
          {routesWithStates.length > 0 && (
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <div className="flex">
                <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-gray-900">Process Information</h3>
                  <div className="mt-2 text-sm text-gray-600">
                    <p>This page shows real-time information about running spinlet processes.</p>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                      <li>PID: Process ID assigned by the operating system</li>
                      <li>Port: Network port the spinlet is listening on</li>
                      <li>TTL: Time To Live - remaining idle timeout before automatic shutdown</li>
                      <li>Memory/CPU: Real-time resource usage metrics</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}