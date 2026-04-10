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

  // Shared admin token used as X-Admin-Token on /api/* and /_admin/* requests
  // when no user session (JWT in localStorage) is present. Kept in lock-step
  // with ADMIN_TOKEN in the backend .env file. Overridable at build time via
  // VITE_ADMIN_TOKEN so self-hosted deployments can rotate it.
  ADMIN_TOKEN:
    (import.meta.env.VITE_ADMIN_TOKEN as string | undefined) ||
    'sf_admin_7a9c3f2e8b1d5a6e4c9f0b2d7e3a1c8f5b6d9e2a4c7f1b3d8e5a9c6f0b2d4e7a',

  // Whether we're in development mode
  isDevelopment: import.meta.env.DEV,

  // Whether we're in production mode
  isProduction: import.meta.env.PROD,
};