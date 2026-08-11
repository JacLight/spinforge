/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { 
  WebsiteAnalytics, 
  BlogAnalytics, 
  WorkflowAnalytics, 
  StorefrontAnalytics, 
  TicketAnalytics, 
  LeadsAnalytics, 
  AutomationAnalytics, 
  SocialMediaAnalytics, 
  UserAccountAnalytics,
  DashboardConfig 
} from '../types';

// Generate date range data
const generateDateRange = (days: number) => {
  const data = [];
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.floor(Math.random() * 1000) + 500
    });
  }
  return data;
};

// Website Analytics Mock Data
export const websiteAnalyticsData: WebsiteAnalytics = {
  overview: {
    totalVisitors: 45672,
    pageViews: 128934,
    bounceRate: 34.2,
    avgSessionDuration: 245,
    conversionRate: 3.8
  },
  traffic: generateDateRange(30),
  topPages: [
    { page: '/home', views: 23456, uniqueViews: 18234, bounceRate: 28.5 },
    { page: '/products', views: 18923, uniqueViews: 15234, bounceRate: 32.1 },
    { page: '/about', views: 12456, uniqueViews: 10234, bounceRate: 45.2 },
    { page: '/contact', views: 8934, uniqueViews: 7234, bounceRate: 38.7 },
    { page: '/blog', views: 7823, uniqueViews: 6234, bounceRate: 29.3 }
  ],
  deviceBreakdown: [
    { device: 'Desktop', percentage: 52.3, sessions: 23891 },
    { device: 'Mobile', percentage: 38.7, sessions: 17672 },
    { device: 'Tablet', percentage: 9.0, sessions: 4109 }
  ],
  geographicData: [
    { country: 'United States', sessions: 18234, percentage: 39.9 },
    { country: 'United Kingdom', sessions: 8923, percentage: 19.5 },
    { country: 'Canada', sessions: 5672, percentage: 12.4 },
    { country: 'Germany', sessions: 4234, percentage: 9.3 },
    { country: 'Australia', sessions: 3456, percentage: 7.6 }
  ],
  realTimeUsers: 127
};

// Blog Analytics Mock Data
export const blogAnalyticsData: BlogAnalytics = {
  overview: {
    totalPosts: 234,
    totalViews: 89234,
    avgEngagement: 4.7,
    totalComments: 1823,
    totalShares: 5672
  },
  topPosts: [
    { title: 'Advanced React Patterns', views: 8923, engagement: 8.2, publishDate: '2024-01-15', category: 'Development' },
    { title: 'UI/UX Design Trends 2024', views: 7234, engagement: 7.8, publishDate: '2024-01-20', category: 'Design' },
    { title: 'Building Scalable APIs', views: 6456, engagement: 6.9, publishDate: '2024-01-25', category: 'Backend' },
    { title: 'Mobile App Performance', views: 5823, engagement: 6.2, publishDate: '2024-02-01', category: 'Mobile' },
    { title: 'Database Optimization Tips', views: 5234, engagement: 5.8, publishDate: '2024-02-05', category: 'Database' }
  ],
  engagementTrends: generateDateRange(30),
  categoryPerformance: [
    { category: 'Development', posts: 89, avgViews: 4523, engagement: 6.8 },
    { category: 'Design', posts: 67, avgViews: 3892, engagement: 7.2 },
    { category: 'Backend', posts: 45, avgViews: 3234, engagement: 5.9 },
    { category: 'Mobile', posts: 33, avgViews: 2876, engagement: 6.1 }
  ],
  authorPerformance: [
    { author: 'John Smith', posts: 45, totalViews: 123456, avgEngagement: 7.8 },
    { author: 'Sarah Johnson', posts: 38, totalViews: 98234, avgEngagement: 7.2 },
    { author: 'Mike Chen', posts: 32, totalViews: 87234, avgEngagement: 6.9 },
    { author: 'Emily Davis', posts: 28, totalViews: 76234, avgEngagement: 6.5 }
  ]
};

