import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Vite config for opentcs-spa.
//
// dev-server proxy: keeps the SPA same-origin with the BFF in development so
// that fetch() / EventSource() requests do not need CORS. The target points at
// the default `opentcs-bff` listen address (see opentcs-bff/src/main/resources/
// openapi/bff.yaml `servers:`). In production the same effect is achieved by
// nginx reverse-proxy in front of the static bundle (see roadmap S10).
//
// SSE note: `changeOrigin: false` so the upstream Host header is preserved,
// and we explicitly do NOT enable any response buffering. Vite's built-in
// http-proxy does not buffer SSE by default.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: false,
      },
      '/health': {
        target: 'http://localhost:8090',
        changeOrigin: false,
      },
      '/openapi': {
        target: 'http://localhost:8090',
        changeOrigin: false,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
