import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Package, 
  Server, 
  HardDrive,
  Cpu,
  Network,
  Database,
  Globe,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  X
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function ModernDashboard() {
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 5000,
  });

  const { data: allMetrics } = useQuery({
    queryKey: ['allMetrics'],
    queryFn: () => api.allMetrics(),
    refetchInterval: 5000,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: () => api.getAllRoutes(),
    refetchInterval: 10000,
  });

  const { data: requestMetrics } = useQuery({
    queryKey: ['requestMetrics'],
    queryFn: () => api.requestMetrics(),
    refetchInterval: 5000,
  });

  const { data: deploymentStats } = useQuery({
    queryKey: ['deploymentStats'],
    queryFn: () => api.deploymentStats(),
    refetchInterval: 30000,
  });

  // Use real metrics data
  const systemMetrics = allMetrics?.system;
  const dockerStats = allMetrics?.docker;
  const keydbMetrics = allMetrics?.keydb;
  const services = allMetrics?.services || [];

  // Create real-time snapshot data (showing current values)
  const currentTime = new Date();
  const minutes = Array.from({ length: 10 }, (_, i) => {
    const time = new Date(currentTime.getTime() - (9 - i) * 60000);
    return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  });
  
  // For now, show current values as a flat line (since we don't have historical data)
  const realtimeData = minutes.map(time => ({
    time,
    cpu: systemMetrics?.cpu.usage || 0,
    memory: systemMetrics?.memory.usagePercent || 0,
    disk: systemMetrics?.disk.usagePercent || 0,
  }));

  // Framework distribution
  const frameworkData = routes.reduce((acc, route) => {
    const framework = route.framework;
    const existing = acc.find(item => item.name === framework);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: framework, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const metricCards = [
    {
      title: 'System Health',
      value: services.every(s => s.status === 'healthy') ? 'All Healthy' : 'Issues Detected',
      icon: services.every(s => s.status === 'healthy') ? CheckCircle : AlertCircle,
      color: services.every(s => s.status === 'healthy') ? 'from-green-400 to-green-600' : 'from-red-400 to-red-600',
      bgColor: services.every(s => s.status === 'healthy') ? 'bg-green-50' : 'bg-red-50',
      textColor: services.every(s => s.status === 'healthy') ? 'text-green-700' : 'text-red-700',
      subtitle: `${services.filter(s => s.status === 'healthy').length}/${services.length} services`,
    },
    {
      title: 'Docker Containers',
      value: dockerStats?.running || 0,
      icon: Package,
      color: 'from-blue-400 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      subtitle: `${dockerStats?.total || 0} total`,
    },
    {
      title: 'CPU Usage',
      value: `${systemMetrics?.cpu.usage || 0}%`,
      icon: Cpu,
      color: 'from-purple-400 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      progress: systemMetrics?.cpu.usage || 0,
      subtitle: `${systemMetrics?.cpu.cores || 0} cores`,
    },
    {
      title: 'Memory Usage',
      value: `${systemMetrics?.memory.usagePercent || 0}%`,
      icon: HardDrive,
      color: 'from-orange-400 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      progress: systemMetrics?.memory.usagePercent || 0,
      subtitle: `${((systemMetrics?.memory.used || 0) / 1024 / 1024 / 1024).toFixed(1)}GB / ${((systemMetrics?.memory.total || 0) / 1024 / 1024 / 1024).toFixed(1)}GB`,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            SpinForge Dashboard
          </h1>
          <p className="text-gray-600 mt-2">Real-time system monitoring and analytics</p>
        </motion.div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metricCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden ${
                  card.title === 'System Health' && !services.every(s => s.status === 'healthy') 
                    ? 'cursor-pointer hover:shadow-xl transition-shadow' 
                    : ''
                }`}
                onClick={() => {
                  if (card.title === 'System Health' && !services.every(s => s.status === 'healthy')) {
                    setShowHealthDetails(true);
                  }
                }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-5`} />
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl ${card.bgColor}`}>
                      <Icon className={`h-6 w-6 ${card.textColor}`} />
                    </div>
                    <TrendingUp className="h-5 w-5 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-600">{card.title}</h3>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                  {card.subtitle && (
                    <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
                  )}
                  {card.title === 'System Health' && !services.every(s => s.status === 'healthy') && (
                    <div className="flex items-center space-x-1 mt-2">
                      <Info className="h-3 w-3 text-red-600" />
                      <p className="text-xs text-red-600 font-medium">Click for details</p>
                    </div>
                  )}
                  {card.progress !== undefined && (
                    <div className="mt-4">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${card.progress}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full bg-gradient-to-r ${card.color}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* CPU & Memory Usage */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Resource Usage (Live)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={realtimeData}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Area type="monotone" dataKey="cpu" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                <Area type="monotone" dataKey="memory" stroke="#3b82f6" fillOpacity={1} fill="url(#colorMemory)" name="Memory %" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Container Stats */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Docker Container Stats</h3>
            {dockerStats?.containers && dockerStats.containers.length > 0 ? (
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {dockerStats.containers.map((container, idx) => (
                  <div key={container.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">{container.name}</p>
                        <p className="text-xs text-gray-500">{container.image}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        container.status.includes('Up') ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {container.status}
                      </span>
                    </div>
                    {container.status.includes('Up') && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">CPU:</span>
                          <span className="ml-1 font-medium">{container.cpu.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Memory:</span>
                          <span className="ml-1 font-medium">{container.memory.percent.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Network:</span>
                          <span className="ml-1 font-medium">
                            ↓{(container.network.rx / 1024 / 1024).toFixed(1)}MB ↑{(container.network.tx / 1024 / 1024).toFixed(1)}MB
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500">
                No containers running
              </div>
            )}
          </motion.div>
        </div>

        {/* Framework Distribution and Port Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Framework Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Framework Distribution</h3>
            {frameworkData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={frameworkData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {frameworkData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No applications deployed
              </div>
            )}
          </motion.div>

          {/* Port Usage */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl shadow-lg p-6 lg:col-span-2"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">System Resources</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Disk Usage</span>
                  <span className="font-medium">
                    {((systemMetrics?.disk.used || 0) / 1024 / 1024 / 1024).toFixed(1)}GB / {((systemMetrics?.disk.total || 0) / 1024 / 1024 / 1024).toFixed(1)}GB
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${systemMetrics?.disk.usagePercent || 0}%` 
                    }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
                  <Database className="h-8 w-8 text-blue-600 mb-2" />
                  <p className="text-sm text-gray-600">KeyDB Status</p>
                  <p className="text-2xl font-bold text-gray-900">{keydbMetrics?.connected ? 'Connected' : 'Disconnected'}</p>
                  <p className="text-xs text-gray-500 mt-1">{keydbMetrics?.info.totalKeys || 0} keys</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
                  <Activity className="h-8 w-8 text-green-600 mb-2" />
                  <p className="text-sm text-gray-600">Ops/Second</p>
                  <p className="text-2xl font-bold text-gray-900">{keydbMetrics?.stats.opsPerSec || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{keydbMetrics?.stats.hitRate || 0}% hit rate</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Health Details Modal */}
      <AnimatePresence>
        {showHealthDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowHealthDetails(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">System Health Details</h2>
                  <button
                    onClick={() => setShowHealthDetails(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                <p className="text-gray-600 mt-1">
                  {services.filter(s => s.status !== 'healthy').length} service(s) experiencing issues
                </p>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                  {services.map((service, idx) => {
                    const isHealthy = service.status === 'healthy';
                    const StatusIcon = isHealthy ? CheckCircle : service.status === 'degraded' ? AlertTriangle : XCircle;
                    const statusColor = isHealthy ? 'text-green-600' : service.status === 'degraded' ? 'text-yellow-600' : 'text-red-600';
                    const bgColor = isHealthy ? 'bg-green-50' : service.status === 'degraded' ? 'bg-yellow-50' : 'bg-red-50';
                    
                    return (
                      <div key={idx} className={`border rounded-lg p-4 ${bgColor}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <StatusIcon className={`h-6 w-6 ${statusColor} mt-0.5`} />
                            <div>
                              <h3 className="font-semibold text-gray-900">{service.name}</h3>
                              <p className={`text-sm ${statusColor} font-medium`}>
                                Status: {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                              </p>
                              
                              {/* Service-specific details */}
                              <div className="mt-3 space-y-2">
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <Clock className="h-4 w-4" />
                                  <span>Uptime: {formatUptime(service.uptime)}</span>
                                </div>
                                
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <Info className="h-4 w-4" />
                                  <span>Last check: {new Date(service.lastCheck).toLocaleString()}</span>
                                </div>

                                {/* Show specific issues if unhealthy */}
                                {!isHealthy && service.details && (
                                  <div className="mt-3 p-3 bg-white rounded-md">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Issues:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                      {Object.entries(service.details).map(([key, value]) => (
                                        <li key={key} className="text-sm text-gray-600">
                                          <span className="font-medium">{key}:</span> {String(value)}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Suggested actions */}
                                {!isHealthy && (
                                  <div className="mt-3 p-3 bg-blue-50 rounded-md">
                                    <p className="text-sm font-medium text-blue-900 mb-1">Suggested Actions:</p>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
                                      {service.name === 'SpinHub' && (
                                        <>
                                          <li>Check SpinHub logs: <code className="bg-blue-100 px-1 rounded">docker logs spinforge-hub</code></li>
                                          <li>Restart service: <code className="bg-blue-100 px-1 rounded">docker-compose restart spinhub</code></li>
                                        </>
                                      )}
                                      {service.name === 'KeyDB' && (
                                        <>
                                          <li>Check KeyDB status: <code className="bg-blue-100 px-1 rounded">docker exec spinforge-keydb redis-cli ping</code></li>
                                          <li>Check memory usage: <code className="bg-blue-100 px-1 rounded">docker exec spinforge-keydb redis-cli info memory</code></li>
                                        </>
                                      )}
                                      {service.name === 'Nginx' && (
                                        <>
                                          <li>Check Nginx config: <code className="bg-blue-100 px-1 rounded">docker exec spinforge-nginx nginx -t</code></li>
                                          <li>View error logs: <code className="bg-blue-100 px-1 rounded">docker logs spinforge-nginx</code></li>
                                        </>
                                      )}
                                      {service.name === 'PostgreSQL' && (
                                        <>
                                          <li>Check database connection: <code className="bg-blue-100 px-1 rounded">docker exec spinforge-db pg_isready</code></li>
                                          <li>View database logs: <code className="bg-blue-100 px-1 rounded">docker logs spinforge-db</code></li>
                                        </>
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Quick action button */}
                          <button
                            onClick={() => {
                              // In a real implementation, this would trigger a restart
                              console.log(`Restart ${service.name}`);
                            }}
                            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Restart
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Need help? Check the <a href="/docs" className="text-indigo-600 hover:text-indigo-800">documentation</a> or view <a href="/logs" className="text-indigo-600 hover:text-indigo-800">system logs</a>.
                  </p>
                  <button
                    onClick={() => setShowHealthDetails(false)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};