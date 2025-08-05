/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
// Environment configuration
export const config = {
  // API base URL - defaults to current origin in production
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
  
  // Whether we're in development mode
  isDevelopment: import.meta.env.DEV,
  
  // Whether we're in production mode
  isProduction: import.meta.env.PROD,
};