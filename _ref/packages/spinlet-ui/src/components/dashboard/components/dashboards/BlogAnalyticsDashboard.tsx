import React from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BlogAnalytics, DateRange } from '../../types';
import { MetricCard } from '../MetricCard';
import { ChartContainer } from '../ChartContainer';
import { formatNumber, formatPercentage, getChartColors, exportToCSV, formatDate } from '../../utils';

interface BlogAnalyticsDashboardProps {
  data: BlogAnalytics;
  dateRange: DateRange;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const BlogAnalyticsDashboard: React.FC<BlogAnalyticsDashboardProps> = ({
  data,
  dateRange,
  isLoading = false,
  onRefresh
}) => {
  const colors = getChartColors(6);

  const overviewMetrics = [
    {
      title: 'Total Posts',
      value: data.overview.totalPosts,
      change: 8.2,
      changeType: 'increase' as const
    },
    {
      title: 'Total Views',
      value: data.overview.totalViews,
      change: 15.3,
      changeType: 'increase' as const
    },
    {
      title: 'Avg Engagement',
      value: data.overview.avgEngagement.toFixed(1),
      change: 12.1,
      changeType: 'increase' as const
    },
    {
      title: 'Total Comments',
      value: data.overview.totalComments,
      change: 22.7,
      changeType: 'increase' as const
    },
    {
      title: 'Total Shares',
      value: data.overview.totalShares,
      change: 18.9,
      changeType: 'increase' as const
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {overviewMetrics.map((metric, index) => (
          <div key={metric.title} className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-600/10 to-blue-600/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
            <div className="relative bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/80 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">📝</span>
                </div>
                <div className="flex items-center space-x-1 text-sm font-medium text-green-600">
                  <span>+{metric.change}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{metric.title}</p>
                <p className="text-3xl font-bold text-gray-900">{typeof metric.value === 'string' ? metric.value : formatNumber(metric.value)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Performance Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Engagement Trends - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Engagement Trends</h3>
                <p className="text-gray-600">Daily engagement over the last 30 days</p>
              </div>
              <button
                onClick={() => exportToCSV(data.engagementTrends, 'blog-engagement-trends')}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-xl hover:from-green-600 hover:to-blue-600 transition-all duration-200 text-sm font-medium"
              >
                Export Data
              </button>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.engagementTrends}>
                  <defs>
                    <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.05}/>
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
                    formatter={(value: number) => [formatNumber(value), 'Engagement']}
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
                    stroke="#10B981" 
                    strokeWidth={3}
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Author Performance */}
        <div className="space-y-6">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Authors</h3>
            <div className="space-y-4">
              {data.authorPerformance.slice(0, 4).map((author, index) => (
                <div key={author.author} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{author.author}</p>
                      <p className="text-xs text-gray-600">{author.posts} posts</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{formatNumber(author.totalViews)}</div>
                    <div className="text-xs text-gray-500">{author.avgEngagement.toFixed(1)} avg</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Posts */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Top Performing Posts</h3>
              <p className="text-gray-600">Most engaging content this period</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.topPosts.map((post, index) => (
              <div key={post.title} className="p-4 bg-gray-50/50 rounded-xl hover:bg-gray-100/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">{post.title}</h4>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {post.category}
                      </span>
                      <span className="text-xs text-gray-600">{formatDate(post.publishDate)}</span>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-lg font-bold text-gray-900">#{index + 1}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>{formatNumber(post.views)} views</span>
                    <span>•</span>
                    <span>{post.engagement.toFixed(1)} engagement</span>
                  </div>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full" 
                      style={{ width: `${Math.min((post.views / data.topPosts[0].views) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Performance */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Category Performance</h3>
              <p className="text-gray-600">Content performance by category</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.categoryPerformance.map((category, index) => (
              <div key={category.category} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{category.category}</h4>
                  <span className="text-sm font-medium text-gray-600">{category.posts} posts</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Avg Views</p>
                    <p className="font-semibold text-gray-900">{formatNumber(category.avgViews)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Engagement</p>
                    <p className="font-semibold text-gray-900">{category.engagement.toFixed(1)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full" 
                      style={{ width: `${(category.engagement / 10) * 100}%` }}
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
