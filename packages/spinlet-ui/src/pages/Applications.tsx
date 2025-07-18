import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Route } from '../services/api';
import { toast } from 'sonner';
import { 
  Globe, 
  Package, 
  Trash2, 
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Play,
  Pause,
  RotateCw,
  Settings,
  Activity,
  Server,
  Plus
} from 'lucide-react';

export default function Applications() {
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');

  const { data: routes = [], isLoading, error } = useQuery({
    queryKey: ['routes', selectedCustomer],
    queryFn: () => 
      selectedCustomer === 'all' 
        ? api.getAllRoutes() 
        : api.getCustomerRoutes(selectedCustomer),
  });

  const deleteMutation = useMutation({
    mutationFn: (domain: string) => api.deleteRoute(domain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Application deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete application: ${error.message}`);
    },
  });

  const customers = Array.from(new Set(routes.map(r => r.customerId)));

  const handleRestart = (domain: string) => {
    toast.success(`Restarting ${domain}...`);
    // TODO: Implement restart functionality
  };

  const handleStop = (domain: string) => {
    toast.success(`Stopping ${domain}...`);
    // TODO: Implement stop functionality
  };

  const handleStart = (domain: string) => {
    toast.success(`Starting ${domain}...`);
    // TODO: Implement start functionality
  };

  const handleViewLogs = (domain: string) => {
    toast.info(`Opening logs for ${domain}...`);
    // TODO: Implement logs viewer
  };

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading applications</h3>
            <p className="mt-2 text-sm text-red-700">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Application Management</h1>
            <p className="mt-2 text-sm text-gray-600">
              Monitor and manage all deployed applications in your SpinForge cluster
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <a
              href="/deploy"
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg shadow-sm hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              Deploy New App
            </a>
          </div>
        </div>

        {/* Filter */}
        <div className="mt-6 max-w-xs">
          <label htmlFor="customer" className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Customer
          </label>
          <select
            id="customer"
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">All Customers</option>
            {customers.map((customer) => (
              <option key={customer} value={customer}>
                {customer}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Applications List */}
      <div className="bg-white shadow-sm rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center p-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No applications deployed</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
              Get started by deploying your first application to SpinForge.
            </p>
            <div className="mt-6">
              <a
                href="/deploy"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="h-5 w-5 mr-2" />
                Deploy First App
              </a>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Application
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resources
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {routes.map((route: Route) => (
                  <tr key={route.domain} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <Globe className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{route.domain}</div>
                          <div className="text-xs text-gray-500">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {route.framework}
                            </span>
                            <span className="ml-2 text-gray-400">{route.spinletId}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{route.customerId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="ml-2 text-sm text-gray-600">Running</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Server className="h-4 w-4 mr-1" />
                          <span>{route.config?.memory || '512MB'}</span>
                        </div>
                        <div className="flex items-center">
                          <Activity className="h-4 w-4 mr-1" />
                          <span>{route.config?.cpu || '0.5'} CPU</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {/* View App Button */}
                        <a
                          href={`http://${route.domain}:9006`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View Application"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>

                        {/* Restart Button */}
                        <button
                          onClick={() => handleRestart(route.domain)}
                          className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                          title="Restart Application"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>

                        {/* Stop/Start Button */}
                        <button
                          onClick={() => handleStop(route.domain)}
                          className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all"
                          title="Stop Application"
                        >
                          <Pause className="h-4 w-4" />
                        </button>

                        {/* Settings Button */}
                        <button
                          onClick={() => toast.info('Settings coming soon!')}
                          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                          title="Application Settings"
                        >
                          <Settings className="h-4 w-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete ${route.domain}?`)) {
                              deleteMutation.mutate(route.domain);
                            }
                          }}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Application"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {routes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Package className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Apps</p>
                <p className="text-2xl font-semibold text-gray-900">{routes.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-semibold text-gray-900">{routes.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Server className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Customers</p>
                <p className="text-2xl font-semibold text-gray-900">{customers.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}