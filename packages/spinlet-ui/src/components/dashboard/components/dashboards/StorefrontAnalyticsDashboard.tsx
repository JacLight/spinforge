import React from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StorefrontAnalytics, DateRange } from '../../types';
import { formatNumber, formatCurrency, formatPercentage, getChartColors, exportToCSV, formatDate } from '../../utils';
import { ShoppingCart, Package, DollarSign, TrendingUp, Users, Clock } from 'lucide-react';

interface StorefrontAnalyticsDashboardProps {
  data: StorefrontAnalytics;
  dateRange: DateRange;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const StorefrontAnalyticsDashboard: React.FC<StorefrontAnalyticsDashboardProps> = ({
  data,
  dateRange,
  isLoading = false,
  onRefresh
}) => {
  const colors = getChartColors(6);

  const overviewMetrics = [
    {
      title: 'Total Revenue',
      value: data.overview.totalRevenue,
      change: 12.3,
      changeType: 'increase' as const,
      icon: DollarSign
    },
    {
      title: 'Total Orders',
      value: data.overview.totalOrders,
      change: 8.7,
      changeType: 'increase' as const,
      icon: ShoppingCart
    },
    {
      title: 'Avg Order Value',
      value: data.overview.avgOrderValue,
      change: 5.2,
      changeType: 'increase' as const,
      icon: TrendingUp
    },
    {
      title: 'Conversion Rate',
      value: data.overview.conversionRate || 3.2,
      change: 2.1,
      changeType: 'increase' as const,
      icon: Users
    },
    {
      title: 'Pending Orders',
      value: data.overview.pendingOrders || 47,
      change: -5.3,
      changeType: 'decrease' as const,
      icon: Clock
    }
  ];

  // Mock order data for comprehensive order analytics
  const recentOrders = [
    { id: 'ORD-2025-001', customer: 'John Smith', amount: 299.99, status: 'Completed', channel: 'Web', date: '2025-06-19T10:30:00Z', items: 3 },
    { id: 'ORD-2025-002', customer: 'Sarah Johnson', amount: 149.50, status: 'Processing', channel: 'Mobile App', date: '2025-06-19T09:15:00Z', items: 2 },
    { id: 'ORD-2025-003', customer: 'Mike Davis', amount: 89.99, status: 'Shipped', channel: 'POS', date: '2025-06-19T08:45:00Z', items: 1 },
    { id: 'ORD-2025-004', customer: 'Emily Brown', amount: 199.99, status: 'Pending', channel: 'Web', date: '2025-06-19T08:20:00Z', items: 4 },
    { id: 'ORD-2025-005', customer: 'David Wilson', amount: 349.99, status: 'Completed', channel: 'Mobile App', date: '2025-06-19T07:55:00Z', items: 2 }
  ];

  const ordersByStatus = [
    { status: 'Completed', count: 1247, percentage: 68.2, color: '#10B981' },
    { status: 'Processing', count: 234, percentage: 12.8, color: '#F59E0B' },
    { status: 'Shipped', count: 189, percentage: 10.3, color: '#3B82F6' },
    { status: 'Pending', count: 98, percentage: 5.4, color: '#EF4444' },
    { status: 'Cancelled', count: 61, percentage: 3.3, color: '#6B7280' }
  ];

  const channelPerformance = [
    { channel: 'Web Store', orders: 892, revenue: 234567, percentage: 45.2 },
    { channel: 'Mobile App', orders: 567, revenue: 156789, percentage: 28.7 },
    { channel: 'POS System', orders: 234, revenue: 89456, percentage: 16.8 },
    { channel: 'Marketplace', orders: 156, revenue: 45678, percentage: 9.3 }
  ];

  // Enhanced e-commerce data
  const topProducts = [
    { name: 'Premium Wireless Headphones', sales: 1247, revenue: 186750, profit: 74700, category: 'Electronics', rating: 4.8, returns: 23 },
    { name: 'Smart Fitness Watch', sales: 892, revenue: 178400, profit: 89200, category: 'Wearables', rating: 4.6, returns: 18 },
    { name: 'Bluetooth Speaker', sales: 756, revenue: 113400, profit: 45360, category: 'Audio', rating: 4.7, returns: 12 },
    { name: 'Wireless Charger', sales: 634, revenue: 63400, profit: 31700, category: 'Accessories', rating: 4.5, returns: 8 },
    { name: 'Phone Case Set', sales: 523, revenue: 26150, profit: 15690, category: 'Accessories', rating: 4.4, returns: 15 }
  ];

  const customerSegments = [
    { segment: 'VIP Customers', customers: 234, orders: 1247, avgOrderValue: 285.50, totalSpent: 355767, retention: 94.2 },
    { segment: 'Regular Customers', customers: 1456, orders: 3892, avgOrderValue: 125.75, totalSpent: 489423, retention: 78.5 },
    { segment: 'New Customers', customers: 892, orders: 892, avgOrderValue: 89.25, totalSpent: 79613, retention: 45.2 },
    { segment: 'At-Risk Customers', customers: 156, orders: 234, avgOrderValue: 156.80, totalSpent: 36691, retention: 23.1 }
  ];

  const returnsData = [
    { reason: 'Defective Product', count: 89, percentage: 34.2, refundAmount: 12450, avgProcessTime: 2.3 },
    { reason: 'Wrong Size/Color', count: 67, percentage: 25.8, refundAmount: 8945, avgProcessTime: 1.8 },
    { reason: 'Not as Described', count: 45, percentage: 17.3, refundAmount: 6780, avgProcessTime: 3.1 },
    { reason: 'Changed Mind', count: 34, percentage: 13.1, refundAmount: 4567, avgProcessTime: 1.5 },
    { reason: 'Damaged in Shipping', count: 25, percentage: 9.6, refundAmount: 3890, avgProcessTime: 2.8 }
  ];

  const formatValue = (value: string | number) => {
    if (typeof value === 'string') return value;
    if (value > 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value > 1000) return `$${(value / 1000).toFixed(1)}K`;
    return formatCurrency(value);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8">
      {/* Enhanced E-commerce Hero Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {overviewMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={metric.title} className="group relative overflow-hidden">
              {/* Animated background with e-commerce theme */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-rose-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 group-hover:scale-110"></div>
              
              {/* Premium glass card */}
              <div className="relative bg-white/85 backdrop-blur-xl border border-white/40 rounded-2xl p-6 hover:bg-white/95 transition-all duration-500 shadow-xl hover:shadow-2xl group-hover:scale-105">
                {/* Floating particles effect */}
                <div className="absolute top-3 right-3 w-16 h-16 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:rotate-6">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className={`flex items-center space-x-1 text-sm font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm ${
                    metric.changeType === 'increase' 
                      ? 'bg-emerald-100/80 text-emerald-700 border border-emerald-200/50' 
                      : 'bg-red-100/80 text-red-700 border border-red-200/50'
                  }`}>
                    <TrendingUp className={`w-3.5 h-3.5 ${metric.changeType === 'decrease' ? 'rotate-180' : ''}`} />
                    <span>{Math.abs(metric.change)}%</span>
                  </div>
                </div>
                
                <div className="relative z-10">
                  <p className="text-sm font-medium text-gray-600 mb-2">{metric.title}</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {metric.title.includes('Revenue') || metric.title.includes('Value') 
                      ? formatValue(metric.value) 
                      : typeof metric.value === 'number' && metric.title.includes('Rate')
                      ? `${metric.value}%`
                      : formatNumber(metric.value)}
                  </p>
                  
                  {/* Revenue-specific progress bar */}
                  <div className="mt-3 w-full bg-gray-200/50 rounded-full h-1.5">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(Math.abs(metric.change) * 3, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Orders Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Recent Orders</h3>
                <p className="text-gray-600">Latest customer orders across all channels</p>
              </div>
              <button
                onClick={() => exportToCSV(recentOrders, 'recent-orders')}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 text-sm font-medium"
              >
                Export Orders
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Order ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Channel</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Items</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm font-medium text-blue-600">{order.id}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-medium text-gray-900">{order.customer}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-gray-900">{formatCurrency(order.amount)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">{order.channel}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">{order.items} items</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">
                          {new Date(order.date).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Order Status Breakdown */}
        <div className="space-y-6">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status</h3>
            <div className="space-y-4">
              {ordersByStatus.map((status) => (
                <div key={status.status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: status.color }}
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

          {/* Quick Actions */}
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full text-left p-3 bg-gray-50/50 rounded-xl hover:bg-gray-100/50 transition-colors">
                <div className="flex items-center space-x-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900">Process Pending Orders</span>
                </div>
                <p className="text-xs text-gray-600 mt-1 ml-8">47 orders waiting</p>
              </button>
              
              <button className="w-full text-left p-3 bg-gray-50/50 rounded-xl hover:bg-gray-100/50 transition-colors">
                <div className="flex items-center space-x-3">
                  <ShoppingCart className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">View All Orders</span>
                </div>
                <p className="text-xs text-gray-600 mt-1 ml-8">Manage order history</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Performance & Customer Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Products */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Top Products</h3>
              <p className="text-gray-600">Best selling products by revenue and profit</p>
            </div>
            <button
              onClick={() => exportToCSV(topProducts, 'top-products')}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div key={product.name} className="p-4 bg-gray-50/50 rounded-xl hover:bg-gray-100/50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{product.name}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {product.category}
                        </span>
                        <div className="flex items-center space-x-1">
                          <span className="text-yellow-500">⭐</span>
                          <span className="text-xs text-gray-600">{product.rating}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-gray-600">Sales</p>
                    <p className="font-semibold text-gray-900">{formatNumber(product.sales)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Revenue</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(product.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Returns</p>
                    <p className="font-semibold text-red-600">{product.returns}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full" 
                    style={{ width: `${(product.revenue / topProducts[0].revenue) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Segments */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Customer Segments</h3>
              <p className="text-gray-600">Customer analysis by value and behavior</p>
            </div>
          </div>
          <div className="space-y-4">
            {customerSegments.map((segment, index) => (
              <div key={segment.segment} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{segment.segment}</h4>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    segment.retention > 80 ? 'bg-green-100 text-green-700' :
                    segment.retention > 60 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {segment.retention}% retention
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-gray-600">Customers</p>
                    <p className="font-semibold text-gray-900">{formatNumber(segment.customers)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Avg Order Value</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(segment.avgOrderValue)}</p>
                  </div>
                </div>
                <div className="mb-2">
                  <p className="text-gray-600 text-sm">Total Spent: <span className="font-semibold text-gray-900">{formatCurrency(segment.totalSpent)}</span></p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      segment.retention > 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                      segment.retention > 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                      'bg-gradient-to-r from-red-500 to-pink-500'
                    }`}
                    style={{ width: `${segment.retention}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Returns Analysis */}
      <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Returns Analysis</h3>
            <p className="text-gray-600">Return reasons, processing times, and refund amounts</p>
          </div>
          <button
            onClick={() => exportToCSV(returnsData, 'returns-analysis')}
            className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-200 text-sm font-medium"
          >
            Export Returns
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Returns by Reason */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {returnsData.map((returnItem, index) => (
                <div key={returnItem.reason} className="p-4 bg-gray-50/50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                        {index + 1}
                      </div>
                      <span className="font-semibold text-gray-900">{returnItem.reason}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-600">{returnItem.percentage}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-gray-600">Count</p>
                      <p className="font-semibold text-gray-900">{returnItem.count}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Refund Amount</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(returnItem.refundAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Avg Process Time</p>
                      <p className="font-semibold text-gray-900">{returnItem.avgProcessTime}d</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-red-500 to-pink-500 h-2 rounded-full" 
                      style={{ width: `${returnItem.percentage * 2.5}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Returns Summary */}
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200/50">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Returns Summary</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Returns</span>
                  <span className="text-2xl font-bold text-red-600">{returnsData.reduce((sum, item) => sum + item.count, 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Refunds</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCurrency(returnsData.reduce((sum, item) => sum + item.refundAmount, 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Avg Process Time</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {(returnsData.reduce((sum, item) => sum + item.avgProcessTime, 0) / returnsData.length).toFixed(1)}d
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Return Rate</span>
                  <span className="text-lg font-semibold text-red-600">2.8%</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h4>
              <div className="space-y-3">
                <button className="w-full text-left p-3 bg-white/60 rounded-xl hover:bg-white/80 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Package className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-gray-900">Process Pending Returns</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 ml-8">12 returns awaiting processing</p>
                </button>
                
                <button className="w-full text-left p-3 bg-white/60 rounded-xl hover:bg-white/80 transition-colors">
                  <div className="flex items-center space-x-3">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-gray-900">Issue Refunds</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 ml-8">8 refunds ready to process</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Channel Performance & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Channel Performance */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Channel Performance</h3>
              <p className="text-gray-600">Revenue and orders by sales channel</p>
            </div>
          </div>
          <div className="space-y-4">
            {channelPerformance.map((channel, index) => (
              <div key={channel.channel} className="p-4 bg-gray-50/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{channel.channel}</h4>
                  <span className="text-sm font-medium text-gray-600">{channel.percentage}%</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-gray-600">Orders</p>
                    <p className="font-semibold text-gray-900">{formatNumber(channel.orders)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Revenue</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(channel.revenue)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full" 
                    style={{ width: `${channel.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Trends */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Order Trends</h3>
              <p className="text-gray-600">Daily order volume over time</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueTrends || []}>
                <defs>
                  <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={0.05}/>
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
                  formatter={(value: number) => [formatNumber(value), 'Orders']}
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
                  stroke="#A855F7" 
                  strokeWidth={3}
                  fill="url(#orderGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
