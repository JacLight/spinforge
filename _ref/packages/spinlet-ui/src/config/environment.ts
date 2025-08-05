// Environment configuration
export const config = {
  // API base URL - defaults to current origin in production
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
  
  // SpinHub URLs for different services
  SPINHUB_URL: import.meta.env.VITE_SPINHUB_URL || 'http://localhost:9004',
  PROMETHEUS_URL: import.meta.env.VITE_PROMETHEUS_URL || 'http://localhost:9008',
  GRAFANA_URL: import.meta.env.VITE_GRAFANA_URL || 'http://localhost:9009',
  
  // Whether we're in development mode
  isDevelopment: import.meta.env.DEV,
  
  // Whether we're in production mode
  isProduction: import.meta.env.PROD,
};