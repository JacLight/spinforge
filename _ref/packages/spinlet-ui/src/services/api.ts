import apiClient from './axios-config';

export interface Route {
  domain: string;
  customerId: string;
  spinletId: string;
  buildPath: string;
  framework: string;
  allDomains?: string[]; // All domains associated with this spinlet
  config?: {
    memory?: string;
    cpu?: string;
    env?: Record<string, string>;
    proxy?: {
      target: string;
      changeOrigin?: boolean;
      preserveHostHeader?: boolean;
      headers?: Record<string, string>;
    };
    [key: string]: any; // Allow other config properties
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
  mode?: 'development' | 'production';
  packageVersion?: string;
  runCommand?: string;
}

export interface IdleInfo {
  spinletId: string;
  ttl: number;
  willExpireAt: string;
  timeRemaining: number;
  timeRemainingFormatted: string;
}

export interface DeploymentStatus {
  name: string;
  status: "pending" | "building" | "success" | "failed" | "processing";
  timestamp: string;
  error?: string;
  buildTime?: number;
  domains?: string[];
  framework?: string;
  customerId?: string;
  spinletId?: string;
}

export interface IdleMetrics {
  totalActive: number;
  idleTimeouts: Array<{
    spinletId: string;
    ttl: number;
    willExpireAt: string;
  }>;
  aboutToExpire: number;
  avgTimeToExpire: number;
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

export interface Customer {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
  limits?: {
    maxSpinlets?: number;
    maxMemory?: string;
    maxDomains?: number;
  };
}

export interface AllMetrics {
  system: SystemMetrics;
  docker: DockerStats;
  keydb: KeyDBMetrics;
  services: ServiceHealth[];
  timestamp: string;
}

export interface RouteDetails {
  route: Route;
  spinlet?: Spinlet;
  metrics?: any;
  health?: any;
}

export interface SpinletLogs {
  logs: string[];
  timestamp: string;
}

export interface CommandResult {
  output: string;
  exitCode: number;
  error?: string;
}

export interface DeploymentScanResult {
  items: Array<{
    name: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: string;
  }>;
  total: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  version?: string;
  uptime?: number;
}

export interface CustomersResponse {
  customers: Customer[];
  total: number;
  offset: number;
  limit: number;
}

export interface HostingInfo {
  domain: string;
  customerId: string;
  spinletId: string;
  framework: string;
  status: {
    redis: boolean;
    deploymentFolder: boolean;
    webRootFolder: boolean;
    spinletRunning: boolean;
    issues: string[];
  };
  paths: {
    deploymentPath: string;
    webRootPath: string;
    actualDeploymentPath?: string;
    actualWebRootPath?: string;
  };
  proxy?: {
    targetPort?: number;
    spinletState?: string;
  };
}

export interface HostingComparison {
  deploymentFolders: Array<{
    path: string;
    customerId: string;
    appName: string;
    hasRoute: boolean;
    hasWebRoot: boolean;
  }>;
  webRootFolders: Array<{
    path: string;
    customerId: string;
    appName: string;
    hasDeployment: boolean;
  }>;
  redisRoutes: Array<{
    domain: string;
    customerId: string;
    spinletId: string;
    framework: string;
    hasDeployment: boolean;
    hasWebRoot: boolean;
  }>;
  mismatches: Array<{
    type: string;
    description: string;
    details: any;
  }>;
}

export interface Settings {
  build: {
    deploymentPath: string;
    buildPath: string;
    webRootPath: string;
    startupTimeoutMs: number;
  };
  resources: {
    idleTimeoutMs: number;
    memoryLimit: string;
    cpuLimit: string;
    portRange: {
      start: number;
      end: number;
    };
  };
  networking: {
    bindHost: string;
    publicUrl: string;
    corsOrigins: string[];
  };
  security: {
    adminToken: boolean;
    rateLimits: {
      global: number;
      perCustomer: number;
    };
  };
  notifications: {
    slackWebhook: string;
    emailEnabled: boolean;
    webhookUrl: string;
  };
  maintenance: {
    autoCleanup: boolean;
    backupEnabled: boolean;
    logRetention: number;
    metricsRetention: number;
  };
}

class SpinForgeAPI {
  setAdminToken(token: string) {
    localStorage.setItem('adminToken', token);
  }

  private async request<T>(method: 'get' | 'post' | 'put' | 'delete', url: string, data?: any): Promise<T> {
    const response = await apiClient[method](url, data);
    return response.data;
  }

  async health(): Promise<HealthStatus> {
    return this.request<HealthStatus>('get', '/_health');
  }

  async metrics(): Promise<Metrics> {
    return this.request<Metrics>('get', '/_metrics');
  }

  // New comprehensive metrics endpoints
  async systemMetrics(): Promise<SystemMetrics> {
    return this.request<SystemMetrics>('get', '/_metrics/system');
  }

