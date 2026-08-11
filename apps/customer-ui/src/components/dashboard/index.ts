/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
// Export main dashboard component
export { Dashboard as AnalyticsDashboard } from './components/Dashboard';

// Export types
export * from './types';

// Export utilities
export * from './utils';

// Export mock data
export * from './data/mockData';

// Export individual components
export {
  MetricCard,
  DateRangePicker,
  ChartContainer,
  WebsiteAnalyticsDashboard,
  BlogAnalyticsDashboard,
  WorkflowAnalyticsDashboard,
  StorefrontAnalyticsDashboard,
  TicketAnalyticsDashboard,
  LeadsAnalyticsDashboard,
  AutomationAnalyticsDashboard,
  SocialMediaAnalyticsDashboard,
  UserAccountAnalyticsDashboard
} from './components';
