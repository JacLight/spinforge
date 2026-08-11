/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TicketAnalytics, DateRange } from '../../types';
import { formatNumber, formatDuration, getChartColors, exportToCSV } from '../../utils';
import { Headphones, Clock, CheckCircle, AlertTriangle, Star, TrendingUp } from 'lucide-react';

interface TicketAnalyticsDashboardProps {
  data: TicketAnalytics;
  dateRange: DateRange;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const TicketAnalyticsDashboard: React.FC<TicketAnalyticsDashboardProps> = ({
  data,
  dateRange,
  isLoading = false,
  onRefresh
}) => {
  const colors = getChartColors(6);

  const overviewMetrics = [
    {
      title: 'Total Tickets',
      value: data.overview.totalTickets,
      change: 5.2,
      changeType: 'increase' as const,
      icon: Headphones
    },
    {
      title: 'Open Tickets',
      value: data.overview.openTickets,
      change: -8.1,
      changeType: 'decrease' as const,
      icon: AlertTriangle
    },
    {
      title: 'Resolved Tickets',
      value: data.overview.resolvedTickets,
      change: 12.3,
      changeType: 'increase' as const,
      icon: CheckCircle
    },
    {
      title: 'Avg Resolution Time',
      value: `${data.overview.avgResolutionTime}h`,
      change: -15.7,
      changeType: 'decrease' as const,
      icon: Clock
    },
    {
      title: 'Customer Satisfaction',
      value: `${data.overview.customerSatisfaction}/5`,
      change: 3.4,
      changeType: 'increase' as const,
      icon: Star
    }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {overviewMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={metric.title} className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-orange-600/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
              <div className="relative bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/80 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`flex items-center space-x-1 text-sm font-medium ${
                    metric.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <TrendingUp className={`w-4 h-4 ${metric.changeType === 'decrease' ? 'rotate-180' : ''}`} />
                    <span>{Math.abs(metric.change)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{metric.title}</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {typeof metric.value === 'string' ? metric.value : formatNumber(metric.value)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Support Analytics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Resolution Trends - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Resolution Trends</h3>
                <p className="text-gray-600">Daily ticket resolution over the last 30 days</p>
              </div>
              <button
                onClick={() => exportToCSV(data.resolutionTrends, 'ticket-resolution-trends')}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl hover:from-red-600 hover:to-orange-600 transition-all duration-200 text-sm font-medium"
              >
                Export Data
              </button>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.resolutionTrends}>
                  <defs>
                    <linearGradient id="resolutionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.05}/>
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
                    formatter={(value: number) => [formatNumber(value), 'Tickets Resolved']}
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
                    stroke="#EF4444" 
                    strokeWidth={3}
                    fill="url(#resolutionGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Ticket Categories */}
        <div className="space-y-6">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ticket Categories</h3>
            <div className="space-y-4">
              {data.ticketsByCategory.map((category, index) => (
                <div key={category.category} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[index] }}
                    ></div>
                    <span className="text-sm font-medium text-gray-700">{category.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{formatNumber(category.count)}</div>
                    <div className="text-xs text-gray-500">{category.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Breakdown */}
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Levels</h3>
            <div className="space-y-4">
              {data.ticketsByPriority.map((priority) => (
                <div key={priority.priority} className="p-3 bg-gray-50/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getPriorityColor(priority.priority) }}
                      ></div>
                      <span className="font-medium text-gray-900 text-sm">{priority.priority}</span>
                    </div>
                    <span className="text-xs text-gray-600">{formatNumber(priority.count)}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    Avg resolution: {priority.avgResolutionTime}h
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Performance & Satisfaction */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Agent Performance */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Agent Performance</h3>
              <p className="text-gray-600">Support team metrics and efficiency</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.agentPerformance.map((agent, index) => (
              <div key={agent.agent} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <span className="font-semibold text-gray-900">{agent.agent}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium text-gray-600">{agent.satisfaction}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Assigned</p>
                    <p className="font-semibold text-gray-900">{agent.assigned}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Resolved</p>
                    <p className="font-semibold text-gray-900">{agent.resolved}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Avg Time</p>
                    <p className="font-semibold text-gray-900">{agent.avgResolutionTime}h</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-red-500 to-orange-500 h-2 rounded-full" 
                      style={{ width: `${(agent.resolved / agent.assigned) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Satisfaction Trends */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Satisfaction Trends</h3>
              <p className="text-gray-600">Customer satisfaction over time</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.satisfactionTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  stroke="#6B7280"
                  fontSize={12}
                />
                <YAxis 
                  domain={[0, 5]}
                  tickFormatter={(value) => value.toFixed(1)} 
                  stroke="#6B7280"
                  fontSize={12}
                />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: number) => [value.toFixed(1), 'Rating']}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#F59E0B" 
                  strokeWidth={3}
                  dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Satisfaction Summary */}
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-green-50 rounded-xl">
              <div className="text-2xl font-bold text-green-600">4.6</div>
              <div className="text-xs text-gray-600">Current Rating</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600">89%</div>
              <div className="text-xs text-gray-600">Satisfied</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl">
              <div className="text-2xl font-bold text-purple-600">+3.4%</div>
              <div className="text-xs text-gray-600">Improvement</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
