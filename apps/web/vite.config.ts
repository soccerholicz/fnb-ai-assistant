import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// API port the dev server proxies to. Keep in sync with apps/api default (8080).
const API_TARGET = 'http://localhost:8080';

export default defineConfig({
  // Asset base path. Defaults to "/" for local dev; the Pages deploy sets
  // VITE_BASE to "/<repo>/" so built assets resolve under the project site.
  base: process.env.VITE_BASE ?? '/',
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
