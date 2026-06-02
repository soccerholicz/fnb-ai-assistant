import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// API port the dev server proxies to. Keep in sync with apps/api default (8080).
const API_TARGET = 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Vite dev server forwards /api/* to the Fastify API, stripping the prefix.
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
