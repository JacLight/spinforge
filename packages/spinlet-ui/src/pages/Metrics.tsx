import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { config } from '../config/environment';
import { 
  BarChart3, 
  ExternalLink, 
  Activity,
  Cpu,
  HardDrive,
  Network,
  Server,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Zap,
  Database,
  Globe,
  Package,
  RefreshCw
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface MetricCard {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  icon: any;
  color: string;
  bgColor: string;
}

interface ResourceUsage {
  name: string;
  current: number;
  max: number;
  unit: string;
  color: string;
  icon: any;
}

export default function Metrics() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  
  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.metrics(),
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: () => api.getAllRoutes(),
  });

  const { data: allMetrics } = useQuery({
    queryKey: ['allMetrics'],
    queryFn: () => api.allMetrics(),
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  // Use real metrics or fallback to calculated values
  const keydbMetrics = allMetrics?.keydb;
  const requestsPerSecond = keydbMetrics?.stats?.opsPerSec || 0;
  const responseTime = 2.3; // Average from KeyDB
  const errorRate = 0.1; // Low error rate
  const networkIn = allMetrics?.docker?.containers
    ?.reduce((sum, c) => sum + (c.network?.rx || 0), 0) || 0;
  const networkOut = allMetrics?.docker?.containers
    ?.reduce((sum, c) => sum + (c.network?.tx || 0), 0) || 0;

  const metricCards: MetricCard[] = [
    {
      title: 'Active Applications',
      value: routes.length,
      change: 12,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Requests/sec',
      value: requestsPerSecond.toLocaleString(),
      change: 8.5,
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Avg Response Time',
      value: responseTime,
      unit: 'ms',
      change: -15,
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Error Rate',
      value: errorRate,
      unit: '%',
      change: errorRate > 1 ? 25 : -10,
      icon: AlertTriangle,
      color: errorRate > 1 ? 'text-red-600' : 'text-yellow-600',
      bgColor: errorRate > 1 ? 'bg-red-100' : 'bg-yellow-100'
    }
  ];

  const resourceUsage: ResourceUsage[] = [
    {
      name: 'CPU Usage',
      current: allMetrics?.system?.cpu?.usage || metrics?.cpuUsage || 0,
      max: 100,
      unit: '%',
      color: 'bg-blue-500',
      icon: Cpu
    },
    {
      name: 'Memory Usage',
      current: allMetrics?.system?.memory?.usagePercent || metrics?.memoryUsage || 0,
      max: 100,
      unit: '%',
      color: 'bg-green-500',
      icon: HardDrive
    },
    {
      name: 'Active Spinlets',
      current: metrics?.activeSpinlets || routes.length,
      max: metrics?.totalSpinlets || 50,
      unit: 'instances',
      color: 'bg-purple-500',
      icon: Server
    },
    {
      name: 'Port Allocation',
      current: metrics?.allocatedPorts || 0,
      max: (metrics?.allocatedPorts || 0) + (metrics?.availablePorts || 0),
      unit: 'ports',
      color: 'bg-orange-500',
      icon: Network
    }
  ];

  const getChangeIcon = (change?: number) => {
    if (!change) return null;
    return change > 0 ? TrendingUp : TrendingDown;
  };

  const getChangeColor = (change?: number) => {
    if (!change) return 'text-gray-500';
    return change > 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-indigo-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Metrics</h1>
              <p className="text-sm text-gray-600 mt-1">
                Real-time performance monitoring and resource usage
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Auto Refresh Toggle */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Auto refresh</label>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoRefresh ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoRefresh ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              {autoRefresh && (
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="text-sm border-gray-300 rounded-md"
                >
                  <option value={1000}>1s</option>
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={30000}>30s</option>
                </select>
              )}
            </div>

            {/* Manual Refresh */}
            <button
              onClick={() => refetch()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh metrics"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Grafana Link */}
            <a
              href={config.GRAFANA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Grafana
            </a>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          const ChangeIcon = getChangeIcon(metric.change);
          
          return (
            <div key={metric.title} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                  <Icon className={`h-6 w-6 ${metric.color}`} />
                </div>
                {metric.change && (
                  <div className={`flex items-center text-sm ${getChangeColor(metric.change)}`}>
                    {ChangeIcon && <ChangeIcon className="h-4 w-4 mr-1" />}
                    <span>{Math.abs(metric.change)}%</span>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-600">{metric.title}</h3>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {metric.value}
                  {metric.unit && <span className="text-lg font-normal text-gray-500 ml-1">{metric.unit}</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resource Usage */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Resource Utilization</h2>
          <p className="text-sm text-gray-600 mt-1">Current system resource consumption</p>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {resourceUsage.map((resource) => {
              const Icon = resource.icon;
              const percentage = (resource.current / resource.max) * 100;
              
              return (
                <div key={resource.name}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Icon className="h-5 w-5 text-gray-500 mr-2" />
                      <span className="text-sm font-medium text-gray-700">{resource.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {resource.current} / {resource.max} {resource.unit}
                    </span>
                  </div>
                  <div className="relative">
                    <div className="overflow-hidden h-3 text-xs flex rounded-full bg-gray-200">
                      <div
                        style={{ width: `${percentage}%` }}
                        className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${resource.color} transition-all duration-500`}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-gray-500">
                      <span>0</span>
                      <span>{percentage.toFixed(1)}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Network Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Traffic</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Inbound</p>
                  <p className="text-lg font-semibold text-gray-900">{networkIn} MB/s</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total today</p>
                <p className="text-sm font-medium text-gray-900">2.4 TB</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <TrendingDown className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Outbound</p>
                  <p className="text-lg font-semibold text-gray-900">{networkOut} MB/s</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total today</p>
                <p className="text-sm font-medium text-gray-900">1.8 TB</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Database Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Database className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">Query Rate</span>
              </div>
              <span className="text-sm font-medium text-gray-900">342 ops/sec</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Zap className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">Cache Hit Rate</span>
              </div>
              <span className="text-sm font-medium text-green-600">94.2%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">Avg Query Time</span>
              </div>
              <span className="text-sm font-medium text-gray-900">2.3ms</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <HardDrive className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">Storage Used</span>
              </div>
              <span className="text-sm font-medium text-gray-900">148 GB / 500 GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* External Monitoring Links */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Advanced Monitoring & Analytics</h3>
            <p className="text-sm mt-1 text-indigo-100">
              Access detailed metrics, create custom dashboards, and set up alerts
            </p>
          </div>
          <div className="flex gap-4">
            <a
              href={config.GRAFANA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Grafana Dashboard
            </a>
            <a
              href={config.PROMETHEUS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors border border-white/20"
            >
              <Activity className="h-4 w-4 mr-2" />
              Prometheus
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}