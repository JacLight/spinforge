/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import axios from 'axios';

// Dynamically determine API URL based on current location
const getApiBaseUrl = () => {
  // Use environment variable if set
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // In development, always use localhost:8080 for API
  if (import.meta.env.DEV || window.location.port === '8083') {
    return 'http://localhost:8080';
  }
  
  // In production, API might be on same origin
  return window.origin;
};

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface VHost {
  id: string; // kept for backward compatibility
  domain: string; // now required as primary key
  aliases?: string[];
  actual_domain?: string;
  files_exist?: boolean;
  type: 'static' | 'proxy' | 'container' | 'loadbalancer' | 'compose';
  target?: string;
  static_path?: string;
  host_static_path?: string;
  enabled?: boolean;
  customerId?: string;
  headers?: Record<string, string>;
  rateLimit?: {
    requests: number;
    per: string;
  };
  cookieRouting?: Array<{
    name: string;
    cookie: string;
    target: string;
  }>;
  backends?: string[]; // Simple backend URLs (deprecated, use backendConfigs)
  backendConfigs?: Array<{
    url: string;
    isLocal?: boolean;  // True if this is a local SpinForge service
    label?: string;     // Label for routing rules (e.g., "variant-a", "beta", "v2")
    enabled?: boolean;  // Whether this backend is active (default: true)
    healthCheck?: {
      path: string;       // Health check endpoint path
      interval: number;   // Check interval in seconds
      timeout: number;    // Request timeout in seconds
      unhealthyThreshold: number; // Number of failures before marking as unhealthy
      healthyThreshold: number;   // Number of successes before marking as healthy
    };
  }>;
  routingRules?: Array<{
    type: 'cookie' | 'query' | 'header';  // Rule type
    name: string;                         // Cookie/query param/header name
    matchType: 'exact' | 'regex' | 'prefix'; // How to match the value
    value: string;                        // Value to match
    targetLabel: string;                  // Backend label to route to
    priority?: number;                    // Rule priority (higher = evaluated first)
  }>;
  stickySessionDuration?: number;         // Duration in seconds (default: 3600 = 1 hour)
  upstreams?: Array<{
    url: string;
    weight?: number;
  }>;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  // Container-specific fields
  containerConfig?: {
    image: string;
    port: number;
    env?: Record<string, string> | Array<{ key: string; value: string }>; // Support both formats
    restartPolicy?: string;
    volumes?: Array<{ source: string; target: string }>;
    networks?: string[];
    command?: string[];
  };
  composeConfig?: string; // Docker Compose YAML
}

export interface HostingStats {
  total_sites: number;
  static_sites: number;
  proxy_sites: number;
  container_sites: number;
  loadbalancer_sites: number;
}

export interface GlobalMetrics {
  totalRequests: number;
  totalBandwidth: number;
  avgResponseTime: number;
  topRoutes: Array<{
    domain: string;
    requests: number;
    bandwidth: number;
    avgResponseTime: number;
    errorRate: number;
  }>;
  requestsByStatus: Record<string, number>;
  requestsByType: Record<string, number>;
}

