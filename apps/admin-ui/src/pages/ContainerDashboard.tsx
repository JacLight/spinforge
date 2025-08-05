/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import ContainerMonitor from '../components/ContainerMonitor';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface Site {
  domain: string;
  type: string;
  containerConfig?: any;
  containers?: any[];
  services?: { [key: string]: any };
  enabled: boolean;
  createdAt: string;
}

import { motion } from 'framer-motion';
import { Grid3X3, Package, Upload, LayoutDashboard, Globe } from 'lucide-react';

export default function ContainerDashboard() {
  const { domain } = useParams<{ domain: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSiteData();
  }, [domain]);

  const fetchSiteData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch site details
      const siteResponse = await fetch(`${API_BASE_URL}/api/sites/${domain}`);
      if (!siteResponse.ok) {
        throw new Error('Failed to fetch site details');
      }
      const siteData = await siteResponse.json();
      setSite(siteData);
      
      // Fetch container details
      const containersResponse = await fetch(`${API_BASE_URL}/api/sites/${domain}/containers`);
      if (!containersResponse.ok) {
        throw new Error('Failed to fetch container details');
      }
      const containersData = await containersResponse.json();
      
      // Transform container data for the monitor component
      const services = containersData.containers.map((container: any) => ({
        name: container.name,
        domain: container.domain,
        status: container.status,
        stats: container.stats ? {
          name: container.stats.Name,
          id: container.stats.ID,
          cpuPercent: container.stats.CPUPerc,
          memUsage: container.stats.MemUsage.split(' / ')[0],
          memPercent: container.stats.MemPerc,
          memLimit: container.stats.MemUsage.split(' / ')[1],
          netIO: container.stats.NetIO,
          blockIO: container.stats.BlockIO,
          pids: container.stats.PIDs
        } : undefined,
        health: container.health
      }));
      
      setContainers(services);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading container dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error loading container dashboard</h3>
                <p className="mt-1 text-sm text-red-700">{error || 'Site not found'}</p>
              </div>
            </div>
            <Link 
              to="/applications"
              className="mt-4 inline-flex items-center gap-2 text-sm text-red-700 hover:text-red-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Applications
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isContainerSite = site.type === 'container' || site.type === 'compose';

  if (!isContainerSite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="px-6 lg:px-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Not a container deployment</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  This site ({domain}) is a {site.type} deployment. Container monitoring is only available for Docker container deployments.
                </p>
              </div>
            </div>
            <Link 
              to="/applications"
              className="mt-4 inline-flex items-center gap-2 text-sm text-yellow-700 hover:text-yellow-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Applications
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Container className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Container Monitor
                  </h1>
                  <p className="text-sm text-gray-500">{domain}</p>
                </div>
              </div>
              
              {/* Enhanced Dashboard Navigation */}
              <div className="hidden lg:flex items-center space-x-2">
                {/* Primary Dashboard Tabs */}
                <div className="flex items-center space-x-1 bg-white/60 backdrop-blur-sm rounded-2xl p-1 border border-white/20 shadow-lg">
                  <Link
                    to="/"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden xl:inline">Dashboard</span>
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
                    to="/hosting"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <Globe className="w-4 h-4" />
                    <span className="hidden xl:inline">Hosting</span>
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                to="/applications"
                className="flex items-center space-x-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/80 transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Apps</span>
              </Link>
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
          className="space-y-8"
        >
          {/* Page Info */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {site.type === 'compose' ? 'Docker Compose' : 'Docker Container'} Deployment
                </h2>
                <p className="text-sm text-gray-600">
                  Created: {new Date(site.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`px-4 py-2 rounded-xl text-sm font-medium ${
                site.enabled 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' 
                  : 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg'
              }`}>
                {site.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Container Monitor */}
          <ContainerMonitor 
            domain={domain!}
            services={containers}
            onRefresh={fetchSiteData}
          />
        </motion.div>
      </div>
    </div>
  );
}