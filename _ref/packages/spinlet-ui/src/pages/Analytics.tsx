import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Package, 
  Server, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Monitor,
  Gauge,
  Globe,
  Code,
  Clock,
  AlertTriangle
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

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

export default function Analytics() {
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

  const { data: allMetrics } = useQuery({
    queryKey: ['allMetrics'],
    queryFn: () => api.allMetrics(),
    refetchInterval: 10000,
  });

  // Request distribution data
  const requestDistribution = [
    { name: 'SpinHub API', value: requestMetrics?.spinhub || 0, color: '#8b5cf6' },
    { name: 'Applications', value: (requestMetrics?.total || 0) - (requestMetrics?.spinhub || 0), color: '#3b82f6' }
  ];

  // Status code distribution
  const statusCodeData = Object.entries(requestMetrics?.byStatus || {}).map(([code, count]) => ({
    name: code.startsWith('2') ? `${code} OK` : code.startsWith('4') ? `${code} Client Error` : `${code} Server Error`,
    value: count as number,
    color: code.startsWith('2') ? '#10b981' : code.startsWith('4') ? '#f59e0b' : '#ef4444'
  }));

  // Method distribution
  const methodData = Object.entries(requestMetrics?.byMethod || {}).map(([method, count]) => ({
    name: method,
    value: count as number
  }));

  // Top routes
  const topRoutes = Object.entries(requestMetrics?.byRoute || {})
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 10)
    .map(([route, count]) => ({
      route,
      count: count as number
    }));

  // Top domains by request count
  const topDomains = Object.entries(requestMetrics?.spinlets || {})
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([domain, count]) => ({
      domain,
      requests: count as number,
      avgResponseTime: requestMetrics?.byDomain?.[domain]?.avgResponseTime || 0
    }));

  // Framework distribution for deployments
  const frameworkDeployments = Object.entries(deploymentStats?.byFramework || {}).map(([framework, count]) => ({
    name: framework,
    value: count as number
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Real-time insights into your SpinForge platform performance
          </p>
        </div>

        {/* Request Metrics Section */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            <Activity className="h-6 w-6 mr-2 text-indigo-600" />
            Request Metrics
          </h2>

          {/* Request Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow p-6"
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
              className="bg-white rounded-lg shadow p-6"
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
              className="bg-white rounded-lg shadow p-6"
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
              className="bg-white rounded-lg shadow p-6"
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

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Request Distribution */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-lg shadow p-6"
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

            {/* Status Codes */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-lg shadow p-6"
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

          {/* Top Domains Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow p-6 mb-6"
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Deployment Stats Section */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            <Package className="h-6 w-6 mr-2 text-indigo-600" />
            Deployment Statistics
          </h2>

          {/* Deployment Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow p-6"
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
              className="bg-white rounded-lg shadow p-6"
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
              className="bg-white rounded-lg shadow p-6"
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
              className="bg-white rounded-lg shadow p-6"
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

          {/* Framework Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-lg shadow p-6"
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

            {/* Recent Deployments */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-lg shadow p-6"
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
        </div>
      </div>
    </div>
  );
}