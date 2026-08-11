/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WebsiteAnalytics, DateRange } from '../../types';
import { MetricCard } from '../MetricCard';
import { ChartContainer } from '../ChartContainer';
import { formatNumber, formatPercentage, formatDuration, getChartColors, exportToCSV } from '../../utils';
import { Eye, Users, Clock, TrendingUp, TrendingDown, Minus, Globe } from 'lucide-react';

interface WebsiteAnalyticsDashboardProps {
  data: WebsiteAnalytics;
  dateRange: DateRange;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const WebsiteAnalyticsDashboard: React.FC<WebsiteAnalyticsDashboardProps> = ({
  data,
  dateRange,
  isLoading = false,
  onRefresh
}) => {
  const colors = getChartColors(5);

  const overviewMetrics = [
    {
      title: 'Total Visitors',
      value: data.overview.totalVisitors,
      change: 12.5,
      changeType: 'increase' as const,
      icon: 'Users'
    },
    {
      title: 'Page Views',
      value: data.overview.pageViews,
      change: 8.3,
      changeType: 'increase' as const,
      icon: 'Eye'
    },
    {
      title: 'Bounce Rate',
      value: formatPercentage(data.overview.bounceRate),
      change: -2.1,
      changeType: 'decrease' as const,
      icon: 'TrendingUp'
    },
    {
      title: 'Avg Session Duration',
      value: formatDuration(data.overview.avgSessionDuration),
      change: 15.7,
      changeType: 'increase' as const,
      icon: 'Clock'
    },
    {
      title: 'Conversion Rate',
      value: formatPercentage(data.overview.conversionRate),
      change: 5.2,
      changeType: 'increase' as const,
      icon: 'TrendingUp'
    }
  ];

  const handleExportTraffic = () => {
    exportToCSV(data.traffic, 'website-traffic-data');
  };

  const handleExportPages = () => {
    exportToCSV(data.topPages, 'top-pages-data');
  };

  const handleExportDevices = () => {
    exportToCSV(data.deviceBreakdown, 'device-breakdown-data');
  };

  const handleExportGeo = () => {
    exportToCSV(data.geographicData, 'geographic-data');
  };

  const formatValue = (value: string | number) => {
    if (typeof value === 'string') return value;
    
    // Auto-detect format based on value
    if (value > 1000000) {
      return formatNumber(value / 1000000, { maximumFractionDigits: 1 }) + 'M';
    } else if (value > 1000) {
      return formatNumber(value / 1000, { maximumFractionDigits: 1 }) + 'K';
    }
    return formatNumber(value);
  };

  return (
    <div className="space-y-8">
      {/* Enhanced Hero Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {overviewMetrics.map((metric, index) => {
          const IconComponent = index === 0 ? Users : index === 1 ? Eye : index === 2 ? TrendingUp : index === 3 ? Clock : TrendingUp;
          return (
            <div key={metric.title} className="group relative overflow-hidden">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-indigo-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 group-hover:scale-110"></div>
              
              {/* Glass morphism card */}
              <div className="relative bg-white/80 backdrop-blur-xl border border-white/30 rounded-2xl p-6 hover:bg-white/90 transition-all duration-500 shadow-xl hover:shadow-2xl group-hover:scale-105">
                {/* Floating orb effect */}
                <div className="absolute top-2 right-2 w-20 h-20 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:rotate-6">
                    <IconComponent className="w-7 h-7 text-white" />
                  </div>
                  <div className={`flex items-center space-x-1 text-sm font-semibold px-3 py-1.5 rounded-full ${
                    metric.changeType === 'increase' 
                      ? 'bg-green-100/80 text-green-700 border border-green-200/50' 
                      : metric.changeType === 'decrease' 
                      ? 'bg-red-100/80 text-red-700 border border-red-200/50' 
                      : 'bg-gray-100/80 text-gray-700 border border-gray-200/50'
                  }`}>
                    {metric.changeType === 'increase' ? <TrendingUp className="w-3.5 h-3.5" /> : 
                     metric.changeType === 'decrease' ? <TrendingDown className="w-3.5 h-3.5" /> : 
                     <Minus className="w-3.5 h-3.5" />}
                    <span>{Math.abs(metric.change)}%</span>
                  </div>
                </div>
                
                <div className="relative z-10">
                  <p className="text-sm font-medium text-gray-600 mb-2">{metric.title}</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {formatValue(metric.value)}
                  </p>
                  
                  {/* Subtle progress indicator */}
                  <div className="mt-3 w-full bg-gray-200/50 rounded-full h-1">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-1 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(Math.abs(metric.change) * 2, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Traffic Trends - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Traffic Trends</h3>
                <p className="text-gray-600">Daily visitors over the last 30 days</p>
              </div>
              <button
                onClick={handleExportTraffic}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-200 text-sm font-medium"
              >
                Export Data
              </button>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.traffic}>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    stroke="#6B7280"
                    fontSize={12}
                  />
                  <YAxis 
                    tickFormatter={(value) => formatNumber(value)} 
                    stroke="#6B7280"
                    fontSize={12}
                  />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: number) => [formatNumber(value), 'Visitors']}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    fill="url(#colorGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Real-time Users & Quick Stats */}
        <div className="space-y-6">
          {/* Real-time Users */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Live Users</h3>
                <p className="text-sm text-gray-600">Currently active</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-4xl font-bold text-green-600 mb-2">{data.realTimeUsers}</div>
            <div className="text-sm text-gray-600">+12% from last hour</div>
          </div>

          {/* Device Breakdown */}
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Types</h3>
            <div className="space-y-3">
              {data.deviceBreakdown.map((device, index) => (
                <div key={device.device} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[index] }}
                    ></div>
                    <span className="text-sm font-medium text-gray-700">{device.device}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{device.percentage.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500">{formatNumber(device.sessions)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Pages */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Top Pages</h3>
              <p className="text-gray-600">Most visited pages this period</p>
            </div>
            <button
              onClick={handleExportPages}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {data.topPages.map((page, index) => (
              <div key={page.page} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl hover:bg-gray-100/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{page.page}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>{formatNumber(page.views)} views</span>
                      <span>•</span>
                      <span>{formatPercentage(page.bounceRate)} bounce</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full" 
                      style={{ width: `${Math.min((page.views / data.topPages[0].views) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Geographic Distribution</h3>
              <p className="text-gray-600">Traffic by country</p>
            </div>
            <button
              onClick={handleExportGeo}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View Map
            </button>
          </div>
          <div className="space-y-4">
            {data.geographicData.map((country, index) => (
              <div key={country.country} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-4 bg-gray-300 rounded-sm flex items-center justify-center text-xs">
                    🌍
                  </div>
                  <span className="font-medium text-gray-900">{country.country}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{formatNumber(country.sessions)}</div>
                    <div className="text-xs text-gray-500">{country.percentage.toFixed(1)}%</div>
                  </div>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full" 
                      style={{ width: `${country.percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
