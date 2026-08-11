/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { config } from '../config/environment';
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
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  BarChart3,
  ExternalLink,
  AlertTriangle,
  Info,
  X,
  Grid3X3,
  ChevronRight,
  Users,
  Shield,
  Gauge,
  Monitor,
  Code,
  FileText,
  PieChart as PieChartIcon
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

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface MetricCardData {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: any;
  color: string;
  bgColor: string;
  textColor: string;
  subtitle?: string;
  progress?: number;
  trend?: number[];
}

type DashboardTab = 'overview' | 'infrastructure' | 'analytics' | 'deployments';

export default function UnifiedDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  
  // Fetch all data
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const { data: allMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['allMetrics'],
    queryFn: () => api.allMetrics(),
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: () => api.getAllRoutes(),
    refetchInterval: autoRefresh ? refreshInterval * 2 : false,
  });

  const { data: metrics } = useQuery({
    queryKey: ['basicMetrics'],
    queryFn: () => api.metrics(),
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const { data: requestMetrics } = useQuery({
    queryKey: ['requestMetrics'],
    queryFn: () => api.requestMetrics(),
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const { data: deploymentStats } = useQuery({
    queryKey: ['deploymentStats'],
    queryFn: () => api.deploymentStats(),
    refetchInterval: autoRefresh ? refreshInterval * 6 : false,
  });

  const { data: bandwidthMetrics } = useQuery({
    queryKey: ['bandwidthMetrics'],
    queryFn: () => api.request('get', '/api/_metrics/bandwidth'),
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  // Extract metrics
  const systemMetrics = allMetrics?.system;
  const dockerStats = allMetrics?.docker;
  const keydbMetrics = allMetrics?.keydb;
  const services = allMetrics?.services || [];
  const nginxStats = allMetrics?.nginx;

  // Analytics data processing
  const requestDistribution = [
    { name: 'SpinHub API', value: requestMetrics?.spinhub || 0, color: '#8b5cf6' },
    { name: 'Applications', value: (requestMetrics?.total || 0) - (requestMetrics?.spinhub || 0), color: '#3b82f6' }
  ];

  const statusCodeData = Object.entries(requestMetrics?.byStatus || {}).map(([code, count]) => ({
    name: code.startsWith('2') ? `${code} OK` : code.startsWith('4') ? `${code} Client Error` : `${code} Server Error`,
    value: count as number,
    color: code.startsWith('2') ? '#10b981' : code.startsWith('4') ? '#f59e0b' : '#ef4444'
  }));

  const topDomains = Object.entries(requestMetrics?.byDomain || {})
    .sort(([, a], [, b]) => ((b as any)?.requests || 0) - ((a as any)?.requests || 0))
    .slice(0, 5)
    .map(([domain, data]) => ({
      domain,
      requests: (data as any)?.requests || 0,
      avgResponseTime: (data as any)?.avgResponseTime || 0,
      bandwidth: (data as any)?.bandwidth || 0,
      bandwidthFormatted: (data as any)?.bandwidthFormatted || formatBytes((data as any)?.bandwidth || 0)
    }));

  const frameworkDeployments = Object.entries(deploymentStats?.byFramework || {}).map(([framework, count]) => ({
    name: framework,
    value: count as number
  }));

  // Calculate aggregate metrics from actual API data
  const totalRequests = requestMetrics?.total || metrics?.totalRequests || 0;
  const totalErrors = requestMetrics?.errors || metrics?.totalErrors || 0;
  const errorRate = requestMetrics?.errorRate || metrics?.errorRate || 0;
  const avgResponseTime = requestMetrics?.avgResponseTime || 0;
  const requestsPerSecond = keydbMetrics?.stats?.opsPerSec || 0;
  
  // Bandwidth metrics
  const totalBandwidth = bandwidthMetrics?.totalBandwidth || requestMetrics?.totalBandwidth || 0;
  const bandwidthOut = bandwidthMetrics?.totalBandwidthOut || 0;
  const bandwidthIn = bandwidthMetrics?.totalBandwidthIn || 0;
  
  // Site counts
  const activeSites = metrics?.activeSites || routes.length;
  const totalSites = metrics?.totalSites || routes.length;

  // Format bytes helper
  const formatBytes = (bytes, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  const allHealthy = services.every(s => s.status === 'healthy');
  const degradedServices = services.filter(s => s.status === 'degraded').length;
  const unhealthyServices = services.filter(s => s.status === 'unhealthy').length;

  // Time series data for charts (simplified - in real app this would come from time-series data)
  const currentTime = new Date();
  const timePoints = Array.from({ length: 12 }, (_, i) => {
    const time = new Date(currentTime.getTime() - (11 - i) * 5 * 60000);
    return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  });
  
  const performanceData = timePoints.map((time) => ({
    time,
    cpu: systemMetrics?.cpu.usage || 0,
    memory: systemMetrics?.memory.usagePercent || 0,
    requests: requestsPerSecond,
    responseTime: avgResponseTime,
  }));

  // Framework distribution
  const frameworkData = routes.reduce((acc, route) => {
    const framework = route.framework || 'Unknown';
    const existing = acc.find(item => item.name === framework);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: framework, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  // Main metric cards with modern design
  const metricCards: MetricCardData[] = [
    {
      title: 'System Health',
      value: allHealthy ? 'Operational' : degradedServices > 0 ? 'Degraded' : 'Critical',
      icon: allHealthy ? CheckCircle : degradedServices > 0 ? AlertTriangle : AlertCircle,
      color: allHealthy ? 'from-green-500 to-emerald-600' : degradedServices > 0 ? 'from-yellow-500 to-orange-600' : 'from-red-500 to-rose-600',
      bgColor: allHealthy ? 'bg-green-50' : degradedServices > 0 ? 'bg-yellow-50' : 'bg-red-50',
      textColor: allHealthy ? 'text-green-700' : degradedServices > 0 ? 'text-yellow-700' : 'text-red-700',
      subtitle: `${services.filter(s => s.status === 'healthy').length}/${services.length} services healthy`
    },
    {
      title: 'Active Sites',
      value: activeSites,
      icon: Package,
      color: 'from-indigo-500 to-purple-600',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700',
      subtitle: `${totalSites} total sites`
    },
    {
      title: 'Total Requests',
      value: totalRequests.toLocaleString(),
      icon: Activity,
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      subtitle: `${totalErrors} errors (${errorRate.toFixed(1)}% rate)`
    },
    {
      title: 'Avg Response Time',
      value: avgResponseTime.toFixed(0),
      unit: 'ms',
      icon: Clock,
      color: 'from-purple-500 to-pink-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      subtitle: 'Average response time'
    },
    {
      title: 'Total Bandwidth',
      value: formatBytes(totalBandwidth),
      icon: Network,
      color: 'from-cyan-500 to-blue-600',
      bgColor: 'bg-cyan-50',
      textColor: 'text-cyan-700',
      subtitle: `${formatBytes(bandwidthOut)} out, ${formatBytes(bandwidthIn)} in`
    },
    {
      title: 'Error Rate',
      value: errorRate.toFixed(1),
      unit: '%',
      icon: AlertTriangle,
      color: errorRate > 1 ? 'from-red-500 to-rose-600' : 'from-amber-500 to-yellow-600',
      bgColor: errorRate > 1 ? 'bg-red-50' : 'bg-amber-50',
      textColor: errorRate > 1 ? 'text-red-700' : 'text-amber-700',
      subtitle: errorRate > 1 ? 'High error rate' : 'Low error rate'
    }
  ];

  const getTrendIcon = (change?: number, changeType?: string) => {
    if (!change) return null;
    if (changeType === 'increase' || change > 0) return TrendingUp;
    if (changeType === 'decrease' || change < 0) return TrendingDown;
    return null;
  };

  const getTrendColor = (change?: number, changeType?: string) => {
    if (!change) return 'text-gray-500';
    
    // For metrics like error rate or response time, decrease is good
    if (changeType === 'decrease') return 'text-green-600';
    if (changeType === 'increase') return change > 0 ? 'text-green-600' : 'text-red-600';
    
    return change > 0 ? 'text-green-600' : 'text-red-600';
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const isLoading = healthLoading || metricsLoading || routesLoading;

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'infrastructure':
        return renderInfrastructureTab();
      case 'analytics':
        return renderAnalyticsTab();
      case 'deployments':
        return renderDeploymentsTab();
      default:
        return renderOverviewTab();
    }
  };

  const renderOverviewTab = () => (
    <>
      {/* System Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        {metricCards.slice(0, 6).map((card, index) => {
          const Icon = card.icon;
          const TrendIcon = getTrendIcon(card.change, card.changeType);
          
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 ${
                card.title === 'System Health' && !allHealthy
                  ? 'cursor-pointer hover:scale-[1.02]' 
                  : ''
              }`}
              onClick={() => {
                if (card.title === 'System Health' && !allHealthy) {
                  setShowHealthDetails(true);
                }
              }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${card.bgColor}`}>
                    <Icon className={`h-6 w-6 ${card.textColor}`} />
                  </div>
                  {card.trend && (
                    <div className="h-12 w-20">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={card.trend.map((v, i) => ({ value: v }))}>
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke={card.textColor.replace('text-', '#')} 
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 font-medium">{card.title}</p>
                  <div className="flex items-baseline mt-1">
                    <p className="text-2xl font-bold text-gray-900">
                      {card.value}
                    </p>
                    {card.unit && (
                      <span className="ml-1 text-lg text-gray-500">{card.unit}</span>
                    )}
                  </div>
                  
                  {card.subtitle && (
                    <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
                  )}
                  
                  {card.change !== undefined && (
                    <div className={`flex items-center mt-2 text-sm ${getTrendColor(card.change, card.changeType)}`}>
                      {TrendIcon && <TrendIcon className="h-4 w-4 mr-1" />}
                      <span className="font-medium">{Math.abs(card.change)}%</span>
                      <span className="text-gray-500 ml-1">vs last period</span>
                    </div>
                  )}
                </div>
                
                {card.title === 'System Health' && !allHealthy && (
                  <div className="absolute bottom-2 right-2">
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Performance Overview Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Performance Overview</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                <span className="text-gray-600">CPU</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-gray-600">Memory</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={performanceData}>
              <defs>
                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
                }}
              />
              <Area type="monotone" dataKey="cpu" stroke="#6366f1" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" strokeWidth={2} />
              <Area type="monotone" dataKey="memory" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMemory)" name="Memory %" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Quick Stats</h3>
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="h-6 w-6 text-indigo-600" />
                <span className="text-sm font-medium text-gray-700">Total Requests</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{(requestMetrics?.total || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">All time requests</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <span className="text-sm font-medium text-gray-700">KeyDB Status</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{keydbMetrics?.connected ? 'Connected' : 'Disconnected'}</p>
              <p className="text-xs text-gray-500 mt-1">{keydbMetrics?.stats.hitRate || 0}% hit rate</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Globe className="h-6 w-6 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Active Apps</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{routes.length}</p>
              <p className="text-xs text-gray-500 mt-1">{dockerStats?.running || 0} containers</p>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );

  const renderInfrastructureTab = () => (
    <>
      {/* Resource Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Resource Utilization</h3>
          <div className="space-y-6">
            {/* CPU Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-indigo-600" />
                  <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {systemMetrics?.cpu.usage || 0}%
                </span>
              </div>
              <div className="relative">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${systemMetrics?.cpu.usage || 0}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{systemMetrics?.cpu.cores || 0} cores available</p>
              </div>
            </div>

            {/* Memory Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {systemMetrics?.memory.usagePercent || 0}%
                </span>
              </div>
              <div className="relative">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${systemMetrics?.memory.usagePercent || 0}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {((systemMetrics?.memory.used || 0) / 1024 / 1024 / 1024).toFixed(1)}GB / {((systemMetrics?.memory.total || 0) / 1024 / 1024 / 1024).toFixed(1)}GB
                </p>
              </div>
            </div>

            {/* Disk Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Disk Usage</span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {systemMetrics?.disk.usagePercent || 0}%
                </span>
              </div>
              <div className="relative">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${systemMetrics?.disk.usagePercent || 0}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {((systemMetrics?.disk.used || 0) / 1024 / 1024 / 1024).toFixed(1)}GB / {((systemMetrics?.disk.total || 0) / 1024 / 1024 / 1024).toFixed(1)}GB
                </p>
              </div>
            </div>

            {/* Network I/O */}
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Network className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium text-gray-700">Network I/O</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-gray-600">Inbound</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {((allMetrics?.docker?.containers?.reduce((sum, c) => sum + (c.network?.rx || 0), 0) || 0) / 1024 / 1024).toFixed(1)} MB/s
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-gray-600">Outbound</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {((allMetrics?.docker?.containers?.reduce((sum, c) => sum + (c.network?.tx || 0), 0) || 0) / 1024 / 1024).toFixed(1)} MB/s
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Container Status */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Docker Containers</h3>
            <span className="text-sm text-gray-500">
              {dockerStats?.running || 0} running, {dockerStats?.total || 0} total
            </span>
          </div>
          {dockerStats?.containers && dockerStats.containers.length > 0 ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {dockerStats.containers.map((container, idx) => (
                <div key={container.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{container.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{container.image}</p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      container.status.includes('Up') 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {container.status}
                    </span>
                  </div>
                  {container.status.includes('Up') && (
                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-1 text-gray-600 mb-1">
                          <Cpu className="h-3 w-3" />
                          <span>CPU</span>
                        </div>
                        <p className="font-bold text-gray-900">{container.cpu.toFixed(1)}%</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-gray-600 mb-1">
                          <HardDrive className="h-3 w-3" />
                          <span>Memory</span>
                        </div>
                        <p className="font-bold text-gray-900">{container.memory.percent.toFixed(1)}%</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-gray-600 mb-1">
                          <TrendingUp className="h-3 w-3" />
                          <span>Net In</span>
                        </div>
                        <p className="font-bold text-gray-900">{(container.network.rx / 1024 / 1024).toFixed(1)}MB</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-gray-600 mb-1">
                          <TrendingDown className="h-3 w-3" />
                          <span>Net Out</span>
                        </div>
                        <p className="font-bold text-gray-900">{(container.network.tx / 1024 / 1024).toFixed(1)}MB</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p>No containers running</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Service Health and Database */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Health Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Service Health</h3>
            <button
              onClick={() => setShowHealthDetails(true)}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View Details
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {services.map((service, idx) => {
              const isHealthy = service.status === 'healthy';
              const StatusIcon = isHealthy ? CheckCircle : service.status === 'degraded' ? AlertTriangle : AlertCircle;
              const statusColor = isHealthy ? 'text-green-600' : service.status === 'degraded' ? 'text-yellow-600' : 'text-red-600';
              const bgColor = isHealthy ? 'bg-green-50' : service.status === 'degraded' ? 'bg-yellow-50' : 'bg-red-50';
              
              return (
                <div key={idx} className={`${bgColor} rounded-xl p-4 border border-gray-100`}>
                  <div className="flex items-start gap-3">
                    <StatusIcon className={`h-5 w-5 ${statusColor} mt-0.5`} />
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{service.name}</p>
                      <p className={`text-xs ${statusColor} font-medium mt-1`}>
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Uptime: {formatUptime(service.uptime)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Database Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Database & Cache Performance</h3>
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Database className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-gray-700">KeyDB Cache</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {keydbMetrics?.connected ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Total Keys</p>
                  <p className="font-bold text-gray-900">{keydbMetrics?.info.totalKeys || 0}</p>
                </div>
                <div>
                  <p className="text-gray-600">Ops/sec</p>
                  <p className="font-bold text-gray-900">{keydbMetrics?.stats.opsPerSec || 0}</p>
                </div>
                <div>
                  <p className="text-gray-600">Hit Rate</p>
                  <p className="font-bold text-green-600">{keydbMetrics?.stats.hitRate || 0}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Memory</p>
                  <p className="font-bold text-gray-900">{keydbMetrics?.info.memoryUsedHuman || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Activity className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Request Performance</p>
                  <p className="text-2xl font-bold text-gray-900">{avgResponseTime.toFixed(1)}ms</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Requests/sec</p>
                  <p className="font-bold text-gray-900">{requestsPerSecond}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Requests</p>
                  <p className="font-bold text-gray-900">{totalRequests.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Error Rate</p>
                  <p className="font-bold text-gray-900">{errorRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Avg Response</p>
                  <p className="font-bold text-gray-900">{avgResponseTime.toFixed(0)}ms</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );

  const renderAnalyticsTab = () => (
    <>
      {/* Request Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Requests</p>
              <p className="text-2xl font-bold">{requestMetrics?.total?.toLocaleString() || '0'}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-indigo-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">SpinHub Requests</p>
              <p className="text-2xl font-bold">{requestMetrics?.spinhub?.toLocaleString() || '0'}</p>
            </div>
            <Server className="h-8 w-8 text-purple-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">App Requests</p>
              <p className="text-2xl font-bold">
                {((requestMetrics?.total || 0) - (requestMetrics?.spinhub || 0)).toLocaleString()}
              </p>
            </div>
            <Globe className="h-8 w-8 text-blue-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Response Time</p>
              <p className="text-2xl font-bold">
                {(requestMetrics?.avgResponseTime || 0).toFixed(0)}ms
              </p>
            </div>
            <Clock className="h-8 w-8 text-green-600" />
          </div>
        </motion.div>
      </div>

      {/* Request Distribution and Status Codes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold mb-4">Request Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={requestDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {requestDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold mb-4">Response Status Codes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusCodeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value">
                {statusCodeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Top Applications Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
      >
        <h3 className="text-lg font-semibold mb-4">Top Applications by Requests</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Response Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bandwidth
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topDomains.map((domain) => (
                <tr key={domain.domain}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {domain.domain}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {domain.requests.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {domain.avgResponseTime.toFixed(0)}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {domain.bandwidthFormatted || '0 B'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  );

  const renderDeploymentsTab = () => (
    <>
      {/* Deployment Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Deployments</p>
              <p className="text-2xl font-bold">{deploymentStats?.total || 0}</p>
            </div>
            <Package className="h-8 w-8 text-indigo-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Success Rate</p>
              <p className="text-2xl font-bold">{deploymentStats?.successRate || '0%'}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold">{deploymentStats?.failed || 0}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Build Time</p>
              <p className="text-2xl font-bold">
                {(deploymentStats?.avgBuildTime || 0).toFixed(1)}s
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </motion.div>
      </div>

      {/* Framework Distribution and Recent Deployments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold mb-4">Deployments by Framework</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={frameworkDeployments}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label
              >
                {frameworkDeployments.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold mb-4">Recent Deployments</h3>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {deploymentStats?.recentDeployments?.map((deployment: any, idx: number) => (
              <div key={idx} className="border rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{deployment.id}</p>
                    <p className="text-xs text-gray-500">{deployment.framework}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    deployment.status === 'success' 
                      ? 'bg-green-100 text-green-700' 
                      : deployment.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {deployment.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  Duration: {deployment.duration}s • {new Date(deployment.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg sticky top-0 z-40">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Grid3X3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    SpinForge Command Center
                  </h1>
                  <p className="text-sm text-gray-500">Real-time infrastructure monitoring & analytics</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Time Range Selector */}
              <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-xl p-1 border border-white/20">
                {['1h', '24h', '7d', '30d'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setSelectedTimeRange(range)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      selectedTimeRange === range
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>

              {/* Auto Refresh Controls */}
              <div className="flex items-center gap-3 bg-white/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Auto refresh</label>
                  <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoRefresh ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                        autoRefresh ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  {autoRefresh && (
                    <select
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      className="text-sm border-0 bg-transparent focus:ring-0"
                    >
                      <option value={1000}>1s</option>
                      <option value={5000}>5s</option>
                      <option value={10000}>10s</option>
                      <option value={30000}>30s</option>
                    </select>
                  )}
                </div>
                
                <button
                  onClick={() => refetchMetrics()}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white/70 rounded-lg transition-colors"
                  title="Refresh now"
                >
                  <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <a
                  href={config.GRAFANA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Grafana</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-white/20">
        <div className="px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'System Overview', icon: Monitor },
              { id: 'infrastructure', label: 'Infrastructure', icon: Server },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'deployments', label: 'Deployments', icon: Package }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as DashboardTab)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 lg:px-8 py-8">
        {renderTabContent()}
      </div>

      {/* Health Details Modal */}
      <AnimatePresence>
        {showHealthDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowHealthDetails(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">System Health Details</h2>
                    <p className="text-gray-600 mt-1">
                      {services.filter(s => s.status !== 'healthy').length} service(s) require attention
                    </p>
                  </div>
                  <button
                    onClick={() => setShowHealthDetails(false)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                  {services.map((service, idx) => {
                    const isHealthy = service.status === 'healthy';
                    const StatusIcon = isHealthy ? CheckCircle : service.status === 'degraded' ? AlertTriangle : XCircle;
                    const statusColor = isHealthy ? 'text-green-600' : service.status === 'degraded' ? 'text-yellow-600' : 'text-red-600';
                    const bgColor = isHealthy ? 'bg-green-50' : service.status === 'degraded' ? 'bg-yellow-50' : 'bg-red-50';
                    
                    return (
                      <div key={idx} className={`border rounded-xl p-5 ${bgColor} border-gray-200`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <StatusIcon className={`h-6 w-6 ${statusColor} mt-0.5`} />
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 text-lg">{service.name}</h3>
                              <p className={`text-sm ${statusColor} font-medium`}>
                                Status: {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                              </p>
                              
                              <div className="mt-3 space-y-2">
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <Clock className="h-4 w-4" />
                                  <span>Uptime: {formatUptime(service.uptime)}</span>
                                </div>
                                
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <Info className="h-4 w-4" />
                                  <span>Last check: {new Date(service.lastCheck).toLocaleString()}</span>
                                </div>

                                {!isHealthy && service.details && (
                                  <div className="mt-3 p-3 bg-white rounded-lg">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Issue Details:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                      {Object.entries(service.details).map(([key, value]) => (
                                        <li key={key} className="text-sm text-gray-600">
                                          <span className="font-medium">{key}:</span> {String(value)}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {!isHealthy && (
                                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                    <p className="text-sm font-medium text-blue-900 mb-1">Recommended Actions:</p>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
                                      {service.name === 'SpinHub' && (
                                        <>
                                          <li>Check logs: <code className="bg-blue-100 px-1 rounded text-xs">docker logs spinforge-hub</code></li>
                                          <li>Restart: <code className="bg-blue-100 px-1 rounded text-xs">docker-compose restart spinhub</code></li>
                                        </>
                                      )}
                                      {service.name === 'KeyDB' && (
                                        <>
                                          <li>Check status: <code className="bg-blue-100 px-1 rounded text-xs">docker exec spinforge-keydb redis-cli ping</code></li>
                                          <li>Memory info: <code className="bg-blue-100 px-1 rounded text-xs">docker exec spinforge-keydb redis-cli info memory</code></li>
                                        </>
                                      )}
                                      {service.name === 'Nginx' && (
                                        <>
                                          <li>Test config: <code className="bg-blue-100 px-1 rounded text-xs">docker exec spinforge-nginx nginx -t</code></li>
                                          <li>View logs: <code className="bg-blue-100 px-1 rounded text-xs">docker logs spinforge-nginx</code></li>
                                        </>
                                      )}
                                      {service.name === 'PostgreSQL' && (
                                        <>
                                          <li>Check connection: <code className="bg-blue-100 px-1 rounded text-xs">docker exec spinforge-db pg_isready</code></li>
                                          <li>View logs: <code className="bg-blue-100 px-1 rounded text-xs">docker logs spinforge-db</code></li>
                                        </>
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => {
                              console.log(`Restart ${service.name}`);
                            }}
                            className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                          >
                            Restart Service
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
                    Need help? Check the <a href="/docs" className="text-indigo-600 hover:text-indigo-800 font-medium">documentation</a> or view <a href="/logs" className="text-indigo-600 hover:text-indigo-800 font-medium">system logs</a>.
                  </p>
                  <button
                    onClick={() => setShowHealthDetails(false)}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
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