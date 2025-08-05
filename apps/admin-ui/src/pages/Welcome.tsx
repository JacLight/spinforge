/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
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
  LayoutDashboard,
  Grid3X3,
  RefreshCw,
  TrendingUp,
  ArrowRight,
  Play
} from 'lucide-react';
import { motion } from 'framer-motion';

const systemComponents = [
  {
    title: 'KeyDB',
    description: 'High-performance Redis fork for hosting data',
    icon: Database,
    status: 'running',
    link: null,
    metrics: { port: '16378', container: 'spinforge-keydb' }
  },
  {
    title: 'OpenResty',
    description: 'Dynamic web server with Lua routing',
    icon: Network,
    status: 'running',
    link: null,
    metrics: { ports: '80/443', container: 'spinforge-openresty' }
  },
  {
    title: 'API Server',
    description: 'REST API for hosting management',
    icon: Server,
    status: 'running',
    link: null,
    metrics: { port: '8080', container: 'spinforge-api' }
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
  { icon: Cloud, label: 'Static site hosting' },
  { icon: Zap, label: 'Instant deployments' },
  { icon: Shield, label: 'SSL/TLS certificates' },
  { icon: GitBranch, label: 'Multiple site types' },
  { icon: Terminal, label: 'REST API access' },
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Grid3X3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Analytics Command Center
                  </h1>
                  <p className="text-sm text-gray-500">Real-time business intelligence</p>
                </div>
              </div>
              
              {/* Enhanced Dashboard Navigation */}
              <div className="hidden lg:flex items-center space-x-2">
                {/* Primary Dashboard Tabs */}
                <div className="flex items-center space-x-1 bg-white/60 backdrop-blur-sm rounded-2xl p-1 border border-white/20 shadow-lg">
                  <Link
                    to="/"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-lg"></div>
                    <LayoutDashboard className="w-4 h-4 relative z-10" />
                    <span className="hidden xl:inline relative z-10">Dashboard</span>
                  </Link>
                  <Link
                    to="/applications"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <Package className="w-4 h-4" />
                    <span className="hidden xl:inline">Apps</span>
                  </Link>
                  <Link
                    to="/deploy"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="hidden xl:inline">Deploy</span>
                  </Link>
                  <Link
                    to="/system-dashboard"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden xl:inline">Metrics</span>
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    health?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm font-medium text-gray-700">
                    {health?.status === 'healthy' ? 'Live' : 'Issues'}
                  </span>
                </div>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="text-sm text-gray-600">
                  v{health?.version || '1.0.0'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Content */}
      <div className="px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Hosted Sites</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {metrics?.activeSites || 0}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600 font-medium">Live</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Globe className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">CPU Usage</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {metrics?.cpuUsage || 0}%
                  </p>
                  <div className="flex items-center mt-2">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      (metrics?.cpuUsage || 0) < 70 ? 'bg-green-500' : 'bg-orange-500'
                    }`}></div>
                    <span className="text-sm text-gray-600">Optimal</span>
                  </div>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <Cpu className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Memory</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {metrics?.memoryUsage || 0}%
                  </p>
                  <div className="flex items-center mt-2">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      (metrics?.memoryUsage || 0) < 80 ? 'bg-green-500' : 'bg-orange-500'
                    }`}></div>
                    <span className="text-sm text-gray-600">Available</span>
                  </div>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <HardDrive className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Ports</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {metrics?.allocatedPorts || 0}
                  </p>
                  <div className="flex items-center mt-2">
                    <Activity className="w-4 h-4 text-blue-500 mr-1" />
                    <span className="text-sm text-blue-600 font-medium">Running</span>
                  </div>
                </div>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Network className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Quick Actions
                </h2>
                <p className="text-gray-600 mt-2">Get started with these common tasks</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
                  >
                    <Link
                      to={action.link}
                      className="group block p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                    >
                      <div className={`inline-flex p-4 rounded-xl ${action.color} text-white mb-4 group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {action.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {action.description}
                      </p>
                      <div className="flex items-center text-blue-600 group-hover:text-blue-700 font-medium text-sm">
                        <span>Get started</span>
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* System Components */}
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  System Architecture
                </h2>
                <p className="text-gray-600 mt-2">Core infrastructure components</p>
              </div>
              <button className="flex items-center space-x-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/80 transition-all duration-200">
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Status</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {systemComponents.map((component, index) => {
                const Icon = component.icon;
                return (
                  <motion.div
                    key={component.title}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 1.3 + index * 0.1 }}
                    className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl mr-4">
                          <Icon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">
                            {component.title}
                          </h3>
                          <div className="flex items-center mt-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                            <span className="text-sm font-medium text-green-600">
                              {component.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                      {component.description}
                    </p>
                    <div className="bg-gray-50/50 rounded-xl p-3 space-y-2">
                      {component.metrics.port && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Port:</span>
                          <span className="font-mono text-gray-900">{component.metrics.port}</span>
                        </div>
                      )}
                      {component.metrics.ports && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Ports:</span>
                          <span className="font-mono text-gray-900">{component.metrics.ports}</span>
                        </div>
                      )}
                      {component.metrics.container && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Container:</span>
                          <span className="font-mono text-gray-900">{component.metrics.container}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Platform Features & Getting Started */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-8"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.6 }}
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Platform Features</h3>
              <div className="grid grid-cols-1 gap-4">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <motion.div 
                      key={feature.label} 
                      className="flex items-center p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 1.7 + index * 0.1 }}
                    >
                      <div className="p-2 bg-white rounded-lg mr-3 shadow-sm">
                        <Icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{feature.label}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div 
              className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.8 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/80 to-purple-600/80"></div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-4">Ready to Deploy?</h3>
                <p className="text-blue-100 mb-6 leading-relaxed">
                  Get your first application live in minutes with our streamlined deployment process. 
                  SpinForge handles SSL, routing, and scaling automatically.
                </p>
                <div className="space-y-3">
                  <Link
                    to="/deploy"
                    className="flex items-center justify-between w-full px-6 py-4 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all duration-200 group"
                  >
                    <div className="flex items-center">
                      <Upload className="h-5 w-5 mr-3" />
                      <span className="font-medium">Deploy Your First App</span>
                    </div>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to="/applications"
                    className="flex items-center justify-between w-full px-6 py-4 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all duration-200 group"
                  >
                    <div className="flex items-center">
                      <LayoutDashboard className="h-5 w-5 mr-3" />
                      <span className="font-medium">View System Dashboard</span>
                    </div>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            </motion.div>
          </div>

          {/* Advanced Control Center */}
          <motion.div 
            className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl shadow-xl p-8 text-center relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 2.0 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 to-gray-800/90"></div>
            <div className="relative z-10">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                  <Terminal className="h-8 w-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Advanced Control Center</h3>
              <p className="text-gray-300 mb-6 max-w-lg mx-auto leading-relaxed">
                Access the windowed view manager for multi-tasking, advanced system controls, 
                and real-time monitoring capabilities.
              </p>
              <a
                href="/control-center"
                className="inline-flex items-center px-8 py-4 bg-white text-gray-900 font-medium rounded-xl hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl group"
              >
                <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                Launch Control Center
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}