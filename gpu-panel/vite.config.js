import { defineConfig } from 'vite';

/**
 * Dev proxy: browser calls same-origin /prometheus/* → real Prometheus.
 * Avoids CORS when testing against http://157.66.255.189:32003
 */
export default defineConfig({
  server: {
    proxy: {
      '/prometheus': {
        target: 'http://157.66.255.189:32003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/prometheus/, ''),
      },
    },
  },
});
