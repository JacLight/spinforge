import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
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
        target: 'http://localhost:9004',
        changeOrigin: true,
      },
      '/_health': {
        target: 'http://localhost:9004',
        changeOrigin: true,
      },
      '/_metrics': {
        target: 'http://localhost:9004',
        changeOrigin: true,
      },
    },
  },
});