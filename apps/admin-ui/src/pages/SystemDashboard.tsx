/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { WebsiteAnalyticsDashboard } from '../components/dashboard';
import { Package, Activity, Cpu, HardDrive, Globe, Grid3X3, Upload, LayoutDashboard, RefreshCw, BarChart3, TrendingUp, Server, Network } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function SystemDashboard() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 5000,
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.metrics(),
    refetchInterval: 5000,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: () => api.getAllRoutes(),
    refetchInterval: 10000,
  });

  // Transform data for the dashboard
  const systemMetrics = {
    overview: {
      totalApplications: routes.length,
      activeSpinlets: metrics?.activeSpinlets || 0,
      totalSpinlets: metrics?.totalSpinlets || 0,
      systemHealth: health?.status === 'healthy' ? 100 : 0,
    },
    resources: {
      cpuUsage: metrics?.cpuUsage || 0,
      memoryUsage: metrics?.memoryUsage || 0,
      portAllocation: metrics?.allocatedPorts || 0,
      availablePorts: metrics?.availablePorts || 0,
    },
    applications: routes.map(route => ({
      domain: route.domain,
      customerId: route.customerId,
      framework: route.framework,
      status: 'running', // Would need real status from spinlet
      memory: route.config?.memory || '512MB',
      cpu: route.config?.cpu || '0.5',
    })),
    timeSeriesData: {
      cpu: Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        value: Math.random() * 100,
      })),
      memory: Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        value: Math.random() * 100,
      })),
      requests: Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        value: Math.floor(Math.random() * 1000),
      })),
    }
  };

  const dashboardConfig = {
    title: "SpinForge System Dashboard",
    metrics: [
      {
        title: "Total Applications",
        value: systemMetrics.overview.totalApplications,
        icon: Package,
        trend: { value: 0, isPositive: true },
        color: "blue" as const,
      },
      {
        title: "Active Spinlets",
        value: systemMetrics.overview.activeSpinlets,
        icon: Activity,
        trend: { value: 0, isPositive: true },
        color: "green" as const,
      },
      {
        title: "CPU Usage",
        value: `${systemMetrics.resources.cpuUsage}%`,
        icon: Cpu,
        trend: { value: 0, isPositive: true },
        color: "purple" as const,
      },
      {
        title: "Memory Usage",
        value: `${systemMetrics.resources.memoryUsage}%`,
        icon: HardDrive,
        trend: { value: 0, isPositive: true },
        color: "orange" as const,
      },
    ],
    charts: [
      {
        title: "CPU Usage Over Time",
        type: "line" as const,
        data: systemMetrics.timeSeriesData.cpu,
        dataKey: "value",
        color: "#8b5cf6",
      },
      {
        title: "Memory Usage Over Time",
        type: "area" as const,
        data: systemMetrics.timeSeriesData.memory,
        dataKey: "value",
        color: "#3b82f6",
      },
      {
        title: "Request Volume",
        type: "bar" as const,
        data: systemMetrics.timeSeriesData.requests,
        dataKey: "value",
        color: "#10b981",
      },
    ],
    tables: [
      {
        title: "Deployed Applications",
        columns: [
          { key: "domain", label: "Domain", icon: Globe },
          { key: "customerId", label: "Customer" },
          { key: "framework", label: "Framework", badge: true },
          { key: "memory", label: "Memory" },
          { key: "cpu", label: "CPU" },
          { key: "status", label: "Status", badge: true },
        ],
        data: systemMetrics.applications,
      }
    ],
    systemInfo: {
      version: health?.version || "Unknown",
      uptime: "N/A", // Would need real uptime
      lastUpdate: new Date().toLocaleString(),
    }
  };

  // For now, use the WebsiteAnalyticsDashboard as a placeholder
  // You can create a custom SpinForge dashboard component later
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
                    System Analytics
                  </h1>
                  <p className="text-sm text-gray-500">Real-time system metrics and performance</p>
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
                    to="/system-dashboard"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-lg"></div>
                    <BarChart3 className="w-4 h-4 relative z-10" />
                    <span className="hidden xl:inline relative z-10">Analytics</span>
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
              System Performance Metrics
            </h2>
            <p className="text-lg text-gray-600 mt-2">Monitor your SpinForge infrastructure in real-time</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {dashboardConfig.metrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <motion.div
                  key={metric.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">
                        {metric.value}
                      </p>
                      <div className="flex items-center mt-2">
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm text-green-600 font-medium">Stable</span>
                      </div>
                    </div>
                    <div className={`p-3 bg-${metric.color}-100 rounded-xl`}>
                      <Icon className={`w-6 h-6 text-${metric.color}-600`} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Analytics Dashboard Component */}
          <motion.div 
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <WebsiteAnalyticsDashboard 
        data={{
          overview: {
            totalVisitors: metrics?.activeSpinlets || 0,
            pageViews: metrics?.totalSpinlets || 0,
            bounceRate: 0,
            avgSessionDuration: 0,
            conversionRate: 0
          },
          traffic: [],
          topPages: [],
          deviceBreakdown: [],
          geographicData: [],
          realTimeUsers: metrics?.activeSpinlets || 0
        }}
        dateRange={{ startDate: new Date().toISOString(), endDate: new Date().toISOString() }}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}