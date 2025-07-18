import React from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SocialMediaAnalytics, DateRange } from '../../types';
import { formatNumber, getChartColors, exportToCSV } from '../../utils';
import { Share2, Users, Heart, MessageCircle, TrendingUp, Hash } from 'lucide-react';

interface SocialMediaAnalyticsDashboardProps {
  data: SocialMediaAnalytics;
  dateRange: DateRange;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const SocialMediaAnalyticsDashboard: React.FC<SocialMediaAnalyticsDashboardProps> = ({
  data,
  dateRange,
  isLoading = false,
  onRefresh
}) => {
  const colors = getChartColors(6);

  const overviewMetrics = [
    {
      title: 'Total Followers',
      value: data.overview.totalFollowers,
      change: 12.3,
      changeType: 'increase' as const,
      icon: Users
    },
    {
      title: 'Total Engagement',
      value: data.overview.totalEngagement,
      change: 18.7,
      changeType: 'increase' as const,
      icon: Heart
    },
    {
      title: 'Total Posts',
      value: data.overview.totalPosts,
      change: 8.2,
      changeType: 'increase' as const,
      icon: MessageCircle
    },
    {
      title: 'Avg Engagement Rate',
      value: `${data.overview.avgEngagementRate}%`,
      change: 15.4,
      changeType: 'increase' as const,
      icon: TrendingUp
    },
    {
      title: 'Reach Growth',
      value: `${data.overview.reachGrowth}%`,
      change: 22.1,
      changeType: 'increase' as const,
      icon: Share2
    }
  ];

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram': return '📷';
      case 'twitter': return '🐦';
      case 'facebook': return '👥';
      case 'linkedin': return '💼';
      case 'tiktok': return '🎵';
      default: return '📱';
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram': return '#E4405F';
      case 'twitter': return '#1DA1F2';
      case 'facebook': return '#4267B2';
      case 'linkedin': return '#0077B5';
      case 'tiktok': return '#000000';
      default: return '#6B7280';
    }
  };

  return (
    <div className="space-y-8">
      {/* Enhanced Social Media Hero Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {overviewMetrics.map((metric, index) => {
          const Icon = metric.icon;
          const socialGradients = [
            'from-blue-500 via-indigo-500 to-purple-500', // Followers
            'from-pink-500 via-rose-500 to-red-500',     // Engagement
            'from-green-500 via-emerald-500 to-teal-500', // Posts
            'from-orange-500 via-amber-500 to-yellow-500', // Engagement Rate
            'from-violet-500 via-purple-500 to-indigo-500' // Reach Growth
          ];
          
          return (
            <div key={metric.title} className="group relative overflow-hidden">
              {/* Dynamic social media themed background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${socialGradients[index]}/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 group-hover:scale-110`}></div>
              
              {/* Premium social card */}
              <div className="relative bg-white/85 backdrop-blur-xl border border-white/40 rounded-2xl p-6 hover:bg-white/95 transition-all duration-500 shadow-xl hover:shadow-2xl group-hover:scale-105">
                {/* Floating social bubbles */}
                <div className={`absolute top-2 right-2 w-20 h-20 bg-gradient-to-br ${socialGradients[index]}/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700`}></div>
                <div className={`absolute bottom-2 left-2 w-12 h-12 bg-gradient-to-br ${socialGradients[index]}/15 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500 delay-200`}></div>
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className={`w-14 h-14 bg-gradient-to-br ${socialGradients[index]} rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:rotate-6`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center space-x-1 text-sm font-semibold px-3 py-1.5 rounded-full bg-emerald-100/80 text-emerald-700 border border-emerald-200/50 backdrop-blur-sm">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>+{metric.change}%</span>
                  </div>
                </div>
                
                <div className="relative z-10">
                  <p className="text-sm font-medium text-gray-600 mb-2">{metric.title}</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {typeof metric.value === 'string' ? metric.value : formatNumber(metric.value)}
                  </p>
                  
                  {/* Social engagement indicator */}
                  <div className="mt-3 flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200/50 rounded-full h-1.5">
                      <div 
                        className={`bg-gradient-to-r ${socialGradients[index]} h-1.5 rounded-full transition-all duration-1000 ease-out`}
                        style={{ width: `${Math.min(metric.change * 2, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex space-x-1">
                      {['❤️', '👍', '🔥'][index % 3] && (
                        <span className="text-xs animate-pulse">{['❤️', '👍', '🔥'][index % 3]}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Social Media Performance Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Engagement Trends - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Engagement Trends</h3>
                <p className="text-gray-600">Daily engagement across all platforms</p>
              </div>
              <button
                onClick={() => exportToCSV(data.engagementTrends, 'social-engagement-trends')}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 text-sm font-medium"
              >
                Export Data
              </button>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.engagementTrends}>
                  <defs>
                    <linearGradient id="socialGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.05}/>
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
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8B5CF6" 
                    strokeWidth={3}
                    fill="url(#socialGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Platform Performance */}
        <div className="space-y-6">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Performance</h3>
            <div className="space-y-4">
              {data.platformPerformance.map((platform, index) => (
                <div key={platform.platform} className="p-3 bg-gray-50/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getPlatformIcon(platform.platform)}</span>
                      <span className="font-medium text-gray-900 text-sm">{platform.platform}</span>
                    </div>
                    <span className="text-xs text-gray-600">{platform.engagementRate.toFixed(1)}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                    <span>{formatNumber(platform.followers)} followers</span>
                    <span>{formatNumber(platform.engagement)} engagement</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full" 
                      style={{ 
                        backgroundColor: getPlatformColor(platform.platform),
                        width: `${(platform.engagementRate / 10) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audience Growth */}
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Audience Growth</h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.audienceGrowth}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatNumber(value), 'Followers']}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">+{data.overview.reachGrowth}%</div>
              <div className="text-xs text-gray-600">Growth this month</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Performance & Hashtag Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Content */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Top Content</h3>
              <p className="text-gray-600">Best performing posts across platforms</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.contentPerformance.map((content, index) => (
              <div key={content.post} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900 text-sm">{content.post}</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs">{getPlatformIcon(content.platform)}</span>
                        <span className="text-xs text-gray-600">{content.platform}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-600">{content.type}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Engagement</p>
                    <p className="font-semibold text-gray-900">{formatNumber(content.engagement)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Reach</p>
                    <p className="font-semibold text-gray-900">{formatNumber(content.reach)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full" 
                      style={{ width: `${(content.engagement / data.contentPerformance[0].engagement) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hashtag Performance */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Hashtag Performance</h3>
              <p className="text-gray-600">Top performing hashtags</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.hashtagPerformance.map((hashtag, index) => (
              <div key={hashtag.hashtag} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Hash className="w-5 h-5 text-indigo-500" />
                    <span className="font-semibold text-gray-900">{hashtag.hashtag}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{hashtag.usage} uses</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-gray-600">Engagement</p>
                    <p className="font-semibold text-gray-900">{formatNumber(hashtag.engagement)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Reach</p>
                    <p className="font-semibold text-gray-900">{formatNumber(hashtag.reach)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full" 
                    style={{ width: `${(hashtag.engagement / data.hashtagPerformance[0].engagement) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform Comparison Chart */}
      <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Platform Comparison</h3>
            <p className="text-gray-600">Engagement rate comparison across platforms</p>
          </div>
          <button
            onClick={() => exportToCSV(data.platformPerformance, 'platform-comparison')}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 text-sm font-medium"
          >
            Export Comparison
          </button>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.platformPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="platform" 
                stroke="#6B7280"
                fontSize={12}
              />
              <YAxis 
                tickFormatter={(value) => `${value}%`} 
                stroke="#6B7280"
                fontSize={12}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Engagement Rate']}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar 
                dataKey="engagementRate" 
                fill="url(#socialGradient)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
