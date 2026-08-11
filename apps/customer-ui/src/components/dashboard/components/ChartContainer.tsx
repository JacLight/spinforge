/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState } from 'react';
import { MoreHorizontal, Download, Maximize2, RefreshCw } from 'lucide-react';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  onExport?: () => void;
  onRefresh?: () => void;
  onFullscreen?: () => void;
  isLoading?: boolean;
  height?: number | string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  children,
  className = '',
  onExport,
  onRefresh,
  onFullscreen,
  isLoading = false,
  height = 400
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleMenuToggle = () => {
    setShowMenu(!showMenu);
  };

  const handleMenuAction = (action: () => void) => {
    action();
    setShowMenu(false);
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
        
        {(onExport || onRefresh || onFullscreen) && (
          <div className="relative">
            <button
              onClick={handleMenuToggle}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="py-1">
                  {onRefresh && (
                    <button
                      onClick={() => handleMenuAction(onRefresh)}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <RefreshCw className="w-4 h-4 mr-3" />
                      Refresh Data
                    </button>
                  )}
                  {onExport && (
                    <button
                      onClick={() => handleMenuAction(onExport)}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Download className="w-4 h-4 mr-3" />
                      Export Data
                    </button>
                  )}
                  {onFullscreen && (
                    <button
                      onClick={() => handleMenuAction(onFullscreen)}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Maximize2 className="w-4 h-4 mr-3" />
                      Fullscreen
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div 
            className="flex items-center justify-center"
            style={{ height: typeof height === 'number' ? `${height}px` : height }}
          >
            <div className="flex items-center space-x-2 text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        ) : (
          <div style={{ height: typeof height === 'number' ? `${height}px` : height }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
