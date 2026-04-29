import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4032,
    strictPort: true,
    proxy: {
      '/auth':      { target: 'http://localhost:3251', changeOrigin: true },
      '/sites':     { target: 'http://localhost:3251', changeOrigin: true },
      '/analytics': { target: 'http://localhost:3251', changeOrigin: true },
      '/collect':   { target: 'http://localhost:3251', changeOrigin: true },
      '/track.js':  { target: 'http://localhost:3251', changeOrigin: true },
      '/health':    { target: 'http://localhost:3251', changeOrigin: true },
    }
  }
});
