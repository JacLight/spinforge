import axios from 'axios';

const API_BASE = '';

export interface Route {
  domain: string;
  customerId: string;
  spinletId: string;
  buildPath: string;
  framework: string;
  config?: {
    memory?: string;
    cpu?: string;
    env?: Record<string, string>;
  };
}

export interface Spinlet {
  id: string;
  customerId: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  port?: number;
  memory?: string;
  cpu?: string;
  createdAt: string;
  lastHealthCheck?: string;
}

export interface Metrics {
  activeSpinlets: number;
  totalSpinlets: number;
  allocatedPorts: number;
  availablePorts: number;
  memoryUsage: number;
  cpuUsage: number;
}

class SpinForgeAPI {
  private adminToken: string;

  constructor() {
    this.adminToken = localStorage.getItem('adminToken') || '';
  }

  setAdminToken(token: string) {
    this.adminToken = token;
    localStorage.setItem('adminToken', token);
  }

  private getHeaders() {
    return {
      'X-Admin-Token': this.adminToken,
      'Content-Type': 'application/json',
    };
  }

  async health() {
    const response = await axios.get(`${API_BASE}/_health`);
    return response.data;
  }

  async metrics(): Promise<Metrics> {
    const response = await axios.get(`${API_BASE}/_metrics`);
    return response.data;
  }

  async createRoute(route: Route) {
    const response = await axios.post(
      `${API_BASE}/_admin/routes`,
      route,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async deleteRoute(domain: string) {
    const response = await axios.delete(
      `${API_BASE}/_admin/routes/${domain}`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getCustomerRoutes(customerId: string): Promise<Route[]> {
    const response = await axios.get(
      `${API_BASE}/_admin/customers/${customerId}/routes`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getAllRoutes(): Promise<Route[]> {
    const response = await axios.get(
      `${API_BASE}/_admin/routes`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getSpinlet(spinletId: string): Promise<Spinlet> {
    const response = await axios.get(
      `${API_BASE}/_admin/spinlets/${spinletId}`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async stopSpinlet(spinletId: string) {
    const response = await axios.post(
      `${API_BASE}/_admin/spinlets/${spinletId}/stop`,
      {},
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getSpinletLogs(spinletId: string, lines = 100) {
    const response = await axios.get(
      `${API_BASE}/_admin/spinlets/${spinletId}/logs?lines=${lines}`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }
}

export const api = new SpinForgeAPI();