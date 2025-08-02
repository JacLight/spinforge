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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading container dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error loading container dashboard</h3>
                <p className="mt-1 text-sm text-red-700">{error || 'Site not found'}</p>
              </div>
            </div>
            <Link 
              to="/dashboard/applications"
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
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
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
              to="/dashboard/applications"
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <Link 
              to="/dashboard/applications"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Applications
            </Link>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Container className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{domain}</h1>
                  <p className="text-sm text-gray-600">
                    {site.type === 'compose' ? 'Docker Compose' : 'Docker Container'} Deployment
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Created: {new Date(site.createdAt).toLocaleDateString()}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  site.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {site.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Container Monitor */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ContainerMonitor 
          domain={domain!}
          services={containers}
          onRefresh={fetchSiteData}
        />
      </div>
    </div>
  );
}