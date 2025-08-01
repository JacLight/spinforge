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
  subdomain: string;
  domain?: string;
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

export const hostingAPI = {
  // List all virtual hosts with search
  async listVHosts(params?: VHostSearchParams): Promise<VHost[]> {
    const response = await apiClient.get('/api/vhost', { params });
    // Handle both old format (array) and new format (object with data property)
    return Array.isArray(response.data) ? response.data : response.data.data;
  },
  
  // Search virtual hosts with pagination
  async searchVHosts(params: VHostSearchParams): Promise<VHostSearchResponse> {
    const response = await apiClient.get('/api/vhost', { params });
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

  // Get specific virtual host
  async getVHost(subdomain: string): Promise<VHost> {
    const response = await apiClient.get(`/api/vhost/${subdomain}`);
    return response.data;
  },

  // Create virtual host
  async createVHost(vhost: VHost): Promise<{ message: string }> {
    const response = await apiClient.post('/api/vhost', vhost);
    return response.data;
  },

  // Update virtual host
  async updateVHost(subdomain: string, vhost: Partial<VHost>): Promise<{ message: string }> {
    const response = await apiClient.put(`/api/vhost/${subdomain}`, vhost);
    return response.data;
  },

  // Delete virtual host
  async deleteVHost(subdomain: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/vhost/${subdomain}`);
    return response.data;
  },

  // Get hosting statistics
  async getStats(): Promise<HostingStats> {
    const vhosts = await this.listVHosts();
    const stats: HostingStats = {
      total_sites: vhosts.length,
      static_sites: vhosts.filter(v => v.type === 'static').length,
      proxy_sites: vhosts.filter(v => v.type === 'proxy').length,
      container_sites: vhosts.filter(v => v.type === 'container').length,
      loadbalancer_sites: vhosts.filter(v => v.type === 'loadbalancer').length,
    };
    return stats;
  }
};