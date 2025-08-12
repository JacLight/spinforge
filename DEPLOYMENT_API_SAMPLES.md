# SpinForge Deployment API Samples

This document provides sample Axios API calls for various deployment scenarios in SpinForge.

## Base Configuration

```javascript
import axios from 'axios';

// Configure base API client
const apiClient = axios.create({
  baseURL: 'https://your-spinforge-domain.com', // or http://localhost:3000 for local dev
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## 1. Deploy Static Site with ZIP File

```javascript
// Step 1: Create the static site
const createStaticSite = async () => {
  const siteConfig = {
    domain: 'mysite.example.com',
    type: 'static',
    enabled: true,
    aliases: ['www.mysite.example.com'],
    index_file: 'index.html',
    error_file: '404.html',
    ssl: { 
      enabled: true, 
      provider: 'letsencrypt' 
    },
    customerId: 'customer-123'
  };

  try {
    const response = await apiClient.post('/api/sites', siteConfig);
    console.log('Static site created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating static site:', error.response?.data || error.message);
    throw error;
  }
};

// Step 2: Upload ZIP file with site content
const uploadStaticSiteContent = async (domain, zipFile) => {
  const formData = new FormData();
  formData.append('zipfile', zipFile); // zipFile is a File object from input[type=file]

  try {
    const response = await apiClient.post(
      `/api/sites/${domain}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Track upload progress
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Upload Progress: ${percentCompleted}%`);
        }
      }
    );
    console.log('Files uploaded successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error uploading files:', error.response?.data || error.message);
    throw error;
  }
};

// Combined deployment
const deployStaticSiteWithZip = async (zipFile) => {
  const site = await createStaticSite();
  await uploadStaticSiteContent('mysite.example.com', zipFile);
  return site;
};
```

## 2. Deploy Docker Container (Without Credentials)

```javascript
const deployPublicContainer = async () => {
  const containerConfig = {
    domain: 'api.example.com',
    type: 'container',
    enabled: true,
    aliases: [],
    ssl: { 
      enabled: true, 
      provider: 'letsencrypt' 
    },
    containerConfig: {
      image: 'nginx:latest', // Public Docker Hub image
      port: 80,
      env: [
        { key: 'NODE_ENV', value: 'production' },
        { key: 'API_KEY', value: 'your-api-key' },
        { key: 'DATABASE_URL', value: 'postgres://user:pass@db:5432/mydb' }
      ],
      restartPolicy: 'unless-stopped',
      volumes: [
        { source: '/data/uploads', target: '/app/uploads' }
      ],
      networks: ['spinforge-network']
    },
    customerId: 'customer-123'
  };

  try {
    const response = await apiClient.post('/api/sites', containerConfig);
    console.log('Container deployed:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error deploying container:', error.response?.data || error.message);
    throw error;
  }
};
```

## 3. Deploy Docker Container with Private Registry Credentials

```javascript
const deployPrivateContainer = async () => {
  const containerConfig = {
    domain: 'app.example.com',
    type: 'container',
    enabled: true,
    aliases: ['www.app.example.com'],
    ssl: { 
      enabled: true, 
      provider: 'letsencrypt' 
    },
    containerConfig: {
      image: 'ghcr.io/myorg/myapp:latest', // Private registry image
      port: 3000,
      env: [
        { key: 'NODE_ENV', value: 'production' },
        { key: 'SECRET_KEY', value: process.env.SECRET_KEY }
      ],
      restartPolicy: 'unless-stopped',
      // Private registry credentials
      registryCredentials: {
        registry: 'ghcr.io', // GitHub Container Registry
        username: 'your-github-username',
        password: 'your-personal-access-token' // GitHub PAT with read:packages scope
      }
    },
    customerId: 'customer-123'
  };

  try {
    const response = await apiClient.post('/api/sites', containerConfig);
    console.log('Private container deployed:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error deploying private container:', error.response?.data || error.message);
    throw error;
  }
};

