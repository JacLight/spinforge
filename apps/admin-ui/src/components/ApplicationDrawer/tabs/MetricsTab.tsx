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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/metrics/${domain}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
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
            {metrics?.bandwidth || '0'} GB
          </div>
          <p className="text-xs text-gray-500 mt-1">This month</p>
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

      {/* Top Pages */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Top Pages</h3>
        <div className="space-y-2">
          {(metrics?.topPages || []).slice(0, 5).map((page: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
              <code className="text-sm text-gray-700">{page.path}</code>
              <span className="text-sm font-medium text-gray-900">{page.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}