/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3001,
      proxy: {
        '/_admin': {
          target: env.VITE_API_BASE_URL || 'https://admin.spinforge.dev',
          changeOrigin: true,
        },
        '/_health': {
          target: env.VITE_API_BASE_URL || 'https://admin.spinforge.dev',
          changeOrigin: true,
        },
        '/_metrics': {
          target: env.VITE_API_BASE_URL || 'https://admin.spinforge.dev',
          changeOrigin: true,
        },
        '/_api': {
          target: env.VITE_API_BASE_URL || 'https://admin.spinforge.dev',
          changeOrigin: true,
        },
        '/api': {
          target: env.VITE_API_BASE_URL || 'https://admin.spinforge.dev',
          changeOrigin: true,
        },
      },
    },
  };
});