  async dockerStats(): Promise<DockerStats> {
    return this.request<DockerStats>('get', '/_metrics/docker');
  }

  async keydbMetrics(): Promise<KeyDBMetrics> {
    return this.request<KeyDBMetrics>('get', '/_metrics/keydb');
  }

  async serviceHealth(): Promise<ServiceHealth[]> {
    return this.request<ServiceHealth[]>('get', '/_metrics/services');
  }

  async allMetrics(): Promise<AllMetrics> {
    return this.request<AllMetrics>('get', '/_metrics/all');
  }

  async requestMetrics(): Promise<any> {
    return this.request('get', '/_metrics/requests');
  }

  async deploymentStats(): Promise<any> {
    return this.request('get', '/_metrics/deployments');
  }

  async getIdleMetrics(): Promise<IdleMetrics> {
    return this.request<IdleMetrics>('get', '/_metrics/idle');
  }

  async getIdleInfo(spinletId: string): Promise<IdleInfo> {
    return this.request<IdleInfo>('get', `/_metrics/idle/${spinletId}`);
  }

  async extendIdleTimeout(spinletId: string, seconds: number = 300): Promise<any> {
    return this.request('post', `/_admin/spinlets/${spinletId}/extend-timeout`, { seconds });
  }

  async createRoute(route: Route) {
    return this.request('post', '/_admin/routes', route);
  }

  async deleteRoute(domain: string) {
    return this.request('delete', `/_admin/routes/${domain}`);
  }

  async getDeployments(): Promise<DeploymentStatus[]> {
    return this.request<DeploymentStatus[]>('get', '/_admin/deployments');
  }

  async scanDeployments(): Promise<DeploymentScanResult> {
    return this.request<DeploymentScanResult>('post', '/_admin/deployments/scan', {});
  }

  async retryDeployment(name: string) {
    return this.request('post', `/_admin/deployments/${name}/retry`, {});
  }

  async verifyDeployment(name: string): Promise<{
    accessible: boolean;
    error?: string;
    status: string;
    files?: number;
    path?: string;
  }> {
    return this.request('get', `/_admin/deployments/${name}/verify`);
  }

  async addDomainToRoute(currentDomain: string, newDomain: string) {
    return this.request('post', `/_admin/routes/${currentDomain}/domains`, { newDomain });
  }

  async removeDomainFromRoute(currentDomain: string, domainToRemove: string) {
    return this.request('delete', `/_admin/routes/${currentDomain}/domains/${domainToRemove}`);
  }

  async getCustomerRoutes(customerId: string): Promise<Route[]> {
    return this.request<Route[]>('get', `/_admin/customers/${customerId}/routes`);
  }

  async getAllRoutes(): Promise<Route[]> {
    return this.request<Route[]>('get', '/_admin/routes');
  }

  async getRoutesWithStates(): Promise<(Route & { spinletState?: Spinlet; idleInfo?: IdleInfo })[]> {
    const routes = await this.getAllRoutes();
    const routesWithStates = await Promise.all(
      routes.map(async (route) => {
        try {
          const spinlet = await this.getSpinlet(route.spinletId);
          let idleInfo: IdleInfo | undefined;
          
          // Get idle info if spinlet is running
          if (spinlet && spinlet.state === 'running') {
            try {
              idleInfo = await this.getIdleInfo(route.spinletId);
            } catch (error) {
              // Ignore if idle info is not available
            }
          }
          
          return { ...route, spinletState: spinlet, idleInfo };
        } catch (error) {
          return { ...route, spinletState: undefined, idleInfo: undefined };
        }
      })
    );
    return routesWithStates;
  }

  async getSpinlet(spinletId: string): Promise<Spinlet> {
    return this.request<Spinlet>('get', `/_admin/spinlets/${spinletId}`);
  }

  async stopSpinlet(spinletId: string) {
    return this.request('post', `/_admin/spinlets/${spinletId}/stop`, {});
  }

  async getSpinletLogs(spinletId: string, lines = 100): Promise<SpinletLogs> {
    return this.request<SpinletLogs>('get', `/_admin/spinlets/${spinletId}/logs?lines=${lines}`);
  }

  async startSpinlet(spinletId: string) {
    return this.request('post', `/_admin/spinlets/${spinletId}/start`, {});
  }

  async restartSpinlet(spinletId: string) {
    return this.request('post', `/_admin/spinlets/${spinletId}/restart`, {});
  }

  async updateSpinletEnv(spinletId: string, env: Record<string, string>) {
    return this.request('put', `/_admin/spinlets/${spinletId}/env`, { env });
  }

  async getSpinletHealth(spinletId: string) {
    return this.request('get', `/_admin/spinlets/${spinletId}/health`);
  }

  async getRouteDetails(domain: string): Promise<RouteDetails> {
    return this.request<RouteDetails>('get', `/_admin/routes/${domain}/details`);
  }

