import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // API requests
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      // Handle redirects for OAuth and email verification
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      // Handle profile setup redirect
      '/profile-setup': {
        target: 'http://localhost:5173',
        changeOrigin: true,
        secure: false,
      },
    },
    historyApiFallback: true,
    cors: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    },
    // Ensure static assets are served with proper CORS headers
    assetsInlineLimit: 0,
  },
  // Ensure Vite adds required CORS headers
  preview: {
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
  },
  // Add CORS headers for development
  cors: true,
});