// Workflow Analytics Mock Data
export const workflowAnalyticsData: WorkflowAnalytics = {
  overview: {
    totalTasks: 1247,
    completedTasks: 892,
    overdueTasks: 23,
    avgCompletionTime: 4.2,
    teamProductivity: 87.3
  },
  tasksByStatus: [
    { status: 'Completed', count: 892, percentage: 71.5 },
    { status: 'In Progress', count: 234, percentage: 18.8 },
    { status: 'Todo', count: 98, percentage: 7.9 },
    { status: 'Overdue', count: 23, percentage: 1.8 }
  ],
  tasksByType: [
    { type: 'Development', count: 456, avgTime: 5.2 },
    { type: 'Design', count: 234, avgTime: 3.8 },
    { type: 'Testing', count: 189, avgTime: 2.1 },
    { type: 'Documentation', count: 156, avgTime: 1.9 },
    { type: 'Review', count: 212, avgTime: 1.2 }
  ],
  assigneePerformance: [
    { assignee: 'Alex Thompson', assigned: 89, completed: 78, completionRate: 87.6, avgTime: 3.8 },
    { assignee: 'Maria Garcia', assigned: 76, completed: 71, completionRate: 93.4, avgTime: 4.1 },
    { assignee: 'David Wilson', assigned: 82, completed: 69, completionRate: 84.1, avgTime: 4.7 },
    { assignee: 'Lisa Brown', assigned: 67, completed: 62, completionRate: 92.5, avgTime: 3.2 }
  ],
  completionTrends: generateDateRange(30),
  workloadDistribution: [
    { assignee: 'Alex Thompson', currentTasks: 11, capacity: 15, utilization: 73.3 },
    { assignee: 'Maria Garcia', currentTasks: 8, capacity: 12, utilization: 66.7 },
    { assignee: 'David Wilson', currentTasks: 13, capacity: 15, utilization: 86.7 },
    { assignee: 'Lisa Brown', currentTasks: 5, capacity: 10, utilization: 50.0 }
  ]
};

// Storefront Analytics Mock Data
export const storefrontAnalyticsData: StorefrontAnalytics = {
  overview: {
    totalRevenue: 234567,
    totalOrders: 1823,
    avgOrderValue: 128.67,
    conversionRate: 3.4,
    returnCustomers: 67.8,
    pendingOrders: 47
  },
  channelPerformance: [
    { channel: 'Website', revenue: 145234, orders: 1123, conversionRate: 3.8 },
    { channel: 'Mobile App', revenue: 67823, orders: 534, conversionRate: 4.2 },
    { channel: 'POS', revenue: 21510, orders: 166, conversionRate: 8.9 }
  ],
  productPerformance: [
    { product: 'Premium Widget', revenue: 45234, units: 234, profit: 18093, category: 'Electronics' },
    { product: 'Standard Widget', revenue: 32156, units: 456, profit: 12862, category: 'Electronics' },
    { product: 'Deluxe Package', revenue: 28934, units: 123, profit: 17360, category: 'Bundles' },
    { product: 'Basic Service', revenue: 23456, units: 789, profit: 9382, category: 'Services' }
  ],
  salesTrends: generateDateRange(30),
  revenueTrends: generateDateRange(30).map(item => ({ ...item, value: Math.floor(Math.random() * 50) + 20 })),
  customerSegments: [
    { segment: 'VIP Customers', customers: 234, revenue: 89234, avgOrderValue: 381.34 },
    { segment: 'Regular Customers', customers: 1234, revenue: 123456, avgOrderValue: 100.05 },
    { segment: 'New Customers', customers: 567, revenue: 21877, avgOrderValue: 38.59 }
  ]
};

