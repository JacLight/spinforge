import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { WebsiteAnalyticsDashboard } from '../components/dashboard';
import { Package, Activity, Cpu, HardDrive, Globe } from 'lucide-react';

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
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">System Analytics Dashboard</h2>
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
    </div>
  );
}