// Other registry examples
const registryExamples = {
  // Docker Hub private repo
  dockerHub: {
    registry: 'docker.io', // or leave empty for Docker Hub
    username: 'dockerhub-username',
    password: 'dockerhub-password'
  },
  
  // AWS ECR
  awsECR: {
    registry: '123456789012.dkr.ecr.us-east-1.amazonaws.com',
    username: 'AWS',
    password: 'aws-ecr-token' // Get from: aws ecr get-login-password
  },
  
  // Google Container Registry
  gcr: {
    registry: 'gcr.io',
    username: '_json_key',
    password: JSON.stringify(serviceAccountKey) // GCP service account JSON key
  },
  
  // Azure Container Registry
  azure: {
    registry: 'myregistry.azurecr.io',
    username: 'myregistry',
    password: 'azure-registry-password'
  },
  
  // GitLab Container Registry
  gitlab: {
    registry: 'registry.gitlab.com',
    username: 'gitlab-username',
    password: 'gitlab-personal-access-token'
  }
};
```

## 4. Deploy Proxy/Reverse Proxy

```javascript
const deployProxy = async () => {
  const proxyConfig = {
    domain: 'proxy.example.com',
    type: 'proxy',
    enabled: true,
    aliases: [],
    target: 'http://backend-service:8080',
    preserve_host: true,
    websocket_support: true,
    ssl: { 
      enabled: true, 
      provider: 'letsencrypt' 
    },
    headers: {
      'X-Custom-Header': 'value',
      'X-Forwarded-Proto': 'https'
    },
    customerId: 'customer-123'
  };

  try {
    const response = await apiClient.post('/api/sites', proxyConfig);
    console.log('Proxy deployed:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error deploying proxy:', error.response?.data || error.message);
    throw error;
  }
};
```

## 5. Deploy Load Balancer

```javascript
const deployLoadBalancer = async () => {
  const loadBalancerConfig = {
    domain: 'lb.example.com',
    type: 'loadbalancer',
    enabled: true,
    aliases: [],
    ssl: { 
      enabled: true, 
      provider: 'letsencrypt' 
    },
    backends: [
      {
        url: 'http://backend1.internal:3000',
        label: 'primary',
        weight: 2,
        enabled: true,
        isLocal: true, // This is a SpinForge service
        healthCheck: {
          path: '/health',
          interval: 10,
          timeout: 5,
          unhealthyThreshold: 3,
          healthyThreshold: 2
        }
      },
      {
        url: 'http://backend2.internal:3000',
        label: 'secondary',
        weight: 1,
        enabled: true,
        isLocal: true,
        healthCheck: {
          path: '/health',
          interval: 10,
          timeout: 5,
          unhealthyThreshold: 3,
          healthyThreshold: 2
        }
      },
      {
        url: 'https://external-api.example.com',
        label: 'external',
        weight: 1,
        enabled: true,
        isLocal: false, // External service
        healthCheck: {
          path: '/api/health',
          interval: 30,
          timeout: 10,
          unhealthyThreshold: 2,
          healthyThreshold: 1
        }
      }
    ],
    stickySessionDuration: 3600, // 1 hour sticky sessions
    routingRules: [
      {
        type: 'header',
        name: 'X-Version',
        matchType: 'exact',
        value: 'v2',
        targetLabel: 'secondary',
        priority: 10
      },
      {
        type: 'cookie',
        name: 'beta',
        matchType: 'exact',
        value: 'true',
        targetLabel: 'external',
        priority: 5
      }
    ],
    customerId: 'customer-123'
  };

  try {
    const response = await apiClient.post('/api/sites', loadBalancerConfig);
    console.log('Load balancer deployed:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error deploying load balancer:', error.response?.data || error.message);
    throw error;
  }
};
```

## 6. Update/Redeploy Existing Deployment

```javascript
// Update static site content (redeploy with new ZIP)
const redeployStaticSite = async (domain, newZipFile) => {
  try {
    // Upload new content (this overwrites existing files)
    const formData = new FormData();
    formData.append('zipfile', newZipFile);
    
    const response = await apiClient.post(
      `/api/sites/${domain}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      }
    );
    console.log('Site content updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating site content:', error.response?.data || error.message);
    throw error;
  }
};

// Update container configuration
const updateContainer = async (domain) => {
  const updates = {
    containerConfig: {
      image: 'nginx:1.21', // Update to new version
      port: 80,
      env: [
        { key: 'NODE_ENV', value: 'production' },
        { key: 'NEW_VAR', value: 'new-value' } // Add new env var
      ],
      restartPolicy: 'always' // Change restart policy
    }
  };

  try {
    const response = await apiClient.put(`/api/sites/${domain}`, updates);
    console.log('Container updated:', response.data);
    
    // Container will be automatically redeployed with new config
    return response.data;
  } catch (error) {
    console.error('Error updating container:', error.response?.data || error.message);
    throw error;
  }
};

// Update proxy target
const updateProxyTarget = async (domain, newTarget) => {
  const updates = {
    target: newTarget,
    preserve_host: true,
    websocket_support: false // Disable websocket support
  };

  try {
    const response = await apiClient.put(`/api/sites/${domain}`, updates);
    console.log('Proxy target updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating proxy:', error.response?.data || error.message);
    throw error;
  }
};

// Update load balancer backends
const updateLoadBalancerBackends = async (domain) => {
  const updates = {
    backends: [
      {
        url: 'http://new-backend1:3000',
        label: 'new-primary',
        weight: 3,
        enabled: true,
        isLocal: true,
        healthCheck: {
          path: '/api/health',
          interval: 5,
          timeout: 3,
          unhealthyThreshold: 2,
          healthyThreshold: 1
        }
      },
      {
        url: 'http://new-backend2:3000',
        label: 'new-secondary',
        weight: 1,
        enabled: false, // Disabled for maintenance
        isLocal: true,
        healthCheck: {
          path: '/api/health',
          interval: 5,
          timeout: 3,
          unhealthyThreshold: 2,
          healthyThreshold: 1
        }
      }
    ],
    stickySessionDuration: 7200 // Update to 2 hours
  };

  try {
    const response = await apiClient.put(`/api/sites/${domain}`, updates);
    console.log('Load balancer updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating load balancer:', error.response?.data || error.message);
    throw error;
  }
};

// Enable/Disable site
const toggleSite = async (domain, enabled) => {
  try {
    const response = await apiClient.put(`/api/sites/${domain}`, { enabled });
    console.log(`Site ${enabled ? 'enabled' : 'disabled'}:`, response.data);
    return response.data;
  } catch (error) {
    console.error('Error toggling site:', error.response?.data || error.message);
    throw error;
  }
};

// Update SSL configuration
const updateSSL = async (domain, enableSSL) => {
  try {
    const response = await apiClient.put(`/api/sites/${domain}`, {
      ssl: {
        enabled: enableSSL,
        provider: enableSSL ? 'letsencrypt' : undefined
      }
    });
    console.log('SSL configuration updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating SSL:', error.response?.data || error.message);
    throw error;
  }
};
```

## 7. Check Deployment Status

```javascript
// Get site details
const getSiteStatus = async (domain) => {
  try {
    const response = await apiClient.get(`/api/sites/${domain}`);
    console.log('Site status:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting site status:', error.response?.data || error.message);
    throw error;
  }
};

// Get container stats (for container deployments)
const getContainerStats = async (domain) => {
  try {
    const response = await apiClient.get(`/api/sites/${domain}/container/stats`);
    console.log('Container stats:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting container stats:', error.response?.data || error.message);
    throw error;
  }
};

// Get container logs
const getContainerLogs = async (domain, tail = 100) => {
  try {
    const response = await apiClient.get(`/api/sites/${domain}/container/logs`, {
      params: { tail },
      responseType: 'text'
    });
    console.log('Container logs:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting container logs:', error.response?.data || error.message);
    throw error;
  }
};

// Get site metrics
const getSiteMetrics = async (domain, timeRange = '1h') => {
  try {
    const response = await apiClient.get(`/_metrics/sites/${domain}/metrics`, {
      params: { range: timeRange }
    });
    console.log('Site metrics:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting site metrics:', error.response?.data || error.message);
    throw error;
  }
};
```

## 8. Delete Deployment

```javascript
const deleteSite = async (domain) => {
  try {
    const response = await apiClient.delete(`/api/sites/${domain}`);
    console.log('Site deleted:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error deleting site:', error.response?.data || error.message);
    throw error;
  }
};
```

## 9. Full Example: Deploy and Update Workflow

```javascript
// Complete deployment workflow
class SpinForgeDeployment {
  constructor(apiBaseUrl) {
    this.api = axios.create({
      baseURL: apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Deploy a new application
  async deploy(config) {
    try {
      // Create the site
      const response = await this.api.post('/api/sites', config);
      console.log(`✅ Deployed ${config.domain}`);
      
      // If static site with zip file, upload content
      if (config.type === 'static' && config.zipFile) {
        await this.uploadStaticContent(config.domain, config.zipFile);
      }
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        console.log(`Site ${config.domain} already exists. Updating instead...`);
        return this.update(config.domain, config);
      }
      throw error;
    }
  }

  // Update existing deployment
  async update(domain, updates) {
    try {
      const response = await this.api.put(`/api/sites/${domain}`, updates);
      console.log(`✅ Updated ${domain}`);
      
      // If updating static site with new zip file
      if (updates.type === 'static' && updates.zipFile) {
        await this.uploadStaticContent(domain, updates.zipFile);
      }
      
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to update ${domain}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Upload static content
  async uploadStaticContent(domain, zipFile) {
    const formData = new FormData();
    formData.append('zipfile', zipFile);
    
    try {
      const response = await this.api.post(
        `/api/sites/${domain}/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`📤 Uploading: ${percent}%`);
          }
        }
      );
      console.log(`✅ Content uploaded to ${domain}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to upload content:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Redeploy with new configuration or content
  async redeploy(domain, newConfig) {
    try {
      // Get current configuration
      const current = await this.api.get(`/api/sites/${domain}`);
      
      // Merge with new configuration
      const merged = { ...current.data, ...newConfig };
      
      // Update the site
      return this.update(domain, merged);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`Site ${domain} not found. Creating new deployment...`);
        return this.deploy({ domain, ...newConfig });
      }
      throw error;
    }
  }

  // Monitor deployment
  async monitor(domain, interval = 5000) {
    console.log(`👁️ Monitoring ${domain}...`);
    
    const checkStatus = async () => {
      try {
        const site = await this.api.get(`/api/sites/${domain}`);
        const metrics = await this.api.get(`/_metrics/sites/${domain}/metrics`);
        
        console.log(`Status: ${site.data.enabled ? '🟢 Active' : '🔴 Inactive'}`);
        console.log(`Requests: ${metrics.data.totalRequests}`);
        console.log(`Response Time: ${metrics.data.metrics.avgResponseTime}ms`);
        
        if (site.data.type === 'container') {
          const stats = await this.api.get(`/api/sites/${domain}/container/stats`);
          console.log(`CPU: ${stats.data.cpu_percent}%`);
          console.log(`Memory: ${stats.data.memory_usage_mb}MB`);
        }
      } catch (error) {
        console.error('Monitoring error:', error.message);
      }
    };
    
    // Initial check
    await checkStatus();
    
    // Set up interval
    return setInterval(checkStatus, interval);
  }
}

// Usage example
const spinforge = new SpinForgeDeployment('https://your-spinforge.com');

// Deploy a new container with private registry
await spinforge.deploy({
  domain: 'myapp.example.com',
  type: 'container',
  enabled: true,
  ssl: { enabled: true, provider: 'letsencrypt' },
  containerConfig: {
    image: 'ghcr.io/myorg/myapp:v1.0.0',
    port: 3000,
    env: [
      { key: 'NODE_ENV', value: 'production' }
    ],
    registryCredentials: {
      registry: 'ghcr.io',
      username: 'github-username',
      password: 'github-pat-token'
    }
  }
});

// Later, redeploy with new version
await spinforge.redeploy('myapp.example.com', {
  containerConfig: {
    image: 'ghcr.io/myorg/myapp:v1.1.0', // New version
    port: 3000,
    env: [
      { key: 'NODE_ENV', value: 'production' },
      { key: 'FEATURE_FLAG', value: 'enabled' } // New env var
    ]
  }
});

// Monitor the deployment
const monitoring = await spinforge.monitor('myapp.example.com', 10000); // Check every 10 seconds

// Stop monitoring when done
// clearInterval(monitoring);
```

## Error Handling

```javascript
// Comprehensive error handling
const deployWithErrorHandling = async (config) => {
  try {
    const response = await apiClient.post('/api/sites', config);
    return { success: true, data: response.data };
  } catch (error) {
    // Network errors
    if (!error.response) {
      return {
        success: false,
        error: 'Network error. Please check your connection.',
        details: error.message
      };
    }
    
    // HTTP errors
    const status = error.response.status;
    const data = error.response.data;
    
    switch (status) {
      case 400:
        return {
          success: false,
          error: 'Invalid configuration',
          details: data.error || 'Please check your deployment configuration'
        };
      
      case 401:
        return {
          success: false,
          error: 'Authentication required',
          details: 'Please login to continue'
        };
      
      case 403:
        return {
          success: false,
          error: 'Permission denied',
          details: 'You do not have permission to perform this action'
        };
      
      case 404:
        return {
          success: false,
          error: 'Resource not found',
          details: data.error || 'The requested resource was not found'
        };
      
      case 409:
        return {
          success: false,
          error: 'Conflict',
          details: data.error || 'A site with this domain already exists'
        };
      
      case 413:
        return {
          success: false,
          error: 'File too large',
          details: 'Please ensure your file is under 100MB'
        };
      
      case 500:
        return {
          success: false,
          error: 'Server error',
          details: data.error || 'An internal server error occurred'
        };
      
      default:
        return {
          success: false,
          error: `HTTP ${status} error`,
          details: data.error || error.message
        };
    }
  }
};
```

## Notes

1. **Authentication**: Add authentication headers if your SpinForge instance requires it
2. **SSL**: Let's Encrypt SSL certificates require valid domain DNS pointing to your server
3. **Private Registries**: Store credentials securely, never commit them to version control
4. **File Uploads**: Maximum file size is 100MB for static site ZIP uploads
5. **Container Ports**: Ensure the port specified matches the port your container application listens on
6. **Environment Variables**: Sensitive values should be stored securely and injected at runtime
7. **Updates**: When updating deployments, only include the fields you want to change
8. **Monitoring**: Use metrics and logs endpoints to monitor deployment health