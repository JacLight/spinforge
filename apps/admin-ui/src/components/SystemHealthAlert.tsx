/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  message: string;
}

interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    api: HealthCheck;
    redis: HealthCheck;
    nginx: HealthCheck;
  };
  timestamp: string;
}

export default function SystemHealthAlert() {
  const [expanded, setExpanded] = React.useState(false);

  const { data: health, isLoading, error } = useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/health/system`);
      if (!response.ok) throw new Error('Health check failed');
      return response.json();
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: 1,
  });

  // Don't show if healthy
  if (!health && !error || (health && health.status === 'healthy')) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getAlertColor = () => {
    if (error || (health && health.status === 'unhealthy')) {
      return 'bg-red-50 border-red-200 text-red-800';
    }
    return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  };

  return (
    <>
      {/* Compact Alert Bar */}
      <div 
        className={`fixed top-0 left-0 right-0 ${getAlertColor()} border-b shadow-sm z-50 cursor-pointer transition-all`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm font-medium">
                {error ? 'System Health Check Failed - Some services may be unavailable' : 
                 health?.status === 'unhealthy' ? 'Critical System Issues Detected' : 
                 'System Performance Degraded'}
              </p>
              {health && !expanded && (
                <div className="flex items-center gap-4 ml-4">
                  {Object.entries(health.checks).map(([service, check]) => (
                    check.status !== 'healthy' && (
                      <div key={service} className="flex items-center gap-1">
                        {getStatusIcon(check.status)}
                        <span className="text-xs capitalize">{service}</span>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
              <span className="text-xs">Click for details</span>
              <svg 
                className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className={`fixed top-8 left-0 right-0 ${getAlertColor()} border-b shadow-lg z-40`}>
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h3 className="text-lg font-semibold mb-4">System Health Details</h3>
            
            {error ? (
              <div className="bg-white/50 rounded-lg p-4">
                <p className="text-sm">
                  The health monitoring system is unable to connect to the API. 
                  This typically indicates a critical system failure.
                </p>
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium">Possible causes:</p>
                  <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                    <li>API service is down or restarting</li>
                    <li>Network connectivity issues</li>
                    <li>Configuration problems</li>
                  </ul>
                </div>
              </div>
            ) : health && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(health.checks).map(([service, check]) => (
                    <div key={service} className="bg-white/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium capitalize text-base">{service} Service</h4>
                        {getStatusIcon(check.status)}
                      </div>
                      <p className="text-sm">{check.message}</p>
                      <div className={`mt-2 text-xs font-medium ${
                        check.status === 'healthy' ? 'text-green-700' :
                        check.status === 'unhealthy' ? 'text-red-700' : 'text-yellow-700'
                      }`}>
                        Status: {check.status.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm">
                    <p className="font-medium">What does this mean?</p>
                    <p className="text-xs mt-1">
                      {health.status === 'unhealthy' 
                        ? 'Critical services are down. Most functionality will be unavailable until resolved.'
                        : 'Some services are experiencing issues. You may encounter errors or slow performance.'}
                    </p>
                  </div>
                  <div className="text-xs text-right">
                    <p>Last updated: {new Date(health.timestamp).toLocaleTimeString()}</p>
                    <p className="mt-1">Next check in: {isLoading ? 'Checking...' : '30 seconds'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
    </>
  );
}