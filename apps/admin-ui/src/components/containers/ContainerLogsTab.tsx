/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { hostingAPI } from '../../services/hosting-api';
import { SpinForgeContainer } from './ContainerSlideoutPanel';

interface ContainerLogsTabProps {
  container: SpinForgeContainer;
}

export function ContainerLogsTab({ container }: ContainerLogsTabProps) {
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const logsData = await hostingAPI.getContainerLogs(container.domain, { tail: 1000 });
      setLogs(logsData);
    } catch (error) {
      setLogs('Failed to fetch logs: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [container.domain]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, container.domain]);

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Auto-refresh (5s)</span>
            </label>
          </div>
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Logs Display */}
      <div className="flex-1 bg-black text-green-400 font-mono text-sm p-4 overflow-y-auto">
        <pre className="whitespace-pre-wrap">
          {logs || 'Loading logs...'}
        </pre>
      </div>
    </div>
  );
}