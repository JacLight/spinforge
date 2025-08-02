import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

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
  type: 'static' | 'proxy' | 'container' | 'loadbalancer';
  target?: string;
  static_path?: string;
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
}

export interface HostingStats {
  total_sites: number;
  static_sites: number;
  proxy_sites: number;
  container_sites: number;
  loadbalancer_sites: number;
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
    const response = await apiClient.get(`/api/sites/${domain}/metrics`, {
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
  }
};