/**
 * Customer API Service - Customer-specific endpoints
 * All requests are automatically filtered by customer ID
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Get auth headers from cookies/localStorage
function getAuthHeaders() {
  const token = localStorage.getItem('auth-token') || '';
  const customerId = localStorage.getItem('customer-id') || '';
  
  return {
    'Authorization': `Bearer ${token}`,
    'X-Customer-ID': customerId,
    'X-Auth-Token': token,
  };
}

export interface VHost {
  domain: string;
  type: 'static' | 'proxy' | 'container' | 'loadbalancer';
  enabled: boolean;
  customerId?: string;
  aliases?: string[];
  ssl_enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  index_file?: string;
  error_file?: string;
  target?: string;
  preserve_host?: boolean;
  websocket_support?: boolean;
  containerConfig?: any;
  composeConfig?: string;
  pending_upload?: boolean;
}

export interface SearchParams {
  search?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export const customerAPI = {
  // List customer's vhosts
  async listVHosts(): Promise<VHost[]> {
    const response = await axios.get(`${API_BASE_URL}/_api/customer/sites`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  // Search customer's vhosts
  async searchVHosts(params: SearchParams) {
    const response = await axios.get(`${API_BASE_URL}/_api/customer/sites/search`, {
      params,
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  // Get specific vhost
  async getVHost(domain: string): Promise<VHost> {
    const response = await axios.get(`${API_BASE_URL}/_api/customer/sites/${domain}`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  // Create new vhost
  async createVHost(data: VHost): Promise<VHost> {
    const response = await axios.post(`${API_BASE_URL}/_api/customer/sites`, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  // Update vhost
  async updateVHost(domain: string, data: Partial<VHost>): Promise<VHost> {
    const response = await axios.put(`${API_BASE_URL}/_api/customer/sites/${domain}`, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  // Delete vhost
  async deleteVHost(domain: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/_api/customer/sites/${domain}`, {
      headers: getAuthHeaders(),
    });
  },

  // Upload static site zip
  async uploadStaticSiteZip(domain: string, formData: FormData): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/_api/customer/sites/${domain}/upload`,
      formData,
      {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Get container stats
  async getContainerStats(domain: string): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/_api/customer/sites/${domain}/containers`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  // Container actions
  async containerAction(domain: string, action: 'start' | 'stop' | 'restart'): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/_api/customer/sites/${domain}/container/${action}`,
      {},
      {
        headers: getAuthHeaders(),
      }
    );
    return response.data;
  },

  // Get container logs
  async getContainerLogs(domain: string, lines: number = 100): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/_api/customer/sites/${domain}/logs`, {
      params: { lines },
      headers: getAuthHeaders(),
    });
    return response.data;
  },
};

// Alias for compatibility with admin-ui code
export const hostingAPI = customerAPI;