// Ticket Analytics Mock Data
export const ticketAnalyticsData: TicketAnalytics = {
  overview: {
    totalTickets: 1456,
    openTickets: 234,
    resolvedTickets: 1222,
    avgResolutionTime: 18.5,
    customerSatisfaction: 4.6
  },
  ticketsByPriority: [
    { priority: 'Critical', count: 23, avgResolutionTime: 4.2 },
    { priority: 'High', count: 156, avgResolutionTime: 8.7 },
    { priority: 'Medium', count: 567, avgResolutionTime: 16.3 },
    { priority: 'Low', count: 710, avgResolutionTime: 28.9 }
  ],
  ticketsByCategory: [
    { category: 'Technical Support', count: 456, percentage: 31.3 },
    { category: 'Billing', count: 234, percentage: 16.1 },
    { category: 'Feature Request', count: 189, percentage: 13.0 },
    { category: 'Bug Report', count: 167, percentage: 11.5 },
    { category: 'General Inquiry', count: 410, percentage: 28.1 }
  ],
  agentPerformance: [
    { agent: 'Sarah Wilson', assigned: 234, resolved: 218, avgResolutionTime: 16.2, satisfaction: 4.8 },
    { agent: 'Mike Johnson', assigned: 189, resolved: 176, avgResolutionTime: 18.7, satisfaction: 4.6 },
    { agent: 'Emma Davis', assigned: 156, resolved: 145, avgResolutionTime: 15.3, satisfaction: 4.7 },
    { agent: 'Tom Brown', assigned: 178, resolved: 162, avgResolutionTime: 19.8, satisfaction: 4.4 }
  ],
  resolutionTrends: generateDateRange(30),
  satisfactionTrends: generateDateRange(30).map(item => ({ ...item, value: Math.random() * 2 + 3.5 }))
};

// Leads Analytics Mock Data
export const leadsAnalyticsData: LeadsAnalytics = {
  overview: {
    totalLeads: 2345,
    qualifiedLeads: 1234,
    conversionRate: 18.7,
    avgDealSize: 4567,
    pipelineValue: 1234567
  },
  leadSources: [
    { source: 'Website', leads: 567, qualified: 234, converted: 89, conversionRate: 15.7 },
    { source: 'Social Media', leads: 456, qualified: 189, converted: 67, conversionRate: 14.7 },
    { source: 'Email Campaign', leads: 389, qualified: 167, converted: 78, conversionRate: 20.1 },
    { source: 'Referral', leads: 234, qualified: 123, converted: 56, conversionRate: 23.9 },
    { source: 'Paid Ads', leads: 699, qualified: 521, converted: 148, conversionRate: 21.2 }
  ],
  funnelData: [
    { stage: 'Leads', count: 2345, conversionRate: 100 },
    { stage: 'Qualified', count: 1234, conversionRate: 52.6 },
    { stage: 'Opportunity', count: 567, conversionRate: 24.2 },
    { stage: 'Proposal', count: 234, conversionRate: 10.0 },
    { stage: 'Closed Won', count: 89, conversionRate: 3.8 }
  ],
  campaignPerformance: [
    { campaign: 'Q1 Product Launch', leads: 456, cost: 12000, costPerLead: 26.32, roi: 340 },
    { campaign: 'Summer Sale', leads: 234, cost: 8000, costPerLead: 34.19, roi: 280 },
    { campaign: 'Holiday Special', leads: 189, cost: 6000, costPerLead: 31.75, roi: 320 },
    { campaign: 'Back to School', leads: 167, cost: 5500, costPerLead: 32.93, roi: 290 }
  ],
  leadTrends: generateDateRange(30),
  dealStages: [
    { stage: 'Prospecting', deals: 234, value: 567890, avgDealSize: 2427 },
    { stage: 'Qualification', deals: 156, value: 456789, avgDealSize: 2928 },
    { stage: 'Proposal', deals: 89, value: 234567, avgDealSize: 2636 },
    { stage: 'Negotiation', deals: 45, value: 123456, avgDealSize: 2743 }
  ]
};

