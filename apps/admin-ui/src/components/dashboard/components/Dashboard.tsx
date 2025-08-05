/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  FileText, 
  GitBranch, 
  ShoppingCart, 
  Headphones, 
  Target, 
  Zap, 
  Share2, 
  Users,
  Grid3X3,
  RefreshCw
} from 'lucide-react';
import { DateRange, DashboardType, DashboardData } from '../types';
import { DateRangePicker } from './DateRangePicker';
import { getDateRangePresets, loadDashboardPreferences, saveDashboardPreferences } from '../utils';
import { dashboardConfigs, mockDashboardData } from '../data/mockData';

// Import individual dashboard components
import { 
  WebsiteAnalyticsDashboard,
  BlogAnalyticsDashboard,
  WorkflowAnalyticsDashboard,
  StorefrontAnalyticsDashboard,
  TicketAnalyticsDashboard,
  LeadsAnalyticsDashboard,
  AutomationAnalyticsDashboard,
  SocialMediaAnalyticsDashboard,
  UserAccountAnalyticsDashboard
} from './index';

interface DashboardProps {
  className?: string;
}

const iconMap = {
  BarChart3,
  FileText,
  GitBranch,
  ShoppingCart,
  Headphones,
  Target,
  Zap,
  Share2,
  Users
};

export const Dashboard: React.FC<DashboardProps> = ({ className = '' }) => {
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardType>('website');
  const [dateRange, setDateRange] = useState<DateRange>(
    loadDashboardPreferences('dateRange', getDateRangePresets().last30Days)
  );
  const [dashboardData, setDashboardData] = useState<DashboardData>(mockDashboardData);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Save date range preference when it changes
  useEffect(() => {
    saveDashboardPreferences('dateRange', dateRange);
  }, [dateRange]);

  // Auto-refresh data based on dashboard refresh intervals
  useEffect(() => {
    const currentConfig = dashboardConfigs.find(config => config.id === selectedDashboard);
    if (!currentConfig?.refreshInterval) return;

    const interval = setInterval(() => {
      handleRefreshData();
    }, currentConfig.refreshInterval);

    return () => clearInterval(interval);
  }, [selectedDashboard]);

  const handleRefreshData = async () => {
    setIsLoading(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In a real app, this would fetch fresh data from APIs
    // For now, we'll just update the timestamp
    setLastRefresh(new Date());
    setIsLoading(false);
  };

  const handleDashboardChange = (dashboardType: DashboardType) => {
    setSelectedDashboard(dashboardType);
    saveDashboardPreferences('selectedDashboard', dashboardType);
  };

  const renderDashboard = () => {
    const props = {
      data: dashboardData[selectedDashboard],
      dateRange,
      isLoading,
      onRefresh: handleRefreshData
    };

    switch (selectedDashboard) {
      case 'website':
        return <WebsiteAnalyticsDashboard {...props} data={dashboardData.website!} />;
      case 'blog':
        return <BlogAnalyticsDashboard {...props} data={dashboardData.blog!} />;
      case 'workflow':
        return <WorkflowAnalyticsDashboard {...props} data={dashboardData.workflow!} />;
      case 'storefront':
        return <StorefrontAnalyticsDashboard {...props} data={dashboardData.storefront!} />;
      case 'tickets':
        return <TicketAnalyticsDashboard {...props} data={dashboardData.tickets!} />;
      case 'leads':
        return <LeadsAnalyticsDashboard {...props} data={dashboardData.leads!} />;
      case 'automation':
        return <AutomationAnalyticsDashboard {...props} data={dashboardData.automation!} />;
      case 'social':
        return <SocialMediaAnalyticsDashboard {...props} data={dashboardData.social!} />;
      case 'users':
        return <UserAccountAnalyticsDashboard {...props} data={dashboardData.users!} />;
      default:
        return <div>Dashboard not found</div>;
    }
  };

  const currentConfig = dashboardConfigs.find(config => config.id === selectedDashboard);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 ${className}`}>
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Grid3X3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Analytics Command Center
                  </h1>
                  <p className="text-sm text-gray-500">Real-time business intelligence</p>
                </div>
              </div>
              
      {/* Enhanced Dashboard Navigation */}
      <div className="hidden lg:flex items-center space-x-2">
        {/* Primary Dashboard Tabs */}
        <div className="flex items-center space-x-1 bg-white/60 backdrop-blur-sm rounded-2xl p-1 border border-white/20 shadow-lg">
          {dashboardConfigs.slice(0, 4).map((config) => {
            const Icon = iconMap[config.icon as keyof typeof iconMap];
            const isActive = selectedDashboard === config.id;
            
            return (
              <button
                key={config.id}
                onClick={() => handleDashboardChange(config.id as DashboardType)}
                className={`group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-lg"></div>
                )}
                <Icon className={`w-4 h-4 relative z-10 ${isActive ? 'text-white' : ''}`} />
                <span className="hidden xl:inline relative z-10">{config.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
        
        {/* More Dashboards Dropdown */}
        <div className="relative">
          <select
            value={selectedDashboard}
            onChange={(e) => handleDashboardChange(e.target.value as DashboardType)}
            className="appearance-none bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-white/80 transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {dashboardConfigs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.title}
              </option>
            ))}
          </select>
        </div>
      </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <DateRangePicker
                dateRange={dateRange}
                onChange={setDateRange}
              />
              
              <button
                onClick={handleRefreshData}
                disabled={isLoading}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Content */}
      <div className="px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                {currentConfig?.title}
              </h2>
              <p className="text-lg text-gray-600 mt-2">{currentConfig?.description}</p>
            </div>
            
            {/* Live Status Indicator */}
            <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">Live</span>
              </div>
              <div className="w-px h-4 bg-gray-300"></div>
              <div className="text-sm text-gray-600">
                Updated {lastRefresh.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
        
        {renderDashboard()}
      </div>
    </div>
  );
};
