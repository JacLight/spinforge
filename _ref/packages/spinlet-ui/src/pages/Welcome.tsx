import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { config } from '../config/environment';
import { 
  Rocket, 
  Server, 
  Package, 
  Activity,
  BarChart3,
  Settings,
  Upload,
  Database,
  Network,
  Shield,
  Cpu,
  HardDrive,
  Zap,
  Cloud,
  GitBranch,
  Terminal,
  Globe,
  AlertCircle,
  CheckCircle,
  LayoutDashboard
} from 'lucide-react';
import { motion } from 'framer-motion';

const systemComponents = [
  {
    title: 'SpinHub',
    description: 'Main routing and orchestration service',
    icon: Rocket,
    status: 'running',
    link: '/applications',
    metrics: { port: '9004', container: 'spinforge-hub' }
  },
  {
    title: 'KeyDB',
    description: 'High-performance Redis fork for data storage',
    icon: Database,
    status: 'running',
    link: null,
    metrics: { port: '9000', container: 'spinforge-keydb' }
  },
  {
    title: 'Nginx',
    description: 'Reverse proxy and SSL termination',
    icon: Network,
    status: 'running',
    link: null,
    metrics: { ports: '9006-9007', container: 'spinforge-nginx' }
  },
  {
    title: 'Builder Service',
    description: 'Handles app compilation and builds',
    icon: Package,
    status: 'running',
    link: null,
    metrics: { container: 'spinforge-builder' }
  },
  {
    title: 'Prometheus',
    description: 'Metrics collection and monitoring',
    icon: BarChart3,
    status: 'running',
    link: config.PROMETHEUS_URL,
    external: true,
    metrics: { port: '9008', container: 'spinforge-prometheus' }
  },
  {
    title: 'Grafana',
    description: 'Metrics visualization dashboard',
    icon: Activity,
    status: 'running',
    link: config.GRAFANA_URL,
    external: true,
    metrics: { port: '9009', container: 'spinforge-grafana' }
  }
];

const quickActions = [
  {
    title: 'Deploy New App',
    description: 'Deploy a new application to SpinForge',
    icon: Upload,
    link: '/deploy',
    color: 'bg-blue-500'
  },
  {
    title: 'View Applications',
    description: 'Manage your deployed applications',
    icon: Package,
    link: '/applications',
    color: 'bg-green-500'
  },
  {
    title: 'System Metrics',
    description: 'Monitor system performance',
    icon: BarChart3,
    link: '/metrics',
    color: 'bg-purple-500'
  },
  {
    title: 'Settings',
    description: 'Configure system settings',
    icon: Settings,
    link: '/settings',
    color: 'bg-orange-500'
  }
];

const features = [
  { icon: Cloud, label: 'Multi-tenant isolation' },
  { icon: Zap, label: 'Dynamic routing' },
  { icon: Shield, label: 'Rate limiting' },
  { icon: GitBranch, label: 'Multiple frameworks' },
  { icon: Terminal, label: 'CLI & API access' },
  { icon: Globe, label: 'Custom domains' }
];

export default function Welcome() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.metrics(),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Rocket className="h-16 w-16 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to SpinForge
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            A cloud-native platform for deploying and managing containerized applications
            with dynamic routing, multi-tenancy, and automatic scaling.
          </p>
        </div>

        {/* System Status Banner */}
        <div className="mb-8">
          <div className={`rounded-lg p-4 ${
            health?.status === 'healthy' ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {health?.status === 'healthy' ? (
                  <>
                    <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
                    <div>
                      <h3 className="text-lg font-semibold text-green-800">
                        System Healthy
                      </h3>
                      <p className="text-sm text-green-700">
                        All services are running normally
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-6 w-6 text-red-500 mr-3" />
                    <div>
                      <h3 className="text-lg font-semibold text-red-800">
                        System Issues Detected
                      </h3>
                      <p className="text-sm text-red-700">
                        Some services may be experiencing problems
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Version {health?.version || 'Unknown'}</p>
                <p className="text-xs text-gray-500">
                  {metrics?.activeSpinlets || 0} active spinlets
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Link
                    to={action.link}
                    className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
                  >
                    <div className={`inline-flex p-3 rounded-lg ${action.color} text-white mb-4`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {action.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {action.description}
                    </p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* System Components */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">System Components</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {systemComponents.map((component, index) => {
              const Icon = component.icon;
              return (
                <motion.div
                  key={component.title}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="bg-white rounded-lg shadow-md p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-gray-100 rounded-lg mr-3">
                        <Icon className="h-6 w-6 text-gray-700" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {component.title}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          {component.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {component.description}
                  </p>
                  <div className="text-xs text-gray-500 space-y-1">
                    {component.metrics.port && (
                      <div>Port: {component.metrics.port}</div>
                    )}
                    {component.metrics.ports && (
                      <div>Ports: {component.metrics.ports}</div>
                    )}
                    {component.metrics.container && (
                      <div>Container: {component.metrics.container}</div>
                    )}
                  </div>
                  {component.link && (
                    <div className="mt-4">
                      {component.external ? (
                        <a
                          href={component.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Open Dashboard →
                        </a>
                      ) : (
                        <Link
                          to={component.link}
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          View Details →
                        </Link>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Resource Usage */}
        <div className="mb-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Usage</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Cpu className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">CPU Usage</span>
                </div>
                <span className="text-sm font-medium">{metrics?.cpuUsage || 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <HardDrive className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">Memory Usage</span>
                </div>
                <span className="text-sm font-medium">{metrics?.memoryUsage || 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Server className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">Active Spinlets</span>
                </div>
                <span className="text-sm font-medium">
                  {metrics?.activeSpinlets || 0} / {metrics?.totalSpinlets || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Activity className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">Port Usage</span>
                </div>
                <span className="text-sm font-medium">
                  {metrics?.allocatedPorts || 0} / {(metrics?.allocatedPorts || 0) + (metrics?.availablePorts || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Features</h3>
            <div className="grid grid-cols-2 gap-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.label} className="flex items-center">
                    <Icon className="h-4 w-4 text-indigo-600 mr-2" />
                    <span className="text-sm text-gray-700">{feature.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Control Center Link */}
        <div className="mb-8 bg-gray-900 text-white rounded-lg p-6 text-center">
          <h3 className="text-xl font-bold mb-2">Advanced Control Center</h3>
          <p className="text-gray-300 mb-4">
            Access the windowed view manager for multi-tasking and advanced controls
          </p>
          <a
            href="/control-center"
            className="inline-flex items-center px-4 py-2 bg-white text-gray-900 font-medium rounded hover:bg-gray-100 transition-colors"
          >
            <Terminal className="h-5 w-5 mr-2" />
            Open Control Center
          </a>
        </div>

        {/* Getting Started */}
        <div className="bg-indigo-50 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-indigo-900 mb-4">
            Ready to deploy your first app?
          </h2>
          <p className="text-indigo-700 mb-6 max-w-2xl mx-auto">
            SpinForge makes it easy to deploy and manage containerized applications
            with automatic routing, scaling, and monitoring.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/deploy"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Upload className="h-5 w-5 mr-2" />
              Deploy Your First App
            </Link>
            <Link
              to="/system-dashboard"
              className="inline-flex items-center px-6 py-3 bg-white text-indigo-600 font-medium rounded-lg border border-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <LayoutDashboard className="h-5 w-5 mr-2" />
              View System Dashboard
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}