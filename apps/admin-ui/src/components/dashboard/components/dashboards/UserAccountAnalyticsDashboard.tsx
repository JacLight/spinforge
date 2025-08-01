import React from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { UserAccountAnalytics, DateRange } from '../../types';
import { formatNumber, formatCurrency, getChartColors, exportToCSV } from '../../utils';
import { Users, DollarSign, Activity, Server, TrendingUp, Zap } from 'lucide-react';

interface UserAccountAnalyticsDashboardProps {
  data: UserAccountAnalytics;
  dateRange: DateRange;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const UserAccountAnalyticsDashboard: React.FC<UserAccountAnalyticsDashboardProps> = ({
  data,
  dateRange,
  isLoading = false,
  onRefresh
}) => {
  const colors = getChartColors(6);

  const overviewMetrics = [
    {
      title: 'Total Users',
      value: data.overview.totalUsers,
      change: 12.5,
      changeType: 'increase' as const,
      icon: Users
    },
    {
      title: 'Active Users',
      value: data.overview.activeUsers,
      change: 8.3,
      changeType: 'increase' as const,
      icon: Activity
    },
    {
      title: 'Total Revenue',
      value: data.overview.totalRevenue,
      change: 15.7,
      changeType: 'increase' as const,
      icon: DollarSign
    },
    {
      title: 'Avg Revenue/User',
      value: data.overview.avgRevenuePerUser,
      change: 5.2,
      changeType: 'increase' as const,
      icon: TrendingUp
    },
    {
      title: 'Churn Rate',
      value: `${data.overview.churnRate}%`,
      change: -18.9,
      changeType: 'decrease' as const,
      icon: Users
    }
  ];

  const formatValue = (value: string | number) => {
    if (typeof value === 'string') return value;
    if (value > 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value > 1000) return `$${(value / 1000).toFixed(1)}K`;
    return formatCurrency(value);
  };

  return (
    <div className="space-y-8">
      {/* Enhanced User Management Hero Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {overviewMetrics.map((metric, index) => {
          const Icon = metric.icon;
          const userGradients = [
            'from-teal-500 via-cyan-500 to-blue-500',      // Total Users
            'from-emerald-500 via-green-500 to-teal-500',  // Active Users
            'from-violet-500 via-purple-500 to-indigo-500', // Total Revenue
            'from-amber-500 via-orange-500 to-red-500',    // ARPU
            'from-rose-500 via-pink-500 to-purple-500'     // Churn Rate
          ];
          
          return (
            <div key={metric.title} className="group relative overflow-hidden">
              {/* Dynamic user management themed background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${userGradients[index]}/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 group-hover:scale-110`}></div>
              
              {/* Premium user analytics card */}
              <div className="relative bg-white/85 backdrop-blur-xl border border-white/40 rounded-2xl p-6 hover:bg-white/95 transition-all duration-500 shadow-xl hover:shadow-2xl group-hover:scale-105">
                {/* Floating user activity indicators */}
                <div className={`absolute top-2 right-2 w-20 h-20 bg-gradient-to-br ${userGradients[index]}/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700`}></div>
                <div className={`absolute bottom-3 left-3 w-8 h-8 bg-gradient-to-br ${userGradients[index]}/25 rounded-full blur-lg group-hover:scale-125 transition-transform duration-500 delay-300`}></div>
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className={`w-14 h-14 bg-gradient-to-br ${userGradients[index]} rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:rotate-6`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className={`flex items-center space-x-1 text-sm font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm ${
                    metric.changeType === 'increase' 
                      ? 'bg-emerald-100/80 text-emerald-700 border border-emerald-200/50' 
                      : 'bg-red-100/80 text-red-700 border border-red-200/50'
                  }`}>
                    <TrendingUp className={`w-3.5 h-3.5 ${metric.changeType === 'decrease' ? 'rotate-180' : ''}`} />
                    <span>{Math.abs(metric.change)}%</span>
                  </div>
                </div>
                
                <div className="relative z-10">
                  <p className="text-sm font-medium text-gray-600 mb-2">{metric.title}</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {metric.title.includes('Revenue') 
                      ? formatValue(metric.value) 
                      : typeof metric.value === 'string' 
                      ? metric.value 
                      : formatNumber(metric.value)}
                  </p>
                  
                  {/* User activity pulse indicator */}
                  <div className="mt-3 flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200/50 rounded-full h-1.5">
                      <div 
                        className={`bg-gradient-to-r ${userGradients[index]} h-1.5 rounded-full transition-all duration-1000 ease-out`}
                        style={{ width: `${Math.min(Math.abs(metric.change) * 2.5, 100)}%` }}
                      ></div>
                    </div>
                    {index === 1 && ( // Active Users indicator
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-gray-500">Live</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* User Analytics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Growth Trends - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">User Growth</h3>
                <p className="text-gray-600">Daily user registration over the last 30 days</p>
              </div>
              <button
                onClick={() => exportToCSV(data.userGrowth, 'user-growth-trends')}
                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-200 text-sm font-medium"
              >
                Export Data
              </button>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.userGrowth}>
                  <defs>
                    <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#14B8A6" stopOpacity={0.05}/>
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
                    formatter={(value: number) => [formatNumber(value), 'New Users']}
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
                    stroke="#14B8A6" 
                    strokeWidth={3}
                    fill="url(#userGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Subscription Tiers */}
        <div className="space-y-6">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Tiers</h3>
            <div className="space-y-4">
              {data.subscriptionTiers.map((tier, index) => (
                <div key={tier.tier} className="p-3 bg-gray-50/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 text-sm">{tier.tier}</span>
                    <span className="text-xs text-gray-600">{tier.churnRate}% churn</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                    <span>{formatNumber(tier.users)} users</span>
                    <span>{formatCurrency(tier.revenue)} revenue</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-teal-500 to-cyan-500 h-2 rounded-full" 
                      style={{ width: `${(tier.users / data.subscriptionTiers[0].users) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">Active Rate</span>
                </div>
                <span className="text-lg font-bold text-green-600">
                  {((data.overview.activeUsers / data.overview.totalUsers) * 100).toFixed(1)}%
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900">ARPU</span>
                </div>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(data.overview.avgRevenuePerUser)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue & API Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Breakdown */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Revenue Breakdown</h3>
              <p className="text-gray-600">Revenue sources and distribution</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.revenueBreakdown.map((source, index) => (
              <div key={source.source} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <span className="font-semibold text-gray-900">{source.source}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{source.percentage}%</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(source.revenue)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-teal-500 to-cyan-500 h-2 rounded-full" 
                    style={{ width: `${source.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API Usage */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">API Usage</h3>
              <p className="text-gray-600">API endpoints performance and costs</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.apiUsage.map((api, index) => (
              <div key={api.endpoint} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900 font-mono text-sm">{api.endpoint}</span>
                  <span className="text-sm font-medium text-gray-600">{api.avgResponseTime}ms</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-gray-600">Calls</p>
                    <p className="font-semibold text-gray-900">{formatNumber(api.calls)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Cost</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(api.cost)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-teal-500 to-cyan-500 h-2 rounded-full" 
                    style={{ width: `${(api.calls / data.apiUsage[0].calls) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Activities & Cost Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Activities */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">User Activities</h3>
              <p className="text-gray-600">Most common user actions</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.userActivities}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ activity, percentage }) => `${activity} ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="percentage"
                >
                  {data.userActivities.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Percentage']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Analysis */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Cost Analysis</h3>
              <p className="text-gray-600">Infrastructure costs and efficiency</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.costAnalysis.map((service, index) => (
              <div key={service.service} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Server className="w-5 h-5 text-teal-500" />
                    <span className="font-semibold text-gray-900">{service.service}</span>
                  </div>
                  <span className="text-sm font-medium text-green-600">{service.efficiency}% efficient</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-gray-600">Cost</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(service.cost)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Usage</p>
                    <p className="font-semibold text-gray-900">{service.usage}%</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-teal-500 to-cyan-500 h-2 rounded-full" 
                    style={{ width: `${service.efficiency}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Overview */}
      <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">System Overview</h3>
            <p className="text-gray-600">Key performance indicators and system health</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-1">{formatNumber(data.overview.totalUsers)}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </div>
          
          <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-green-600 mb-1">{formatNumber(data.overview.activeUsers)}</div>
            <div className="text-sm text-gray-600">Active Users</div>
          </div>
          
          <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl">
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-1">{formatValue(data.overview.totalRevenue)}</div>
            <div className="text-sm text-gray-600">Total Revenue</div>
          </div>
          
          <div className="text-center p-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl">
            <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-teal-600 mb-1">{formatCurrency(data.overview.avgRevenuePerUser)}</div>
            <div className="text-sm text-gray-600">ARPU</div>
          </div>
        </div>
      </div>
    </div>
  );
};
