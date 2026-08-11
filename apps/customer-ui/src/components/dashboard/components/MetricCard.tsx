/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { MetricCard as MetricCardType } from '../types';
import { formatNumber, formatCurrency, formatPercentage } from '../utils';

interface MetricCardProps {
  metric: MetricCardType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
  metric, 
  className = '', 
  size = 'md' 
}) => {
  const formatValue = (value: string | number) => {
    if (typeof value === 'string') return value;
    
    // Auto-detect format based on value
    if (value > 1000000) {
      return formatNumber(value / 1000000, { maximumFractionDigits: 1 }) + 'M';
    } else if (value > 1000) {
      return formatNumber(value / 1000, { maximumFractionDigits: 1 }) + 'K';
    }
    return formatNumber(value);
  };

  const getTrendIcon = () => {
    switch (metric.changeType) {
      case 'increase':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decrease':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    switch (metric.changeType) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const titleSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const valueSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${sizeClasses[size]} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className={`text-gray-600 font-medium ${titleSizeClasses[size]}`}>
            {metric.title}
          </p>
          <p className={`font-bold text-gray-900 mt-2 ${valueSizeClasses[size]}`}>
            {formatValue(metric.value)}
          </p>
        </div>
        {metric.icon && (
          <div className="ml-4 p-3 bg-gray-50 rounded-lg">
            <div className="w-6 h-6 text-gray-600">
              {/* Icon would be rendered here based on metric.icon string */}
            </div>
          </div>
        )}
      </div>
      
      {metric.change !== 0 && (
        <div className="flex items-center mt-4 pt-4 border-t border-gray-100">
          {getTrendIcon()}
          <span className={`ml-2 text-sm font-medium ${getTrendColor()}`}>
            {Math.abs(metric.change) > 0 && (
              <>
                {formatPercentage(Math.abs(metric.change))}
                <span className="text-gray-500 ml-1">vs last period</span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
};