export interface VHostSearchParams {
  search?: string;
  customer?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface VHostSearchResponse {
  data: VHost[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface VHostMetrics {
  id: string;
  timeRange: string;
  lastAccessed: string | null;
  totalRequests: number;
  totalBandwidth: number;
  uniqueVisitors: number;
  metrics: {
    requests: number;
    avgResponseTime: number;
    statusCodes: Record<string, number>;
    bandwidth: number;
    errorRate: number;
  };
  recentLogs: Array<{
    timestamp: number;
    method: string;
    path: string;
    status: number;
    bytes: number;
    responseTime: number;
    ip: string;
    userAgent?: string;
    referer?: string;
  }>;
}

export interface LogsResponse {
  logs: Array<{
    timestamp: number;
    method: string;
    path: string;
    status: number;
    bytes: number;
    responseTime: number;
    ip: string;
    userAgent?: string;
    referer?: string;
  }>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export const hostingAPI = {
  // List all virtual hosts with search
  async listVHosts(params?: VHostSearchParams): Promise<VHost[]> {
    const response = await apiClient.get('/api/sites', { params });
    // Handle both old format (array) and new format (object with data property)
    return Array.isArray(response.data) ? response.data : response.data.data;
  },
  
  // Search virtual hosts with pagination
  async searchVHosts(params: VHostSearchParams): Promise<VHostSearchResponse> {
    const response = await apiClient.get('/api/sites', { params });
    // If old format, convert to new format
    if (Array.isArray(response.data)) {
      return {
        data: response.data,
        total: response.data.length,
        limit: response.data.length,
        offset: 0,
        hasMore: false
      };
    }
    return response.data;
  },

  // Get specific virtual host by domain
  async getVHost(domainOrId: string): Promise<VHost> {
    // Try to get by domain first, fall back to id for backward compatibility
    const domain = domainOrId;
    const response = await apiClient.get(`/api/sites/${domain}`);
    return response.data;
  },

  // Create virtual host
  async createVHost(vhost: VHost): Promise<{ message: string }> {
    const response = await apiClient.post('/api/sites', vhost);
    return response.data;
  },

  // Update virtual host
  async updateVHost(domainOrId: string, vhost: Partial<VHost>): Promise<{ message: string }> {
    // Use domain if available, otherwise use id
    const domain = vhost.domain || domainOrId;
    const response = await apiClient.put(`/api/sites/${domain}`, vhost);
    return response.data;
  },

  // Delete virtual host
  async deleteVHost(domainOrId: string): Promise<{ message: string }> {
    const domain = domainOrId;
    const response = await apiClient.delete(`/api/sites/${domain}`);
    return response.data;
  },

  // Get hosting statistics
  async getStats(): Promise<HostingStats> {
    const vhosts = await this.listVHosts();
    const stats: HostingStats = {
      total_sites: vhosts.length,
      static_sites: vhosts.filter((v: VHost) => v.type === 'static').length,
      proxy_sites: vhosts.filter((v: VHost) => v.type === 'proxy').length,
      container_sites: vhosts.filter((v: VHost) => v.type === 'container').length,
      loadbalancer_sites: vhosts.filter((v: VHost) => v.type === 'loadbalancer').length,
    };
    return stats;
  },

  // Get metrics for a specific vhost
  async getVHostMetrics(domainOrId: string, timeRange?: string): Promise<VHostMetrics> {
    const domain = domainOrId;
    const response = await apiClient.get(`/_metrics/sites/${domain}/metrics`, {
      params: { range: timeRange }
    });
    return response.data;
  },

  // Get logs for a specific vhost
  async getVHostLogs(domainOrId: string, params?: {
    limit?: number;
    offset?: number;
    status?: string;
    search?: string;
  }): Promise<LogsResponse> {
    const domain = domainOrId;
    const response = await apiClient.get(`/api/sites/${domain}/logs`, { params });
    return response.data;
  },

  // Upload zip file for static site
  async uploadStaticSiteZip(domain: string, formData: FormData): Promise<any> {
    const response = await apiClient.post(`/api/sites/${domain}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get global metrics across all sites
  async getGlobalMetrics(timeRange?: string): Promise<GlobalMetrics> {
    try {
      const response = await apiClient.get('/api/metrics/global', {
        params: { range: timeRange }
      });
      return response.data;
    } catch (error) {
      // If endpoint doesn't exist yet, calculate from individual metrics
      const vhosts = await this.listVHosts();
      const metrics: GlobalMetrics = {
        totalRequests: 0,
        totalBandwidth: 0,
        avgResponseTime: 0,
        topRoutes: [],
        requestsByStatus: {},
        requestsByType: {}
      };

      // Aggregate metrics from all vhosts
      const routeMetrics = [];
      let totalResponseTime = 0;
      let responseTimeCount = 0;

      for (const vhost of vhosts) {
        try {
          const vhostMetrics = await this.getVHostMetrics(vhost.domain, timeRange);
          metrics.totalRequests += vhostMetrics.totalRequests;
          metrics.totalBandwidth += vhostMetrics.totalBandwidth;
          
          if (vhostMetrics.metrics.avgResponseTime > 0) {
            totalResponseTime += vhostMetrics.metrics.avgResponseTime * vhostMetrics.metrics.requests;
            responseTimeCount += vhostMetrics.metrics.requests;
          }

          // Add to top routes
          routeMetrics.push({
            domain: vhost.domain,
            requests: vhostMetrics.metrics.requests,
            bandwidth: vhostMetrics.metrics.bandwidth,
            avgResponseTime: vhostMetrics.metrics.avgResponseTime,
            errorRate: vhostMetrics.metrics.errorRate
          });

          // Aggregate status codes
          for (const [status, count] of Object.entries(vhostMetrics.metrics.statusCodes || {})) {
            metrics.requestsByStatus[status] = (metrics.requestsByStatus[status] || 0) + (count as number);
          }

          // Count by type
          const type = vhost.type;
          metrics.requestsByType[type] = (metrics.requestsByType[type] || 0) + vhostMetrics.metrics.requests;
        } catch (err) {
          // Skip if metrics not available for this vhost
        }
      }

      // Calculate average response time
      metrics.avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

      // Sort and get top 10 routes
      metrics.topRoutes = routeMetrics
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 10);

      return metrics;
    }
  },

  // Container-specific methods
  async getAllContainerStats(): Promise<any[]> {
    try {
      const response = await apiClient.get('/api/containers/stats');
      return response.data || [];
    } catch (error) {
      console.error('Failed to get all container stats:', error);
      return [];
    }
  },

  async getContainerStats(domain: string): Promise<any> {
    try {
      const response = await apiClient.get(`/api/sites/${domain}/container/stats`);
      return response.data;
    } catch (error) {
      console.error('Failed to get container stats:', error);
      return null;
    }
  },

  async getContainerInfo(domain: string): Promise<any> {
    try {
      const response = await apiClient.get(`/api/sites/${domain}/container/info`);
      return response.data;
    } catch (error) {
      console.error('Failed to get container info:', error);
      return null;
    }
  },

  async execInContainer(domain: string, command: string): Promise<any> {
    try {
      const response = await apiClient.post(`/api/sites/${domain}/container/exec`, { command });
      return response.data;
    } catch (error) {
      console.error('Failed to exec in container:', error);
      throw error;
    }
  },

  async getContainerFiles(domain: string, path: string = '/'): Promise<any> {
    try {
      const response = await apiClient.get(`/api/sites/${domain}/container/files`, { 
        params: { path }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get container files:', error);
      return [];
    }
  },

  async getContainerLogs(domain: string, params?: {
    tail?: number;
    since?: string;
    follow?: boolean;
  }): Promise<string> {
    try {
      const response = await apiClient.get(`/api/sites/${domain}/container/logs`, { 
        params,
        // Use text response type for logs
        responseType: 'text'
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get container logs:', error);
      return 'Failed to fetch logs';
    }
  }
};