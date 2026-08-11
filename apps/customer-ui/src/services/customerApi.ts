import apiClient from './axios-config';

export interface CustomerSite {
  domain: string;
  type: string;
  customerId: string;
  enabled: boolean;
  ssl_enabled: boolean;
  createdAt: string;
  updatedAt: string;
  files_exist?: boolean;
  actual_domain?: string;
  aliases?: string[];
  containerConfig?: any;
  proxyTarget?: string;
  staticConfig?: any;
  [k: string]: any;
}

export interface CustomerDeployment {
  id: string;
  domain?: string;
  status: string;
  type?: string;
  createdAt: string;
  updatedAt?: string;
  [k: string]: any;
}

export interface CustomerToken {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
}

export interface CustomerUsage {
  sites: number;
  deployments: number;
  storageMb?: number;
  bandwidthMb?: number;
  requests?: number;
  [k: string]: any;
}

export const customerApi = {
  // Sites
  listSites: async (search?: string, type?: string): Promise<CustomerSite[]> => {
    if (search || type) {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (type) params.set('type', type);
      const { data } = await apiClient.get(`/_api/customer/sites/search?${params}`);
      return data.data || [];
    }
    const { data } = await apiClient.get('/_api/customer/sites');
    return data;
  },
  getSite: async (domain: string): Promise<CustomerSite> => {
    const { data } = await apiClient.get(`/_api/customer/sites/${encodeURIComponent(domain)}`);
    return data;
  },
  createSite: async (site: Partial<CustomerSite>): Promise<CustomerSite> => {
    const { data } = await apiClient.post('/_api/customer/sites', site);
    return data;
  },
  updateSite: async (domain: string, updates: Partial<CustomerSite>): Promise<CustomerSite> => {
    const { data } = await apiClient.put(`/_api/customer/sites/${encodeURIComponent(domain)}`, updates);
    return data;
  },
  deleteSite: async (domain: string): Promise<void> => {
    await apiClient.delete(`/_api/customer/sites/${encodeURIComponent(domain)}`);
  },
  uploadSiteFiles: async (domain: string, file: File): Promise<any> => {
    const fd = new FormData();
    fd.append('zipfile', file);
    const { data } = await apiClient.post(
      `/_api/customer/sites/${encodeURIComponent(domain)}/upload`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  },
  siteReadiness: async (domain: string): Promise<any> => {
    const { data } = await apiClient.get(`/_api/customer/sites/${encodeURIComponent(domain)}/readiness`);
    return data;
  },
  containerAction: async (domain: string, action: 'start' | 'stop' | 'restart'): Promise<any> => {
    const { data } = await apiClient.post(`/_api/customer/sites/${encodeURIComponent(domain)}/container/${action}`);
    return data;
  },
  siteLogs: async (domain: string, lines = 200): Promise<any> => {
    const { data } = await apiClient.get(`/_api/customer/sites/${encodeURIComponent(domain)}/logs?lines=${lines}`);
    return data;
  },

  // Deployments
  listDeployments: async (): Promise<CustomerDeployment[]> => {
    const { data } = await apiClient.get('/_api/customer/deployments');
    return Array.isArray(data) ? data : data.deployments || [];
  },
  getDeployment: async (id: string): Promise<CustomerDeployment> => {
    const { data } = await apiClient.get(`/_api/customer/deployments/${id}`);
    return data;
  },
  deleteDeployment: async (id: string): Promise<void> => {
    await apiClient.delete(`/_api/customer/deployments/${id}`);
  },
  deploymentLogs: async (id: string): Promise<any> => {
    const { data } = await apiClient.get(`/_api/customer/deployments/${id}/logs`);
    return data;
  },
  deploymentMetrics: async (id: string): Promise<any> => {
    const { data } = await apiClient.get(`/_api/customer/deployments/${id}/metrics`);
    return data;
  },
  deploy: async (payload: any): Promise<any> => {
    const { data } = await apiClient.post('/_api/customer/deploy', payload);
    return data;
  },

  // Tokens
  listTokens: async (): Promise<CustomerToken[]> => {
    const { data } = await apiClient.get('/_api/customer/tokens');
    return Array.isArray(data) ? data : data.tokens || [];
  },
  createToken: async (name: string, expiresInDays?: number): Promise<{ token: string; metadata: CustomerToken }> => {
    const { data } = await apiClient.post('/_api/customer/tokens', { name, expiresInDays });
    return data;
  },
  deleteToken: async (id: string): Promise<void> => {
    await apiClient.delete(`/_api/customer/tokens/${id}`);
  },
  deleteAllTokens: async (): Promise<void> => {
    await apiClient.delete('/_api/customer/tokens');
  },

  // Misc
  domains: async (): Promise<any> => {
    const { data } = await apiClient.get('/_api/customer/domains');
    return data;
  },
  usage: async (): Promise<CustomerUsage> => {
    const { data } = await apiClient.get('/_api/customer/usage');
    return data;
  },

  // Profile
  getProfile: async (): Promise<any> => {
    const { data } = await apiClient.get('/_api/customer/me');
    return data;
  },
  updateProfile: async (updates: { name?: string; email?: string }): Promise<any> => {
    const { data } = await apiClient.put('/_api/customer/me', updates);
    return data;
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<any> => {
    const { data } = await apiClient.post('/_api/customer/me/password', { currentPassword, newPassword });
    return data;
  },
  getPolicy: async (): Promise<any> => {
    const { data } = await apiClient.get('/_api/customer/me/policy');
    return data;
  },

  // Audit / activity
  audit: async (limit = 200): Promise<any[]> => {
    const { data } = await apiClient.get(`/_api/customer/audit?limit=${limit}`);
    return data?.entries || [];
  },
};
