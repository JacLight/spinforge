import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { BarChart3, ExternalLink } from 'lucide-react';

export default function Metrics() {
  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.metrics(),
    refetchInterval: 5000,
  });

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Metrics</h1>
          <p className="mt-2 text-sm text-gray-700">
            Real-time system metrics and resource usage
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <a
            href="http://localhost:9009"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Grafana
          </a>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Spinlets
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {metrics?.activeSpinlets || 0} / {metrics?.totalSpinlets || 0}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Port Usage
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {metrics?.allocatedPorts || 0} / {(metrics?.allocatedPorts || 0) + (metrics?.availablePorts || 0)}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    System Load
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {((metrics?.cpuUsage || 0) + (metrics?.memoryUsage || 0)) / 2}%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Resource Usage
          </h3>
          <div className="mt-5">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Memory</span>
                  <span className="text-sm font-medium text-gray-900">{metrics?.memoryUsage || 0}%</span>
                </div>
                <div className="mt-1 relative">
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                    <div
                      style={{ width: `${metrics?.memoryUsage || 0}%` }}
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">CPU</span>
                  <span className="text-sm font-medium text-gray-900">{metrics?.cpuUsage || 0}%</span>
                </div>
                <div className="mt-1 relative">
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                    <div
                      style={{ width: `${metrics?.cpuUsage || 0}%` }}
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Port Allocation</span>
                  <span className="text-sm font-medium text-gray-900">
                    {metrics?.allocatedPorts || 0} used
                  </span>
                </div>
                <div className="mt-1 relative">
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                    <div
                      style={{ 
                        width: `${((metrics?.allocatedPorts || 0) / ((metrics?.allocatedPorts || 0) + (metrics?.availablePorts || 1))) * 100}%` 
                      }}
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-2">Advanced Monitoring</h3>
        <p className="text-sm text-blue-800 mb-4">
          For detailed metrics, alerts, and historical data, use the Grafana dashboard.
        </p>
        <a
          href="http://localhost:9009"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          View in Grafana
          <ExternalLink className="ml-1 h-4 w-4" />
        </a>
      </div>
    </div>
  );
}