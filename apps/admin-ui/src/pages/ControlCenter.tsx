/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Monitor, 
  Server, 
  Database, 
  Globe, 
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Terminal,
  Clock,
  MemoryStick,
  Cpu,
  HardDrive,
  Grid3X3,
  Package,
  Upload,
  LayoutDashboard,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, Route, Spinlet, IdleInfo } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';

export default function ControlCenter() {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const { data: allMetrics, isLoading } = useQuery({
    queryKey: ['all-metrics'],
    queryFn: () => api.allMetrics(),
    refetchInterval: 5000,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: () => api.getRoutesWithStates(),
    refetchInterval: 5000,
  });

  const runningSpinlets = routes.filter(r => r.spinletState?.state === 'running');

  const services = [
    {
      id: 'keydb',
      name: 'KeyDB',
      icon: Database,
      color: 'from-red-500 to-red-600',
      description: 'In-memory data structure store',
      metrics: allMetrics?.keydb,
      health: allMetrics?.services?.find(s => s.name === 'KeyDB'),
    },
    {
      id: 'nginx',
      name: 'Nginx',
      icon: Globe,
      color: 'from-green-500 to-green-600',
      description: 'Web server and reverse proxy',
      health: allMetrics?.services?.find(s => s.name === 'Nginx'),
    },
    {
      id: 'spinhub',
      name: 'SpinHub',
      icon: Server,
      color: 'from-blue-500 to-blue-600',
      description: 'Application orchestration service',
      health: allMetrics?.services?.find(s => s.name === 'SpinHub'),
    },
    {
      id: 'postgresql',
      name: 'PostgreSQL',
      icon: Database,
      color: 'from-purple-500 to-purple-600',
      description: 'Relational database',
      health: allMetrics?.services?.find(s => s.name === 'PostgreSQL'),
    },
  ];

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
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
                    Control Center
                  </h1>
                  <p className="text-sm text-gray-500">Monitor and manage all SpinForge services</p>
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
              <button className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl">
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm font-medium">Refresh</span>
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
          {/* Page Header */}
          <div className="mb-8">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              System Control Center
            </h2>
            <p className="text-lg text-gray-600 mt-2">Real-time monitoring and management</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
            >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Cpu className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">CPU Usage</p>
                  <p className="text-2xl font-bold">{allMetrics?.system.cpu.usage.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MemoryStick className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Memory Usage</p>
                  <p className="text-2xl font-bold">{allMetrics?.system.memory.usagePercent.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <HardDrive className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Disk Usage</p>
                  <p className="text-2xl font-bold">{allMetrics?.system.disk.usagePercent.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Uptime</p>
                  <p className="text-2xl font-bold">{formatUptime(allMetrics?.system.process.uptime || 0)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {services.map((service, index) => {
            const Icon = service.icon;
            const isHealthy = service.health?.status === 'healthy';
            
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => setSelectedService(service.id)}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-3 bg-gradient-to-r ${service.color} rounded-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{service.name}</h3>
                        <p className="text-sm text-gray-500">{service.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isHealthy ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className={`text-sm font-medium ${isHealthy ? 'text-green-700' : 'text-red-700'}`}>
                        {service.health?.status || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  {/* Service-specific metrics */}
                  {service.id === 'keydb' && service.metrics && (
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-gray-500">Clients</p>
                        <p className="font-medium">{service.metrics.info.connectedClients}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Memory</p>
                        <p className="font-medium">{service.metrics.info.usedMemoryHuman}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Keys</p>
                        <p className="font-medium">{service.metrics.info.totalKeys}</p>
                      </div>
                    </div>
                  )}

                  {service.health && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Uptime</span>
                        <span className="font-medium">{formatUptime(service.health.uptime)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end mt-4">
                    <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center">
                      View Details
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Docker Containers */}
        {allMetrics?.docker.containers && allMetrics.docker.containers.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Docker Containers</h2>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Container
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CPU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Memory
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Network I/O
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allMetrics.docker.containers.map((container) => (
                    <tr key={container.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{container.name}</div>
                          <div className="text-sm text-gray-500">{container.image}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          container.status === 'running' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {container.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {container.cpu.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatBytes(container.memory.usage)} / {formatBytes(container.memory.limit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ↓ {formatBytes(container.network.rx)} / ↑ {formatBytes(container.network.tx)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Running Spinlets */}
        {runningSpinlets.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Running Applications</h2>
              <span className="text-sm text-gray-500">{runningSpinlets.length} active</span>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Application
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Port
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uptime
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Idle Timeout
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
                  {runningSpinlets.map((route: Route & { spinletState?: Spinlet; idleInfo?: IdleInfo }) => (
                    <tr key={route.spinletId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <Globe className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{route.domain}</div>
                            <div className="text-xs text-gray-500">{route.spinletState?.spinletId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">{route.spinletState?.port || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {route.spinletState?.startTime 
                            ? formatUptime((Date.now() - route.spinletState.startTime) / 1000)
                            : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {route.idleInfo ? (
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-gray-400" />
                            <span className={`text-sm font-medium ${
                              route.idleInfo.ttl < 60 ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              {route.idleInfo.timeRemainingFormatted}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {route.spinletState?.requests || 0}
                          {route.spinletState?.errors ? (
                            <span className="text-xs text-red-600 ml-1">({route.spinletState.errors} errors)</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3 text-sm">
                          <div className="flex items-center">
                            <MemoryStick className="h-4 w-4 mr-1 text-gray-400" />
                            <span>{route.spinletState?.memory || 0} MB</span>
                          </div>
                          <div className="flex items-center">
                            <Cpu className="h-4 w-4 mr-1 text-gray-400" />
                            <span>{route.spinletState?.cpu || 0}%</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center space-x-4">
          <button
            onClick={() => navigate('/modern-dashboard')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
          >
            <Activity className="h-5 w-5" />
            <span>View Analytics</span>
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
          >
            <Terminal className="h-5 w-5" />
            <span>Admin Console</span>
          </button>
        </div>
        </motion.div>
      </div>
    </div>
  );
}