import { useQuery } from "@tanstack/react-query";
import { hostingAPI } from "../services/hosting-api";
import { Link } from "react-router-dom";
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
  Globe,
  FolderOpen,
  ExternalLink,
} from "lucide-react";

interface SystemMetric {
  label: string;
  value: string | number;
  status: "good" | "warning" | "critical";
  icon: any;
}

export default function AdminDashboard() {
  // Fetch hosting stats
  const { data: stats } = useQuery({
    queryKey: ["hosting-stats"],
    queryFn: () => hostingAPI.getStats(),
    refetchInterval: 30000,
  });

  // Fetch all vhosts
  const { data: vhosts = [] } = useQuery({
    queryKey: ["vhosts"],
    queryFn: () => hostingAPI.listVHosts(),
    refetchInterval: 30000,
  });

  // Fetch global metrics
  const { data: globalMetrics } = useQuery({
    queryKey: ["global-metrics"],
    queryFn: () => hostingAPI.getGlobalMetrics("24h"),
    refetchInterval: 30000,
  });

  // Calculate system metrics
  const systemMetrics: SystemMetric[] = [
    {
      label: "Total Sites",
      value: stats?.total_sites || 0,
      status: "good",
      icon: Globe,
    },
    {
      label: "Active Sites",
      value: stats?.enabled_sites || 0,
      status: stats?.enabled_sites === stats?.total_sites ? "good" : "warning",
      icon: Activity,
    },
    {
      label: "Static Sites",
      value: stats?.static_sites || 0,
      status: "good",
      icon: FolderOpen,
    },
    {
      label: "Proxy Sites",
      value: stats?.proxy_sites || 0,
      status: "good",
      icon: Network,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good":
        return "text-green-600";
      case "warning":
        return "text-yellow-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "good":
        return "bg-green-100";
      case "warning":
        return "bg-yellow-100";
      case "critical":
        return "bg-red-100";
      default:
        return "bg-gray-100";
    }
  };

  // Get recent sites (last 5)
  const recentSites = vhosts
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    )
    .slice(0, 5);

  // Get unique customers
  const uniqueCustomers = new Set(vhosts.map((v) => v.customerId || "unknown"))
    .size;

  // Helper functions for formatting
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center mb-2">
              <Shield className="h-8 w-8 mr-3" />
              <h1 className="text-3xl font-bold">
                SpinForge Hosting Dashboard
              </h1>
            </div>
            <p className="text-gray-300">
              Manage your static sites and proxy configurations
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Platform</p>
            <p className="text-2xl font-semibold">OpenResty + KeyDB</p>
          </div>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {systemMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${getStatusBg(metric.status)}`}>
                  <Icon
                    className={`h-6 w-6 ${getStatusColor(metric.status)}`}
                  />
                </div>
                <span
                  className={`text-2xl font-bold ${getStatusColor(
                    metric.status
                  )}`}
                >
                  {metric.value}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-600">
                {metric.label}
              </h3>
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
              <p className="text-sm text-gray-600">Total Domains</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.total_sites || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg mr-4">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Enabled Sites</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.enabled_sites || 0}
              </p>
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
                {uniqueCustomers}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg mr-4">
              <Server className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Load Balancers</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.loadbalancer_sites || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Metrics */}
      {globalMetrics && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Traffic Overview (Last 24 Hours)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">
                  Total Requests
                </span>
                <BarChart3 className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {formatNumber(globalMetrics.totalRequests)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-700">
                  Total Bandwidth
                </span>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-900">
                {formatBytes(globalMetrics.totalBandwidth)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-700">
                  Avg Response Time
                </span>
                <Zap className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-purple-900">
                {globalMetrics.avgResponseTime.toFixed(0)}ms
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-orange-700">
                  Error Rate
                </span>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-orange-900">
                {globalMetrics.totalRequests > 0
                  ? (
                      (((globalMetrics.requestsByStatus["4xx"] || 0) +
                        (globalMetrics.requestsByStatus["5xx"] || 0)) /
                        globalMetrics.totalRequests) *
                      100
                    ).toFixed(2)
                  : "0.00"}
                %
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-6">
        {/* Top Routes */}
        {globalMetrics && globalMetrics.topRoutes.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Top Routes by Traffic
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Most active domains in the last 24 hours
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Domain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Requests
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bandwidth
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Response
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Error Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {globalMetrics.topRoutes.map((route, index) => (
                    <tr
                      key={route.domain}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {route.domain}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatNumber(route.requests)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatBytes(route.bandwidth)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {route.avgResponseTime.toFixed(0)}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            route.errorRate < 0.01
                              ? "text-green-800 bg-green-100"
                              : route.errorRate < 0.05
                              ? "text-yellow-800 bg-yellow-100"
                              : "text-red-800 bg-red-100"
                          }`}
                        >
                          {(route.errorRate * 100).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Sites */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Sites
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Recently created virtual hosts
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {recentSites.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No sites created yet
              </div>
            ) : (
              recentSites.map((vhost) => (
                <div
                  key={vhost.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-3 ${
                          vhost.enabled !== false
                            ? "bg-green-500"
                            : "bg-gray-400"
                        }`}
                      ></div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {vhost.domain || vhost.id}
                        </h3>
                        <p className="text-xs text-gray-500">
                          Type: {vhost.type} • Customer:{" "}
                          {vhost.customerId || "Unknown"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={vhost.domain ? `http://${vhost.domain}` : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <p className="text-xs text-gray-500">
                        {vhost.createdAt
                          ? new Date(vhost.createdAt).toLocaleDateString()
                          : "Unknown"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/hosting"
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Globe className="h-6 w-6 text-indigo-600" />
            </div>
            <span className="text-sm text-indigo-600 font-medium">
              Manage →
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Hosting Management
          </h3>
          <p className="text-sm text-gray-600">
            Create, configure, and manage virtual hosts and static sites
          </p>
        </Link>

        <Link
          to="/deployments"
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm text-purple-600 font-medium">View →</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Deployments
          </h3>
          <p className="text-sm text-gray-600">
            Track deployment history and manage site versions
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
            <span className="text-sm text-orange-600 font-medium">
              Configure →
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            System Settings
          </h3>
          <p className="text-sm text-gray-600">
            Configure platform settings and manage API access
          </p>
        </Link>
      </div>

      {/* Services Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Core Services
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center">
            <Database className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">KeyDB</p>
              <p className="text-xs text-green-600">Connected on port 16378</p>
            </div>
          </div>
          <div className="flex items-center">
            <Server className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">OpenResty</p>
              <p className="text-xs text-green-600">Serving on port 80/443</p>
            </div>
          </div>
          <div className="flex items-center">
            <Cloud className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">API Server</p>
              <p className="text-xs text-green-600">Running on port 8080</p>
            </div>
          </div>
        </div>
      </div>

      {/* Site Type Distribution & Status Codes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Site Type Distribution
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Static Sites</span>
              <span className="text-sm font-medium">
                {stats?.static_sites || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Proxy Sites</span>
              <span className="text-sm font-medium">
                {stats?.proxy_sites || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Container Sites</span>
              <span className="text-sm font-medium">
                {stats?.container_sites || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Load Balancers</span>
              <span className="text-sm font-medium">
                {stats?.loadbalancer_sites || 0}
              </span>
            </div>
          </div>
        </div>

        {globalMetrics && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Response Status Distribution
            </h3>
            <div className="space-y-2">
              {Object.entries(globalMetrics.requestsByStatus)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([status, count]) => {
                  const percentage =
                    globalMetrics.totalRequests > 0
                      ? ((count / globalMetrics.totalRequests) * 100).toFixed(1)
                      : "0.0";
                  const isError = parseInt(status) >= 400;

                  return (
                    <div
                      key={status}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            parseInt(status) < 300
                              ? "bg-green-500"
                              : parseInt(status) < 400
                              ? "bg-blue-500"
                              : parseInt(status) < 500
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                        />
                        <span className="text-sm text-gray-600">
                          {status}xx Responses
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {formatNumber(count)} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