// Automation Analytics Mock Data
export const automationAnalyticsData: AutomationAnalytics = {
  overview: {
    activeWorkflows: 45,
    totalExecutions: 12456,
    successRate: 94.7,
    timeSaved: 2340,
    errorRate: 5.3
  },
  workflowPerformance: [
    { workflow: 'Lead Nurturing', executions: 2345, successRate: 96.8, avgExecutionTime: 2.3, timeSaved: 567 },
    { workflow: 'Customer Onboarding', executions: 1234, successRate: 94.2, avgExecutionTime: 5.7, timeSaved: 890 },
    { workflow: 'Invoice Processing', executions: 3456, successRate: 98.1, avgExecutionTime: 1.2, timeSaved: 456 },
    { workflow: 'Support Ticket Routing', executions: 2890, successRate: 92.4, avgExecutionTime: 0.8, timeSaved: 234 }
  ],
  triggerAnalysis: [
    { trigger: 'Form Submission', executions: 4567, successRate: 95.6 },
    { trigger: 'Email Opened', executions: 3456, successRate: 97.2 },
    { trigger: 'Purchase Completed', executions: 2345, successRate: 98.9 },
    { trigger: 'Support Ticket Created', executions: 2088, successRate: 91.3 }
  ],
  executionTrends: generateDateRange(30),
  errorAnalysis: [
    { workflow: 'Lead Nurturing', errors: 23, errorRate: 3.2, lastError: 'API timeout' },
    { workflow: 'Customer Onboarding', errors: 45, errorRate: 5.8, lastError: 'Email delivery failed' },
    { workflow: 'Invoice Processing', errors: 12, errorRate: 1.9, lastError: 'Invalid data format' },
    { workflow: 'Support Ticket Routing', errors: 67, errorRate: 7.6, lastError: 'Agent unavailable' }
  ]
};

// Social Media Analytics Mock Data
export const socialMediaAnalyticsData: SocialMediaAnalytics = {
  overview: {
    totalFollowers: 234567,
    totalEngagement: 45678,
    totalPosts: 456,
    avgEngagementRate: 4.8,
    reachGrowth: 12.3
  },
  platformPerformance: [
    { platform: 'Instagram', followers: 89234, engagement: 18456, posts: 123, reach: 456789, engagementRate: 5.2 },
    { platform: 'Twitter', followers: 67890, engagement: 12345, posts: 156, reach: 234567, engagementRate: 4.1 },
    { platform: 'Facebook', followers: 45678, engagement: 8901, posts: 89, reach: 189234, engagementRate: 3.9 },
    { platform: 'LinkedIn', followers: 23456, engagement: 4567, posts: 67, reach: 98765, engagementRate: 6.8 },
    { platform: 'TikTok', followers: 8309, engagement: 1409, posts: 21, reach: 45678, engagementRate: 8.2 }
  ],
  contentPerformance: [
    { post: 'Product Launch Video', platform: 'Instagram', engagement: 2345, reach: 23456, date: '2024-02-15', type: 'Video' },
    { post: 'Behind the Scenes', platform: 'TikTok', engagement: 1890, reach: 18900, date: '2024-02-14', type: 'Video' },
    { post: 'Industry Insights', platform: 'LinkedIn', engagement: 1234, reach: 12340, date: '2024-02-13', type: 'Article' },
    { post: 'Customer Testimonial', platform: 'Facebook', engagement: 987, reach: 9870, date: '2024-02-12', type: 'Image' }
  ],
  engagementTrends: generateDateRange(30),
  audienceGrowth: generateDateRange(30),
  hashtagPerformance: [
    { hashtag: '#productivity', usage: 234, engagement: 4567, reach: 23456 },
    { hashtag: '#innovation', usage: 189, engagement: 3456, reach: 18900 },
    { hashtag: '#technology', usage: 156, engagement: 2890, reach: 15600 },
    { hashtag: '#business', usage: 123, engagement: 2345, reach: 12300 }
  ]
};

