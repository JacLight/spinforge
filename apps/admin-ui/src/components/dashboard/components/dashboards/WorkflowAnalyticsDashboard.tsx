/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WorkflowAnalytics, DateRange } from '../../types';
import { formatNumber, getChartColors, exportToCSV } from '../../utils';
import { CheckSquare, Clock, Users, TrendingUp, GitBranch } from 'lucide-react';

interface WorkflowAnalyticsDashboardProps {
  data: WorkflowAnalytics;
  dateRange: DateRange;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const WorkflowAnalyticsDashboard: React.FC<WorkflowAnalyticsDashboardProps> = ({
  data,
  dateRange,
  isLoading = false,
  onRefresh
}) => {
  const colors = getChartColors(6);

  const overviewMetrics = [
    {
      title: 'Total Tasks',
      value: data.overview.totalTasks,
      change: 5.2,
      changeType: 'increase' as const,
      icon: CheckSquare
    },
    {
      title: 'Completed Tasks',
      value: data.overview.completedTasks,
      change: 8.1,
      changeType: 'increase' as const,
      icon: CheckSquare
    },
    {
      title: 'Overdue Tasks',
      value: data.overview.overdueTasks,
      change: -12.3,
      changeType: 'decrease' as const,
      icon: Clock
    },
    {
      title: 'Avg Completion Time',
      value: `${data.overview.avgCompletionTime}d`,
      change: -5.7,
      changeType: 'decrease' as const,
      icon: Clock
    },
    {
      title: 'Team Productivity',
      value: `${data.overview.teamProductivity.toFixed(1)}%`,
      change: 3.4,
      changeType: 'increase' as const,
      icon: Users
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
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-cyan-600/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
              <div className="relative bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/80 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center">
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

      {/* Task Management Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Task Completion Trends - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Task Completion Trends</h3>
                <p className="text-gray-600">Daily task completion over the last 30 days</p>
              </div>
              <button
                onClick={() => exportToCSV(data.completionTrends, 'task-completion-trends')}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl hover:from-indigo-600 hover:to-cyan-600 transition-all duration-200 text-sm font-medium"
              >
                Export Data
              </button>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.completionTrends}>
                  <defs>
                    <linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0.05}/>
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
                    formatter={(value: number) => [formatNumber(value), 'Tasks Completed']}
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
                    stroke="#6366F1" 
                    strokeWidth={3}
                    fill="url(#completionGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Task Status Breakdown */}
        <div className="space-y-6">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Status</h3>
            <div className="space-y-4">
              {data.tasksByStatus.map((status, index) => (
                <div key={status.status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[index] }}
                    ></div>
                    <span className="text-sm font-medium text-gray-700">{status.status}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{formatNumber(status.count)}</div>
                    <div className="text-xs text-gray-500">{status.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team Workload */}
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Workload</h3>
            <div className="space-y-4">
              {data.workloadDistribution.slice(0, 4).map((member) => (
                <div key={member.assignee} className="p-3 bg-gray-50/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 text-sm">{member.assignee}</span>
                    <span className="text-xs text-gray-600">{member.utilization.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        member.utilization > 85 ? 'bg-red-500' : 
                        member.utilization > 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(member.utilization, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>{member.currentTasks} tasks</span>
                    <span>{member.capacity} capacity</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Team Performance & Task Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Team Performance */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Team Performance</h3>
              <p className="text-gray-600">Individual contributor metrics</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.assigneePerformance.map((assignee, index) => (
              <div key={assignee.assignee} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <span className="font-semibold text-gray-900">{assignee.assignee}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{assignee.completionRate.toFixed(1)}%</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Assigned</p>
                    <p className="font-semibold text-gray-900">{assignee.assigned}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Completed</p>
                    <p className="font-semibold text-gray-900">{assignee.completed}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Avg Time</p>
                    <p className="font-semibold text-gray-900">{assignee.avgTime}d</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-2 rounded-full" 
                      style={{ width: `${assignee.completionRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Types Analysis */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Task Types</h3>
              <p className="text-gray-600">Distribution and average completion time</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.tasksByType.map((taskType, index) => (
              <div key={taskType.type} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{taskType.type}</h4>
                  <span className="text-sm font-medium text-gray-600">{taskType.avgTime}d avg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{formatNumber(taskType.count)} tasks</span>
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-2 rounded-full" 
                      style={{ width: `${(taskType.count / data.tasksByType[0].count) * 100}%` }}
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
