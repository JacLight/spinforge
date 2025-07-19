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
  spinletId: string;
  customerId: string;
  pid: number;
  port: number;
  state: 'starting' | 'running' | 'idle' | 'stopping' | 'stopped' | 'crashed';
  startTime: number;
  lastAccess: number;
  requests: number;
  errors: number;
  memory: number;
  cpu: number;
  host: string;
  servicePath: string;
  domains: string[];
}

export interface Metrics {
  activeSpinlets: number;
  totalSpinlets: number;
  allocatedPorts: number;
  availablePorts: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
    speed: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  network: {
    interfaces: Array<{
      name: string;
      address: string;
      bytesReceived: number;
      bytesSent: number;
    }>;
    totalBytesIn: number;
    totalBytesOut: number;
  };
  process: {
    uptime: number;
    pid: number;
    memory: any;
    cpuUsage: any;
  };
}

export interface DockerStats {
  containers: Array<{
    id: string;
    name: string;
    image: string;
    status: string;
    cpu: number;
    memory: {
      usage: number;
      limit: number;
      percent: number;
    };
    network: {
      rx: number;
      tx: number;
    };
    block: {
      read: number;
      write: number;
    };
  }>;
  total: number;
  running: number;
  stopped: number;
}

export interface KeyDBMetrics {
  connected: boolean;
  info: {
    version: string;
    uptime: number;
    connectedClients: number;
    usedMemory: number;
    usedMemoryHuman: string;
    totalKeys: number;
    totalExpires: number;
  };
  stats: {
    totalCommands: number;
    opsPerSec: number;
    hitRate: number;
    evictedKeys: number;
  };
  replication: {
    role: string;
    connectedSlaves: number;
  };
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  lastCheck: string;
  details: Record<string, any>;
}

export interface AllMetrics {
  system: SystemMetrics;
  docker: DockerStats;
  keydb: KeyDBMetrics;
  services: ServiceHealth[];
  timestamp: string;
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

  // New comprehensive metrics endpoints
  async systemMetrics(): Promise<SystemMetrics> {
    const response = await axios.get(`${API_BASE}/_metrics/system`);
    return response.data;
  }

  async dockerStats(): Promise<DockerStats> {
    const response = await axios.get(`${API_BASE}/_metrics/docker`);
    return response.data;
  }

  async keydbMetrics(): Promise<KeyDBMetrics> {
    const response = await axios.get(`${API_BASE}/_metrics/keydb`);
    return response.data;
  }

  async serviceHealth(): Promise<ServiceHealth[]> {
    const response = await axios.get(`${API_BASE}/_metrics/services`);
    return response.data;
  }

  async allMetrics(): Promise<AllMetrics> {
    const response = await axios.get(`${API_BASE}/_metrics/all`);
    return response.data;
  }

  async requestMetrics(): Promise<any> {
    const response = await axios.get(`${API_BASE}/_metrics/requests`);
    return response.data;
  }

  async deploymentStats(): Promise<any> {
    const response = await axios.get(`${API_BASE}/_metrics/deployments`);
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

  async getRoutesWithStates(): Promise<(Route & { spinletState?: Spinlet })[]> {
    const routes = await this.getAllRoutes();
    const routesWithStates = await Promise.all(
      routes.map(async (route) => {
        try {
          const spinlet = await this.getSpinlet(route.spinletId);
          return { ...route, spinletState: spinlet };
        } catch (error) {
          return { ...route, spinletState: undefined };
        }
      })
    );
    return routesWithStates;
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

  async startSpinlet(spinletId: string) {
    const response = await axios.post(
      `${API_BASE}/_admin/spinlets/${spinletId}/start`,
      {},
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async restartSpinlet(spinletId: string) {
    const response = await axios.post(
      `${API_BASE}/_admin/spinlets/${spinletId}/restart`,
      {},
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async updateSpinletEnv(spinletId: string, env: Record<string, string>) {
    const response = await axios.put(
      `${API_BASE}/_admin/spinlets/${spinletId}/env`,
      { env },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getRouteDetails(domain: string) {
    const response = await axios.get(
      `${API_BASE}/_admin/routes/${domain}/details`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async updateRouteConfig(domain: string, config: any) {
    const response = await axios.put(
      `${API_BASE}/_admin/routes/${domain}/config`,
      config,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async executeCommand(spinletId: string, command: string) {
    const response = await axios.post(
      `${API_BASE}/_admin/spinlets/${spinletId}/exec`,
      { command },
      { headers: this.getHeaders() }
    );
    return response.data;
  }
}

export const api = new SpinForgeAPI();