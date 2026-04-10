/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
// Environment configuration
//
// The admin browser does NOT carry a machine API key. Authentication
// happens exclusively via the JWT issued by /_admin/login (sent as
// Authorization: Bearer). Machine integrations send sfa_… API keys
// via X-API-Key — those live in CI secrets, not in this bundle.
export const config = {
  // API base URL - defaults to current origin in production
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',

  // Whether we're in development mode
  isDevelopment: import.meta.env.DEV,

  // Whether we're in production mode
  isProduction: import.meta.env.PROD,
};