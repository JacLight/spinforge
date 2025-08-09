import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, TrendingUp, Users, Clock } from 'lucide-react';

interface MetricsTabProps {
  domain: string;
}

export default function MetricsTab({ domain }: MetricsTabProps) {
  // Fetch metrics data
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['vhost-metrics', domain],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/metrics/sites/${domain}/metrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      
      // Transform the backend response to match the UI expectations
      const bandwidth = data.metrics?.bandwidth || 0;
      let bandwidthFormatted;
      if (bandwidth < 1024) {
        bandwidthFormatted = `${bandwidth} B`;
      } else if (bandwidth < 1024 * 1024) {
        bandwidthFormatted = `${(bandwidth / 1024).toFixed(2)} KB`;
      } else if (bandwidth < 1024 * 1024 * 1024) {
        bandwidthFormatted = `${(bandwidth / (1024 * 1024)).toFixed(2)} MB`;
      } else {
        bandwidthFormatted = `${(bandwidth / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      }

      // Process status codes from the metrics.statusCodes object
      const statusCodes = data.metrics?.statusCodes || {};
      
      // Group status codes by category
      let status2xx = 0, status3xx = 0, status4xx = 0, status5xx = 0;
      
      Object.entries(statusCodes).forEach(([code, count]) => {
        const statusCode = parseInt(code);
        if (statusCode >= 200 && statusCode < 300) {
          status2xx += count as number;
        } else if (statusCode >= 300 && statusCode < 400) {
          status3xx += count as number;
        } else if (statusCode >= 400 && statusCode < 500) {
          status4xx += count as number;
        } else if (statusCode >= 500) {
          status5xx += count as number;
        }
      });

      // Format recent logs for top pages display
      const topPages = (data.recentLogs || []).map((log: any) => ({
        status: log.status || 200,
        method: log.method || 'GET',
        path: log.path || '/',
        responseTime: `${log.responseTime || 0}ms`,
        size: log.bytes ? `${log.bytes} B` : '0 B'
      }));

      return {
        totalRequests: data.totalRequests || 0,
        uniqueVisitors: data.uniqueVisitors || 0,
        avgResponseTime: data.metrics?.avgResponseTime || 0,
        bandwidth: bandwidthFormatted,
        status2xx,
        status3xx,
        status4xx,
        status5xx,
        topPages: topPages
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Performance Metrics</h2>
      
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Requests</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {metrics?.totalRequests?.toLocaleString() || '0'}
          </div>
          <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Unique Visitors</span>
            <Users className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {metrics?.uniqueVisitors?.toLocaleString() || '0'}
          </div>
          <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Avg Response Time</span>
            <Clock className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {metrics?.avgResponseTime || '0'}ms
          </div>
          <p className="text-xs text-gray-500 mt-1">Last hour</p>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Bandwidth</span>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {metrics?.bandwidth || '0 B'}
          </div>
          <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
        </div>
      </div>

      {/* Status Codes */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Response Status Codes</h3>
        <div className="space-y-3">
          {[
            { code: '2xx', label: 'Success', count: metrics?.status2xx || 0, color: 'bg-green-500' },
            { code: '3xx', label: 'Redirect', count: metrics?.status3xx || 0, color: 'bg-blue-500' },
            { code: '4xx', label: 'Client Error', count: metrics?.status4xx || 0, color: 'bg-yellow-500' },
            { code: '5xx', label: 'Server Error', count: metrics?.status5xx || 0, color: 'bg-red-500' },
          ].map((status) => (
            <div key={status.code} className="flex items-center gap-4">
              <div className="w-12 text-sm font-medium text-gray-600">{status.code}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{status.label}</span>
                  <span className="text-sm font-medium">{status.count.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${status.color} h-2 rounded-full transition-all`}
                    style={{
                      width: `${Math.min((status.count / (metrics?.totalRequests || 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Requests */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Recent Requests</h3>
        <div className="space-y-2">
          {(metrics?.topPages || []).slice(0, 5).map((request: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded text-sm">
              <div className="flex items-center gap-3 flex-1">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  request.status >= 200 && request.status < 300 ? 'bg-green-100 text-green-700' :
                  request.status >= 300 && request.status < 400 ? 'bg-blue-100 text-blue-700' :
                  request.status >= 400 && request.status < 500 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {request.status}
                </span>
                <span className="font-medium text-gray-600">{request.method}</span>
                <code className="text-gray-700 flex-1">{request.path}</code>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{request.responseTime}</span>
                <span>{request.size}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}