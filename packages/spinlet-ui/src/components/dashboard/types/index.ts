// Common types
export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon?: string;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

// Website/App Analytics
export interface WebsiteAnalytics {
  overview: {
    totalVisitors: number;
    pageViews: number;
    bounceRate: number;
    avgSessionDuration: number;
    conversionRate: number;
  };
  traffic: ChartDataPoint[];
  topPages: Array<{
    page: string;
    views: number;
    uniqueViews: number;
    bounceRate: number;
  }>;
  deviceBreakdown: Array<{
    device: string;
    percentage: number;
    sessions: number;
  }>;
  geographicData: Array<{
    country: string;
    sessions: number;
    percentage: number;
  }>;
  realTimeUsers: number;
}

// Posts/Blogs Analytics
export interface BlogAnalytics {
  overview: {
    totalPosts: number;
    totalViews: number;
    avgEngagement: number;
    totalComments: number;
    totalShares: number;
  };
  topPosts: Array<{
    title: string;
    views: number;
    engagement: number;
    publishDate: string;
    category: string;
  }>;
  engagementTrends: ChartDataPoint[];
  categoryPerformance: Array<{
    category: string;
    posts: number;
    avgViews: number;
    engagement: number;
  }>;
  authorPerformance: Array<{
    author: string;
    posts: number;
    totalViews: number;
    avgEngagement: number;
  }>;
}

// Workflow/Task Analytics
export interface WorkflowAnalytics {
  overview: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    avgCompletionTime: number;
    teamProductivity: number;
  };
  tasksByStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  tasksByType: Array<{
    type: string;
    count: number;
    avgTime: number;
  }>;
  assigneePerformance: Array<{
    assignee: string;
    assigned: number;
    completed: number;
    completionRate: number;
    avgTime: number;
  }>;
  completionTrends: ChartDataPoint[];
  workloadDistribution: Array<{
    assignee: string;
    currentTasks: number;
    capacity: number;
    utilization: number;
  }>;
}

// Storefront Analytics
export interface StorefrontAnalytics {
  overview: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    conversionRate: number;
    returnCustomers: number;
    pendingOrders?: number;
  };
  channelPerformance: Array<{
    channel: string;
    revenue: number;
    orders: number;
    conversionRate: number;
  }>;
  productPerformance: Array<{
    product: string;
    revenue: number;
    units: number;
    profit: number;
    category: string;
  }>;
  salesTrends: ChartDataPoint[];
  revenueTrends?: ChartDataPoint[];
  customerSegments: Array<{
    segment: string;
    customers: number;
    revenue: number;
    avgOrderValue: number;
  }>;
}

// CRM Ticket Analytics
export interface TicketAnalytics {
  overview: {
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    avgResolutionTime: number;
    customerSatisfaction: number;
  };
  ticketsByPriority: Array<{
    priority: string;
    count: number;
    avgResolutionTime: number;
  }>;
  ticketsByCategory: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  agentPerformance: Array<{
    agent: string;
    assigned: number;
    resolved: number;
    avgResolutionTime: number;
    satisfaction: number;
  }>;
  resolutionTrends: ChartDataPoint[];
  satisfactionTrends: ChartDataPoint[];
}

// CRM Leads/Marketing Analytics
export interface LeadsAnalytics {
  overview: {
    totalLeads: number;
    qualifiedLeads: number;
    conversionRate: number;
    avgDealSize: number;
    pipelineValue: number;
  };
  leadSources: Array<{
    source: string;
    leads: number;
    qualified: number;
    converted: number;
    conversionRate: number;
  }>;
  funnelData: Array<{
    stage: string;
    count: number;
    conversionRate: number;
  }>;
  campaignPerformance: Array<{
    campaign: string;
    leads: number;
    cost: number;
    costPerLead: number;
    roi: number;
  }>;
  leadTrends: ChartDataPoint[];
  dealStages: Array<{
    stage: string;
    deals: number;
    value: number;
    avgDealSize: number;
  }>;
}

// CRM Automation Analytics
export interface AutomationAnalytics {
  overview: {
    activeWorkflows: number;
    totalExecutions: number;
    successRate: number;
    timeSaved: number;
    errorRate: number;
  };
  workflowPerformance: Array<{
    workflow: string;
    executions: number;
    successRate: number;
    avgExecutionTime: number;
    timeSaved: number;
  }>;
  triggerAnalysis: Array<{
    trigger: string;
    executions: number;
    successRate: number;
  }>;
  executionTrends: ChartDataPoint[];
  errorAnalysis: Array<{
    workflow: string;
    errors: number;
    errorRate: number;
    lastError: string;
  }>;
}

// Social Media Analytics
export interface SocialMediaAnalytics {
  overview: {
    totalFollowers: number;
    totalEngagement: number;
    totalPosts: number;
    avgEngagementRate: number;
    reachGrowth: number;
  };
  platformPerformance: Array<{
    platform: string;
    followers: number;
    engagement: number;
    posts: number;
    reach: number;
    engagementRate: number;
  }>;
  contentPerformance: Array<{
    post: string;
    platform: string;
    engagement: number;
    reach: number;
    date: string;
    type: string;
  }>;
  engagementTrends: ChartDataPoint[];
  audienceGrowth: ChartDataPoint[];
  hashtagPerformance: Array<{
    hashtag: string;
    usage: number;
    engagement: number;
    reach: number;
  }>;
}

// User Account Analytics
export interface UserAccountAnalytics {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalRevenue: number;
    avgRevenuePerUser: number;
    churnRate: number;
  };
  userGrowth: ChartDataPoint[];
  revenueBreakdown: Array<{
    source: string;
    revenue: number;
    percentage: number;
  }>;
  apiUsage: Array<{
    endpoint: string;
    calls: number;
    cost: number;
    avgResponseTime: number;
  }>;
  userActivities: Array<{
    activity: string;
    count: number;
    percentage: number;
  }>;
  costAnalysis: Array<{
    service: string;
    cost: number;
    usage: number;
    efficiency: number;
  }>;
  subscriptionTiers: Array<{
    tier: string;
    users: number;
    revenue: number;
    churnRate: number;
  }>;
}

// Dashboard Configuration
export interface DashboardConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  refreshInterval?: number;
}

export type DashboardType = 
  | 'website'
  | 'blog'
  | 'workflow'
  | 'storefront'
  | 'tickets'
  | 'leads'
  | 'automation'
  | 'social'
  | 'users';

export interface DashboardData {
  website?: WebsiteAnalytics;
  blog?: BlogAnalytics;
  workflow?: WorkflowAnalytics;
  storefront?: StorefrontAnalytics;
  tickets?: TicketAnalytics;
  leads?: LeadsAnalytics;
  automation?: AutomationAnalytics;
  social?: SocialMediaAnalytics;
  users?: UserAccountAnalytics;
}
