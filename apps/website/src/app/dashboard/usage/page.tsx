/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { 
  BarChart3, 
  Activity,
  Cpu,
  HardDrive,
  Network,
  Server,
  TrendingUp,
  Clock,
  Calendar,
  Download
} from 'lucide-react';
import axios from 'axios';

interface UsageMetric {
  label: string;
  value: number;
  max: number;
  unit: string;
  icon: any;
  color: string;
}

export default function UsagePage() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState('7d');
  
  // Fetch deployments to check if user has any
  const { data: deployments = [] } = useQuery({
    queryKey: ['deployments', user?.customerId],
    queryFn: async () => {
      const response = await axios.get('/api/deployments');
      return response.data;
    },
    enabled: !!user?.customerId,
  });

  // Fetch usage data
  const { data: usage = {}, isLoading } = useQuery({
    queryKey: ['usage', user?.customerId, timeRange],
    queryFn: async () => {
      // Return empty usage if no deployments
      if (deployments.length === 0) {
        return {
          requests: 0,
          bandwidth: 0,
          buildMinutes: 0,
          storageUsed: 0,
          activeDeployments: 0,
          peakConcurrentUsers: 0,
        };
      }
      
      // TODO: Replace with actual API call
      // const response = await axios.get(`/api/usage?timeRange=${timeRange}`);
      // return response.data;
      
      // For now, return zeros for real customers
      return {
        requests: 0,
        bandwidth: 0,
        buildMinutes: 0,
        storageUsed: 0,
        activeDeployments: deployments.length,
        peakConcurrentUsers: 0,
      };
    },
    enabled: !!user?.customerId,
  });

  // Calculate usage metrics
  const usageMetrics: UsageMetric[] = [
    {
      label: 'API Requests',
      value: usage.requests || 0,
      max: 1000000, // 1M requests
      unit: 'requests',
      icon: Activity,
      color: 'bg-blue-500',
    },
    {
      label: 'Bandwidth',
      value: usage.bandwidth || 0,
      max: 100, // 100 GB
      unit: 'GB',
      icon: Network,
      color: 'bg-green-500',
    },
    {
      label: 'Build Minutes',
      value: usage.buildMinutes || 0,
      max: 1000, // 1000 minutes
      unit: 'minutes',
      icon: Clock,
      color: 'bg-purple-500',
    },
    {
      label: 'Storage',
      value: usage.storageUsed || 0,
      max: 50, // 50 GB
      unit: 'GB',
      icon: HardDrive,
      color: 'bg-orange-500',
    },
  ];

  const getPercentage = (value: number, max: number) => {
    return Math.min((value / max) * 100, 100);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Monitor your resource usage and costs</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="3m">Last 3 months</option>
            </select>
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Current Period Summary */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Current Billing Period</h2>
          <span className="text-sm text-gray-500">
            <Calendar className="inline h-4 w-4 mr-1" />
            Dec 1 - Dec 31, 2024
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-500">Current Usage</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">$0.00</p>
            <p className="mt-1 text-sm text-gray-500">Free tier</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Estimated Total</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">$0.00</p>
            <p className="mt-1 text-sm text-gray-500">By end of period</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Plan</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">Free</p>
            <button className="mt-2 text-sm text-indigo-600 hover:text-indigo-500">
              Upgrade Plan →
            </button>
          </div>
        </div>
      </div>

      {/* Usage Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {usageMetrics.map((metric) => {
          const Icon = metric.icon;
          const percentage = getPercentage(metric.value, metric.max);
          
          return (
            <div key={metric.label} className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${metric.color} bg-opacity-10`}>
                    <Icon className={`h-6 w-6 ${metric.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-900">{metric.label}</h3>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatNumber(metric.value)} 
                      <span className="text-sm font-normal text-gray-500 ml-1">{metric.unit}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    of {formatNumber(metric.max)} {metric.unit}
                  </p>
                  <p className="text-sm font-medium text-gray-900">{percentage.toFixed(1)}%</p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${metric.color} h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Usage by Deployment */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Usage by Deployment</h2>
        </div>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deployment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bandwidth
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Compute Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deployments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No deployments yet. Deploy your first application to see usage data.
                  </td>
                </tr>
              ) : (
                deployments.map((deployment: any) => (
                  <tr key={deployment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Server className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{deployment.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      0
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      0 GB
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      0 min
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      $0.00
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  Total
                </td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  {formatNumber(usage.requests || 0)}
                </td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  {usage.bandwidth || 0} GB
                </td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  {usage.buildMinutes || 0} min
                </td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  $0.00
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Free Tier Notice */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <TrendingUp className="h-5 w-5 text-blue-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              You're on the Free tier
            </h3>
            <p className="mt-1 text-sm text-blue-700">
              You have plenty of room to grow. The free tier includes 1M requests, 100GB bandwidth, and 1000 build minutes per month.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}