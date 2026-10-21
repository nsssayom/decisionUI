import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    // `pnpm dev` talks to the local decisionUI server (proxy + tools) when it runs on :8890
    proxy: { '/api': 'http://127.0.0.1:8890', '/proxy': 'http://127.0.0.1:8890', '/tools': 'http://127.0.0.1:8890' },
  },
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
