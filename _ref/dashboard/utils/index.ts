import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { DateRange, ChartDataPoint } from '../types';

// Date formatting utilities
export const formatDate = (date: string | Date, formatStr: string = 'MMM dd, yyyy'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, formatStr);
};

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (num: number, options?: Intl.NumberFormatOptions): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    ...options,
  }).format(num);
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

// Date range utilities
export const getDateRangePresets = () => {
  const today = new Date();
  return {
    today: {
      startDate: format(startOfDay(today), 'yyyy-MM-dd'),
      endDate: format(endOfDay(today), 'yyyy-MM-dd'),
      label: 'Today'
    },
    yesterday: {
      startDate: format(startOfDay(subDays(today, 1)), 'yyyy-MM-dd'),
      endDate: format(endOfDay(subDays(today, 1)), 'yyyy-MM-dd'),
      label: 'Yesterday'
    },
    last7Days: {
      startDate: format(startOfDay(subDays(today, 6)), 'yyyy-MM-dd'),
      endDate: format(endOfDay(today), 'yyyy-MM-dd'),
      label: 'Last 7 days'
    },
    last30Days: {
      startDate: format(startOfDay(subDays(today, 29)), 'yyyy-MM-dd'),
      endDate: format(endOfDay(today), 'yyyy-MM-dd'),
      label: 'Last 30 days'
    },
    last90Days: {
      startDate: format(startOfDay(subDays(today, 89)), 'yyyy-MM-dd'),
      endDate: format(endOfDay(today), 'yyyy-MM-dd'),
      label: 'Last 90 days'
    },
    thisMonth: {
      startDate: format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'),
      endDate: format(endOfDay(today), 'yyyy-MM-dd'),
      label: 'This month'
    },
    lastMonth: {
      startDate: format(new Date(today.getFullYear(), today.getMonth() - 1, 1), 'yyyy-MM-dd'),
      endDate: format(new Date(today.getFullYear(), today.getMonth(), 0), 'yyyy-MM-dd'),
      label: 'Last month'
    }
  };
};

// Filter data by date range
export const filterDataByDateRange = (
  data: ChartDataPoint[],
  dateRange: DateRange
): ChartDataPoint[] => {
  const startDate = new Date(dateRange.startDate);
  const endDate = new Date(dateRange.endDate);
  
  return data.filter(item => {
    const itemDate = new Date(item.date);
    return isWithinInterval(itemDate, { start: startDate, end: endDate });
  });
};

// Calculate percentage change
export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// Get trend direction
export const getTrendDirection = (change: number): 'increase' | 'decrease' | 'neutral' => {
  if (change > 0) return 'increase';
  if (change < 0) return 'decrease';
  return 'neutral';
};

// Color utilities for charts and UI
export const getColorByValue = (value: number, thresholds: { good: number; warning: number }) => {
  if (value >= thresholds.good) return 'text-green-600';
  if (value >= thresholds.warning) return 'text-yellow-600';
  return 'text-red-600';
};

export const getColorVariant = (color: string, variant: 'light' | 'medium' | 'dark' = 'medium') => {
  const colorMap: Record<string, Record<string, string>> = {
    blue: {
      light: 'bg-blue-100 text-blue-800',
      medium: 'bg-blue-500 text-white',
      dark: 'bg-blue-700 text-white'
    },
    green: {
      light: 'bg-green-100 text-green-800',
      medium: 'bg-green-500 text-white',
      dark: 'bg-green-700 text-white'
    },
    purple: {
      light: 'bg-purple-100 text-purple-800',
      medium: 'bg-purple-500 text-white',
      dark: 'bg-purple-700 text-white'
    },
    orange: {
      light: 'bg-orange-100 text-orange-800',
      medium: 'bg-orange-500 text-white',
      dark: 'bg-orange-700 text-white'
    },
    red: {
      light: 'bg-red-100 text-red-800',
      medium: 'bg-red-500 text-white',
      dark: 'bg-red-700 text-white'
    },
    pink: {
      light: 'bg-pink-100 text-pink-800',
      medium: 'bg-pink-500 text-white',
      dark: 'bg-pink-700 text-white'
    },
    yellow: {
      light: 'bg-yellow-100 text-yellow-800',
      medium: 'bg-yellow-500 text-white',
      dark: 'bg-yellow-700 text-white'
    },
    indigo: {
      light: 'bg-indigo-100 text-indigo-800',
      medium: 'bg-indigo-500 text-white',
      dark: 'bg-indigo-700 text-white'
    },
    teal: {
      light: 'bg-teal-100 text-teal-800',
      medium: 'bg-teal-500 text-white',
      dark: 'bg-teal-700 text-white'
    }
  };

  return colorMap[color]?.[variant] || colorMap.blue[variant];
};

// Chart color palettes
export const getChartColors = (count: number = 8): string[] => {
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#8B5CF6', // purple
    '#F59E0B', // orange
    '#EF4444', // red
    '#EC4899', // pink
    '#84CC16', // lime
    '#06B6D4', // cyan
    '#6366F1', // indigo
    '#14B8A6', // teal
  ];
  
  return colors.slice(0, count);
};

// Data aggregation utilities
export const aggregateDataByPeriod = (
  data: ChartDataPoint[],
  period: 'day' | 'week' | 'month'
): ChartDataPoint[] => {
  const aggregated: Record<string, number> = {};
  
  data.forEach(item => {
    const date = new Date(item.date);
    let key: string;
    
    switch (period) {
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = format(weekStart, 'yyyy-MM-dd');
        break;
      case 'month':
        key = format(date, 'yyyy-MM');
        break;
      default:
        key = format(date, 'yyyy-MM-dd');
    }
    
    aggregated[key] = (aggregated[key] || 0) + item.value;
  });
  
  return Object.entries(aggregated).map(([date, value]) => ({
    date,
    value
  })).sort((a, b) => a.date.localeCompare(b.date));
};

// Generate comparison data
export const generateComparisonData = (
  current: ChartDataPoint[],
  previous: ChartDataPoint[]
): Array<{ date: string; current: number; previous: number; change: number }> => {
  const comparison: Record<string, { current: number; previous: number }> = {};
  
  current.forEach(item => {
    comparison[item.date] = { current: item.value, previous: 0 };
  });
  
  previous.forEach(item => {
    if (comparison[item.date]) {
      comparison[item.date].previous = item.value;
    }
  });
  
  return Object.entries(comparison).map(([date, values]) => ({
    date,
    current: values.current,
    previous: values.previous,
    change: calculatePercentageChange(values.current, values.previous)
  }));
};

// Debounce utility for search and filters
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Local storage utilities for dashboard preferences
export const saveDashboardPreferences = (key: string, preferences: any): void => {
  try {
    localStorage.setItem(`dashboard_${key}`, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save dashboard preferences:', error);
  }
};

export const loadDashboardPreferences = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(`dashboard_${key}`);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn('Failed to load dashboard preferences:', error);
    return defaultValue;
  }
};

// Export utilities for data
export const exportToCSV = (data: any[], filename: string): void => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Responsive utilities
export const getResponsiveChartHeight = (screenSize: 'sm' | 'md' | 'lg' | 'xl'): number => {
  const heights = {
    sm: 200,
    md: 300,
    lg: 400,
    xl: 500
  };
  return heights[screenSize];
};

// Animation utilities
export const getStaggeredDelay = (index: number, baseDelay: number = 100): number => {
  return index * baseDelay;
};