// User Account Analytics Mock Data
export const userAccountAnalyticsData: UserAccountAnalytics = {
  overview: {
    totalUsers: 12456,
    activeUsers: 8934,
    totalRevenue: 567890,
    avgRevenuePerUser: 45.62,
    churnRate: 3.2
  },
  userGrowth: generateDateRange(30),
  revenueBreakdown: [
    { source: 'Subscriptions', revenue: 345678, percentage: 60.9 },
    { source: 'API Usage', revenue: 123456, percentage: 21.7 },
    { source: 'Premium Features', revenue: 67890, percentage: 12.0 },
    { source: 'Support Services', revenue: 30866, percentage: 5.4 }
  ],
  apiUsage: [
    { endpoint: '/api/users', calls: 234567, cost: 1234.56, avgResponseTime: 120 },
    { endpoint: '/api/data', calls: 189234, cost: 945.67, avgResponseTime: 89 },
    { endpoint: '/api/analytics', calls: 156789, cost: 789.45, avgResponseTime: 156 },
    { endpoint: '/api/reports', calls: 123456, cost: 567.89, avgResponseTime: 234 }
  ],
  userActivities: [
    { activity: 'Login', count: 45678, percentage: 35.2 },
    { activity: 'Data Export', count: 23456, percentage: 18.1 },
    { activity: 'Report Generation', count: 18934, percentage: 14.6 },
    { activity: 'API Calls', count: 15678, percentage: 12.1 },
    { activity: 'Settings Update', count: 25954, percentage: 20.0 }
  ],
  costAnalysis: [
    { service: 'Cloud Hosting', cost: 12345, usage: 89.5, efficiency: 92.3 },
    { service: 'Database', cost: 8901, usage: 76.2, efficiency: 88.7 },
    { service: 'CDN', cost: 4567, usage: 65.8, efficiency: 94.1 },
    { service: 'Monitoring', cost: 2345, usage: 45.3, efficiency: 87.9 }
  ],
  subscriptionTiers: [
    { tier: 'Free', users: 6789, revenue: 0, churnRate: 8.9 },
    { tier: 'Basic', users: 3456, revenue: 123456, churnRate: 4.2 },
    { tier: 'Pro', users: 1890, revenue: 234567, churnRate: 2.1 },
    { tier: 'Enterprise', users: 321, revenue: 209867, churnRate: 0.8 }
  ]
};

// Dashboard Configurations
export const dashboardConfigs: DashboardConfig[] = [
  {
    id: 'website',
    title: 'Website Analytics',
    description: 'Track website traffic, user behavior, and conversion metrics',
    icon: 'BarChart3',
    color: 'blue',
    refreshInterval: 300000 // 5 minutes
  },
  {
    id: 'blog',
    title: 'Blog Analytics',
    description: 'Monitor blog performance, engagement, and content metrics',
    icon: 'FileText',
    color: 'green',
    refreshInterval: 600000 // 10 minutes
  },
  {
    id: 'workflow',
    title: 'Workflow Analytics',
    description: 'Analyze task management, team productivity, and project progress',
    icon: 'GitBranch',
    color: 'purple',
    refreshInterval: 300000
  },
  {
    id: 'storefront',
    title: 'Storefront Analytics',
    description: 'E-commerce metrics across multiple sales channels',
    icon: 'ShoppingCart',
    color: 'orange',
    refreshInterval: 300000
  },
  {
    id: 'tickets',
    title: 'Support Tickets',
    description: 'Customer support performance and ticket resolution metrics',
    icon: 'Headphones',
    color: 'red',
    refreshInterval: 180000 // 3 minutes
  },
  {
    id: 'leads',
    title: 'Leads & Marketing',
    description: 'Lead generation, conversion funnel, and campaign performance',
    icon: 'Target',
    color: 'pink',
    refreshInterval: 600000
  },
  {
    id: 'automation',
    title: 'CRM Automation',
    description: 'Workflow automation performance and efficiency metrics',
    icon: 'Zap',
    color: 'yellow',
    refreshInterval: 300000
  },
  {
    id: 'social',
    title: 'Social Media',
    description: 'Centralized analytics for all major social media platforms',
    icon: 'Share2',
    color: 'indigo',
    refreshInterval: 600000
  },
  {
    id: 'users',
    title: 'User Accounts',
    description: 'User management, revenue, API usage, and cost analysis',
    icon: 'Users',
    color: 'teal',
    refreshInterval: 300000
  }
];

// Export all data
export const mockDashboardData = {
  website: websiteAnalyticsData,
  blog: blogAnalyticsData,
  workflow: workflowAnalyticsData,
  storefront: storefrontAnalyticsData,
  tickets: ticketAnalyticsData,
  leads: leadsAnalyticsData,
  automation: automationAnalyticsData,
  social: socialMediaAnalyticsData,
  users: userAccountAnalyticsData
};
