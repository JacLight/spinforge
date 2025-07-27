import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { config } from '../config/environment';
import { 
  Activity, 
  Package, 
  Server, 
  HardDrive,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

export default function Dashboard() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.metrics(),
  });

  const cards = [
    {
      title: 'Active Spinlets',
      value: metrics?.activeSpinlets || 0,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Total Spinlets',
      value: metrics?.totalSpinlets || 0,
      icon: Server,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Allocated Ports',
      value: metrics?.allocatedPorts || 0,
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Available Ports',
      value: metrics?.availablePorts || 0,
      icon: HardDrive,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div>
      <div className="px-4 sm:px-0">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Overview of your SpinForge deployment
        </p>
      </div>

      <div className="mt-6">
        <div className="rounded-lg bg-white shadow px-5 py-4">
          <div className="flex items-center">
            {health?.status === 'healthy' ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm font-medium text-green-800">
                  System Healthy
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm font-medium text-red-800">
                  System Unhealthy
                </span>
              </>
            )}
            <span className="ml-auto text-xs text-gray-500">
              Version: {health?.version || 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="relative overflow-hidden rounded-lg bg-white px-4 pt-5 pb-12 shadow sm:px-6 sm:pt-6"
            >
              <dt>
                <div className={`absolute rounded-md ${card.bgColor} p-3`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
                <p className="ml-16 truncate text-sm font-medium text-gray-500">
                  {card.title}
                </p>
              </dt>
              <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
                <p className="text-2xl font-semibold text-gray-900">
                  {card.value}
                </p>
              </dd>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900">System Resources</h3>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Memory Usage</span>
                <span className="font-medium">{metrics?.memoryUsage || 0}%</span>
              </div>
              <div className="mt-1 relative bg-gray-200 rounded-full h-2">
                <div
                  className="absolute bg-blue-500 rounded-full h-2"
                  style={{ width: `${metrics?.memoryUsage || 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">CPU Usage</span>
                <span className="font-medium">{metrics?.cpuUsage || 0}%</span>
              </div>
              <div className="mt-1 relative bg-gray-200 rounded-full h-2">
                <div
                  className="absolute bg-green-500 rounded-full h-2"
                  style={{ width: `${metrics?.cpuUsage || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          <div className="mt-4 space-y-2">
            <a
              href="/deploy"
              className="block px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
            >
              Deploy New Application
            </a>
            <a
              href="/applications"
              className="block px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100"
            >
              View All Applications
            </a>
            <a
              href={config.GRAFANA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100"
            >
              Open Grafana Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}