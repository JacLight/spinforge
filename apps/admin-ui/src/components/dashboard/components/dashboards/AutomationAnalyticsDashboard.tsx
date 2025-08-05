/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AutomationAnalytics, DateRange } from '../../types';
import { formatNumber, formatDuration, getChartColors, exportToCSV } from '../../utils';
import { Zap, Play, CheckCircle, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

interface AutomationAnalyticsDashboardProps {
  data: AutomationAnalytics;
  dateRange: DateRange;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const AutomationAnalyticsDashboard: React.FC<AutomationAnalyticsDashboardProps> = ({
  data,
  dateRange,
  isLoading = false,
  onRefresh
}) => {
  const colors = getChartColors(6);

  const overviewMetrics = [
    {
      title: 'Active Workflows',
      value: data.overview.activeWorkflows,
      change: 8.3,
      changeType: 'increase' as const,
      icon: Zap
    },
    {
      title: 'Total Executions',
      value: data.overview.totalExecutions,
      change: 15.7,
      changeType: 'increase' as const,
      icon: Play
    },
    {
      title: 'Success Rate',
      value: `${data.overview.successRate}%`,
      change: 2.1,
      changeType: 'increase' as const,
      icon: CheckCircle
    },
    {
      title: 'Time Saved',
      value: `${data.overview.timeSaved}h`,
      change: 22.4,
      changeType: 'increase' as const,
      icon: Clock
    },
    {
      title: 'Error Rate',
      value: `${data.overview.errorRate}%`,
      change: -18.2,
      changeType: 'decrease' as const,
      icon: AlertTriangle
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {overviewMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={metric.title} className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/10 to-amber-600/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
              <div className="relative bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/80 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-xl flex items-center justify-center">
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

      {/* Automation Performance Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Execution Trends - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Execution Trends</h3>
                <p className="text-gray-600">Daily workflow executions over the last 30 days</p>
              </div>
              <button
                onClick={() => exportToCSV(data.executionTrends, 'automation-execution-trends')}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-xl hover:from-yellow-600 hover:to-amber-600 transition-all duration-200 text-sm font-medium"
              >
                Export Data
              </button>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.executionTrends}>
                  <defs>
                    <linearGradient id="executionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EAB308" stopOpacity={0.05}/>
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
                    formatter={(value: number) => [formatNumber(value), 'Executions']}
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
                    stroke="#EAB308" 
                    strokeWidth={3}
                    fill="url(#executionGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Trigger Analysis */}
        <div className="space-y-6">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Trigger Analysis</h3>
            <div className="space-y-4">
              {data.triggerAnalysis.map((trigger, index) => (
                <div key={trigger.trigger} className="p-3 bg-gray-50/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 text-sm">{trigger.trigger}</span>
                    <span className="text-xs text-gray-600">{trigger.successRate.toFixed(1)}%</span>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {formatNumber(trigger.executions)} executions
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-yellow-500 to-amber-500 h-2 rounded-full" 
                      style={{ width: `${trigger.successRate}%` }}
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
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">Successful</span>
                </div>
                <span className="text-lg font-bold text-green-600">
                  {Math.round(data.overview.totalExecutions * (data.overview.successRate / 100))}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-gray-900">Failed</span>
                </div>
                <span className="text-lg font-bold text-red-600">
                  {Math.round(data.overview.totalExecutions * (data.overview.errorRate / 100))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Performance & Error Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Workflow Performance */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Workflow Performance</h3>
              <p className="text-gray-600">Top performing automation workflows</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.workflowPerformance.map((workflow, index) => (
              <div key={workflow.workflow} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <span className="font-semibold text-gray-900">{workflow.workflow}</span>
                  </div>
                  <span className="text-sm font-medium text-green-600">{workflow.successRate.toFixed(1)}%</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Executions</p>
                    <p className="font-semibold text-gray-900">{formatNumber(workflow.executions)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Avg Time</p>
                    <p className="font-semibold text-gray-900">{workflow.avgExecutionTime}s</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Time Saved</p>
                    <p className="font-semibold text-gray-900">{workflow.timeSaved}h</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-yellow-500 to-amber-500 h-2 rounded-full" 
                      style={{ width: `${workflow.successRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Analysis */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Error Analysis</h3>
              <p className="text-gray-600">Workflow errors and failure patterns</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.errorAnalysis.map((error, index) => (
              <div key={error.workflow} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{error.workflow}</h4>
                  <span className="text-sm font-medium text-red-600">{error.errorRate.toFixed(1)}%</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-gray-600">Total Errors</p>
                    <p className="font-semibold text-gray-900">{formatNumber(error.errors)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Error Rate</p>
                    <p className="font-semibold text-red-600">{error.errorRate.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="mb-3">
                  <p className="text-xs text-gray-600 mb-1">Last Error:</p>
                  <p className="text-xs text-gray-800 bg-red-50 p-2 rounded font-mono">{error.lastError}</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full" 
                    style={{ width: `${Math.min(error.errorRate * 10, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Automation Efficiency Summary */}
      <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Automation Efficiency</h3>
            <p className="text-gray-600">Overall automation impact and ROI</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-green-600 mb-1">{data.overview.timeSaved}h</div>
            <div className="text-sm text-gray-600">Time Saved This Month</div>
          </div>
          
          <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-1">{data.overview.activeWorkflows}</div>
            <div className="text-sm text-gray-600">Active Workflows</div>
          </div>
          
          <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl">
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-1">{data.overview.successRate}%</div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
          
          <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl">
            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Play className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-yellow-600 mb-1">{formatNumber(data.overview.totalExecutions)}</div>
            <div className="text-sm text-gray-600">Total Executions</div>
          </div>
        </div>
      </div>
    </div>
  );
};
