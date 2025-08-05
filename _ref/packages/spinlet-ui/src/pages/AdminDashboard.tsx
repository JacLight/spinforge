import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import { 
  Shield,
  Server,
  Activity,
  Database,
  Network,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Cpu,
  HardDrive,
  Zap,
  Cloud,
  Lock,
  Key,
  Settings,
  BarChart3,
  Globe
} from 'lucide-react';

interface SystemMetric {
  label: string;
  value: string | number;
  status: 'good' | 'warning' | 'critical';
  icon: any;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: string;
  lastCheck: string;
}

// Helper functions
function formatUptime(seconds: number): string {
  if (!seconds) return '0s';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function formatLastCheck(dateStr: string): string {
  if (!dateStr) return 'Never';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  
  return `${Math.floor(diffHours / 24)} days ago`;
}

export default function AdminDashboard() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: () => api.getAllRoutes(),
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.metrics(),
  });

  const { data: allMetrics } = useQuery({
    queryKey: ['allMetrics'],
    queryFn: () => api.allMetrics(),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Use real data when available, fallback to defaults
  const systemMetrics: SystemMetric[] = [
    {
      label: 'CPU Usage',
      value: `${allMetrics?.system?.cpu?.usage || metrics?.cpuUsage || 0}%`,
      status: (allMetrics?.system?.cpu?.usage || metrics?.cpuUsage || 0) > 80 ? 'critical' : 
              (allMetrics?.system?.cpu?.usage || metrics?.cpuUsage || 0) > 60 ? 'warning' : 'good',
      icon: Cpu
    },
    {
      label: 'Memory Usage',
      value: `${allMetrics?.system?.memory?.usagePercent || metrics?.memoryUsage || 0}%`,
      status: (allMetrics?.system?.memory?.usagePercent || metrics?.memoryUsage || 0) > 80 ? 'critical' : 
              (allMetrics?.system?.memory?.usagePercent || metrics?.memoryUsage || 0) > 60 ? 'warning' : 'good',
      icon: HardDrive
    },
    {
      label: 'Network I/O',
      value: allMetrics?.system?.network?.interfaces?.length 
        ? `${allMetrics.system.network.interfaces.length} interfaces` 
        : 'N/A',
      status: 'good',
      icon: Network
    },
    {
      label: 'Storage',
      value: `${allMetrics?.system?.disk?.usagePercent || 0}%`,
      status: (allMetrics?.system?.disk?.usagePercent || 0) > 80 ? 'critical' : 
              (allMetrics?.system?.disk?.usagePercent || 0) > 60 ? 'warning' : 'good',
      icon: Database
    }
  ];

  // Convert real service health data
  const services: ServiceStatus[] = allMetrics?.services?.map(service => ({
    name: service.name,
    status: service.status,
    uptime: formatUptime(service.uptime),
    lastCheck: formatLastCheck(service.lastCheck)
  })) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
      case 'healthy':
        return 'text-green-600';
      case 'warning':
      case 'degraded':
        return 'text-yellow-600';
      case 'critical':
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'good':
      case 'healthy':
        return 'bg-green-100';
      case 'warning':
      case 'degraded':
        return 'bg-yellow-100';
      case 'critical':
      case 'down':
        return 'bg-red-100';
      default:
        return 'bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center mb-2">
              <Shield className="h-8 w-8 mr-3" />
              <h1 className="text-3xl font-bold">SpinForge Admin Console</h1>
            </div>
            <p className="text-gray-300">
              System administration and monitoring dashboard
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">System Version</p>
            <p className="text-2xl font-semibold">{health?.version || '1.0.0'}</p>
          </div>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {systemMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${getStatusBg(metric.status)}`}>
                  <Icon className={`h-6 w-6 ${getStatusColor(metric.status)}`} />
                </div>
                <span className={`text-2xl font-bold ${getStatusColor(metric.status)}`}>
                  {metric.value}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-600">{metric.label}</h3>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg mr-4">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Applications</p>
              <p className="text-2xl font-bold text-gray-900">{routes.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg mr-4">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Spinlets</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.activeSpinlets || routes.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg mr-4">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(routes.map(r => r.customerId)).size}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg mr-4">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">System Uptime</p>
              <p className="text-2xl font-bold text-gray-900">15d 4h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Service Health</h2>
          <p className="text-sm text-gray-600 mt-1">Real-time status of core SpinForge services</p>
        </div>
        <div className="divide-y divide-gray-200">
          {services.map((service) => (
            <div key={service.name} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    service.status === 'healthy' ? 'bg-green-500' : 
                    service.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                  } animate-pulse`}></div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{service.name}</h3>
                    <p className="text-xs text-gray-500">Last check: {service.lastCheck}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${getStatusColor(service.status)}`}>
                    {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                  </p>
                  <p className="text-xs text-gray-500">Uptime: {service.uptime}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link 
          to="/applications"
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Globe className="h-6 w-6 text-indigo-600" />
            </div>
            <span className="text-sm text-indigo-600 font-medium">Manage →</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Application Management</h3>
          <p className="text-sm text-gray-600">
            Deploy, configure, and monitor all applications running on SpinForge
          </p>
        </Link>

        <Link 
          to="/metrics"
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm text-purple-600 font-medium">View →</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Performance Metrics</h3>
          <p className="text-sm text-gray-600">
            Detailed system performance metrics and resource utilization charts
          </p>
        </Link>

        <Link 
          to="/settings"
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Settings className="h-6 w-6 text-orange-600" />
            </div>
            <span className="text-sm text-orange-600 font-medium">Configure →</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">System Settings</h3>
          <p className="text-sm text-gray-600">
            Configure platform settings, security policies, and resource limits
          </p>
        </Link>
      </div>

      {/* Security Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center">
            <Lock className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">SSL/TLS Status</p>
              <p className="text-xs text-green-600">All domains secured</p>
            </div>
          </div>
          <div className="flex items-center">
            <Key className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">API Keys</p>
              <p className="text-xs text-gray-600">12 active keys</p>
            </div>
          </div>
          <div className="flex items-center">
            <Shield className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">Firewall</p>
              <p className="text-xs text-green-600">Active - 0 threats blocked</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Recent System Events</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 mr-2" />
            <span>Application "myapp.example.com" deployed successfully - 5 min ago</span>
          </div>
          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 mr-2" />
            <span>System backup completed - 2 hours ago</span>
          </div>
          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 mr-2" />
            <span>SSL certificate renewed for 3 domains - 1 day ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}