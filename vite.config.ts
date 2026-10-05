import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The UI calls /api/*; in development Vite forwards those to the API server.
const API = process.env.API_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: API, changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 900 },
});