  async updateRouteConfig(domain: string, config: any) {
    return this.request('put', `/_admin/routes/${domain}/config`, config);
  }

  async executeCommand(spinletId: string, command: string): Promise<CommandResult> {
    return this.request<CommandResult>('post', `/_admin/spinlets/${spinletId}/exec`, { command });
  }

  // Admin management
  async getAllAdmins(): Promise<Array<{
    id: string;
    username: string;
    email?: string;
    createdAt: Date;
    lastLogin?: Date;
    isActive: boolean;
    isSuperAdmin: boolean;
  }>> {
    return this.request('get', '/_admin/admins');
  }

  async createAdmin(data: {
    username: string;
    password: string;
    email?: string;
    isSuperAdmin?: boolean;
  }) {
    return this.request('post', '/_admin/admins', data);
  }

  async updateAdmin(id: string, data: any) {
    return this.request('put', `/_admin/admins/${id}`, data);
  }

  async deleteAdmin(id: string) {
    return this.request('delete', `/_admin/admins/${id}`);
  }

  // Customer management
  async getAllCustomers(filter?: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<CustomersResponse> {
    const params = new URLSearchParams();
    if (filter?.isActive !== undefined) params.append('isActive', String(filter.isActive));
    if (filter?.limit !== undefined) params.append('limit', String(filter.limit));
    if (filter?.offset !== undefined) params.append('offset', String(filter.offset));
    
    return this.request<CustomersResponse>('get', `/_admin/customers?${params.toString()}`);
  }

  async getCustomer(id: string) {
    return this.request('get', `/_admin/customers/${id}`);
  }

  async createCustomer(data: {
    name: string;
    email: string;
    metadata?: Record<string, any>;
    limits?: {
      maxSpinlets?: number;
      maxMemory?: string;
      maxDomains?: number;
    };
  }) {
    return this.request('post', '/_admin/customers', data);
  }

  async updateCustomer(id: string, data: any) {
    return this.request('put', `/_admin/customers/${id}`, data);
  }

  async deleteCustomer(id: string) {
    return this.request('delete', `/_admin/customers/${id}`);
  }

  async deleteDeployment(name: string) {
    return this.request('delete', `/_admin/deployments/${name}`);
  }

  async cancelDeployment(name: string) {
    return this.request('post', `/_admin/deployments/${name}/cancel`, {});
  }

  async cleanupOrphanedDeployment(domain: string) {
    return this.request('post', `/_admin/deployments/${encodeURIComponent(domain)}/cleanup-orphaned`, {});
  }

  // Settings API
  async getSettings() {
    return this.request('get', '/_admin/settings');
  }

  async updateSettings(settings: any) {
    return this.request('put', '/_admin/settings', settings);
  }

  async resetSettings() {
    return this.request('post', '/_admin/settings/reset', {});
  }

  // Hosting API
  async getHostingInfo() {
    return this.request('get', '/_admin/hosting');
  }

  async getHostingComparison() {
    return this.request('get', '/_admin/hosting/comparison');
  }

  async getHostingInfoForDomain(domain: string) {
    return this.request('get', `/_admin/hosting/domain/${encodeURIComponent(domain)}`);
  }

  async fixHostingIssues(domain: string) {
    return this.request('post', `/_admin/hosting/fix/${encodeURIComponent(domain)}`, {});
  }

  async syncWebRoot(spinletId: string) {
    return this.request('post', `/_admin/hosting/sync/${spinletId}`, {});
  }
}

// Customer-specific API class that uses customer endpoints
class CustomerAPI {
  setAuth(customerId: string, authToken: string) {
    localStorage.setItem('customerId', customerId);
    localStorage.setItem('authToken', authToken);
  }

  private async request<T>(method: 'get' | 'post' | 'put' | 'delete', url: string, data?: any): Promise<T> {
    const response = await apiClient[method](url, data);
    return response.data;
  }

  async getDeployments(): Promise<DeploymentStatus[]> {
    return this.request<DeploymentStatus[]>('get', '/_api/customer/deployments');
  }

  async getSpinlets(): Promise<Spinlet[]> {
    return this.request<Spinlet[]>('get', '/_api/customer/spinlets');
  }

  async getDomains(): Promise<any[]> {
    return this.request('get', '/_api/customer/domains');
  }

  async getUsage(): Promise<any> {
    return this.request('get', '/_api/customer/usage');
  }

  async stopSpinlet(spinletId: string) {
    return this.request('post', `/_api/customer/spinlets/${spinletId}/stop`, {});
  }

  async restartSpinlet(spinletId: string) {
    return this.request('post', `/_api/customer/spinlets/${spinletId}/restart`, {});
  }

  async getSpinletLogs(spinletId: string, lines = 100) {
    return this.request('get', `/_api/customer/spinlets/${spinletId}/logs?lines=${lines}`);
  }
}

export const api = new SpinForgeAPI();
export const customerApi = new CustomerAPI();