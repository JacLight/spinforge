/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, FunnelChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LeadsAnalytics, DateRange } from '../../types';
import { formatNumber, formatCurrency, getChartColors, exportToCSV } from '../../utils';
import { Target, Users, DollarSign, TrendingUp, Zap, Filter } from 'lucide-react';

interface LeadsAnalyticsDashboardProps {
  data: LeadsAnalytics;
  dateRange: DateRange;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const LeadsAnalyticsDashboard: React.FC<LeadsAnalyticsDashboardProps> = ({
  data,
  dateRange,
  isLoading = false,
  onRefresh
}) => {
  const colors = getChartColors(6);

  const overviewMetrics = [
    {
      title: 'Total Leads',
      value: data.overview.totalLeads,
      change: 15.2,
      changeType: 'increase' as const,
      icon: Users
    },
    {
      title: 'Qualified Leads',
      value: data.overview.qualifiedLeads,
      change: 8.7,
      changeType: 'increase' as const,
      icon: Target
    },
    {
      title: 'Conversion Rate',
      value: `${data.overview.conversionRate}%`,
      change: 12.3,
      changeType: 'increase' as const,
      icon: TrendingUp
    },
    {
      title: 'Avg Deal Size',
      value: data.overview.avgDealSize,
      change: 5.8,
      changeType: 'increase' as const,
      icon: DollarSign
    },
    {
      title: 'Pipeline Value',
      value: data.overview.pipelineValue,
      change: 18.9,
      changeType: 'increase' as const,
      icon: Zap
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
      {/* Hero Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {overviewMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={metric.title} className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600/10 to-rose-600/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
              <div className="relative bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/80 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center space-x-1 text-sm font-medium text-green-600">
                    <TrendingUp className="w-4 h-4" />
                    <span>+{metric.change}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{metric.title}</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {metric.title.includes('Deal Size') || metric.title.includes('Pipeline') 
                      ? formatValue(metric.value) 
                      : typeof metric.value === 'string' 
                      ? metric.value 
                      : formatNumber(metric.value)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sales Funnel & Lead Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Funnel - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Sales Funnel</h3>
                <p className="text-gray-600">Lead progression through sales stages</p>
              </div>
              <button
                onClick={() => exportToCSV(data.funnelData, 'sales-funnel-data')}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all duration-200 text-sm font-medium"
              >
                Export Data
              </button>
            </div>
            
            {/* Funnel Visualization */}
            <div className="space-y-4">
              {data.funnelData.map((stage, index) => {
                const width = stage.conversionRate;
                const isFirst = index === 0;
                
                return (
                  <div key={stage.stage} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{stage.stage}</span>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">{formatNumber(stage.count)}</span>
                        <span className="text-sm font-medium text-gray-900">{stage.conversionRate.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-1000 flex items-center justify-center text-white font-medium`}
                        style={{ width: `${width}%` }}
                      >
                        {stage.count > 100 && (
                          <span className="text-sm">{formatNumber(stage.count)} leads</span>
                        )}
                      </div>
                    </div>
                    {!isFirst && (
                      <div className="absolute -top-2 right-0 text-xs text-gray-500">
                        {((data.funnelData[index].count / data.funnelData[index-1].count) * 100).toFixed(1)}% conversion
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Lead Sources */}
        <div className="space-y-6">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Sources</h3>
            <div className="space-y-4">
              {data.leadSources.map((source, index) => (
                <div key={source.source} className="p-3 bg-gray-50/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 text-sm">{source.source}</span>
                    <span className="text-xs text-gray-600">{source.conversionRate.toFixed(1)}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                    <span>{formatNumber(source.leads)} leads</span>
                    <span>{formatNumber(source.converted)} converted</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-pink-500 to-rose-500 h-2 rounded-full" 
                      style={{ width: `${(source.conversionRate / 25) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Performance & Deal Stages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Campaign Performance */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Campaign Performance</h3>
              <p className="text-gray-600">Marketing campaign effectiveness</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.campaignPerformance.map((campaign, index) => (
              <div key={campaign.campaign} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <span className="font-semibold text-gray-900">{campaign.campaign}</span>
                  </div>
                  <span className="text-sm font-medium text-green-600">{campaign.roi}% ROI</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Leads</p>
                    <p className="font-semibold text-gray-900">{formatNumber(campaign.leads)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Cost</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(campaign.cost)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Cost/Lead</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(campaign.costPerLead)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-pink-500 to-rose-500 h-2 rounded-full" 
                      style={{ width: `${Math.min((campaign.roi / 400) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deal Stages */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Deal Stages</h3>
              <p className="text-gray-600">Pipeline breakdown by stage</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.dealStages.map((stage, index) => (
              <div key={stage.stage} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{stage.stage}</h4>
                  <span className="text-sm font-medium text-gray-600">{formatNumber(stage.deals)} deals</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-gray-600">Total Value</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(stage.value)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Avg Deal Size</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(stage.avgDealSize)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-pink-500 to-rose-500 h-2 rounded-full" 
                    style={{ width: `${(stage.value / data.dealStages[0].value) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lead Trends Chart */}
      <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Lead Generation Trends</h3>
            <p className="text-gray-600">Daily lead acquisition over the last 30 days</p>
          </div>
          <button
            onClick={() => exportToCSV(data.leadTrends, 'lead-trends')}
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all duration-200 text-sm font-medium"
          >
            Export Trends
          </button>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.leadTrends}>
              <defs>
                <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EC4899" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#EC4899" stopOpacity={0.05}/>
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
                formatter={(value: number) => [formatNumber(value), 'Leads']}
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
                stroke="#EC4899" 
                strokeWidth={3}
                fill="url(#leadGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
