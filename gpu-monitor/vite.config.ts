import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy Prometheus API to avoid browser CORS during local dev.
// Override target with VITE_PROMETHEUS_PROXY_TARGET or default below.
const prometheusTarget =
  process.env.VITE_PROMETHEUS_PROXY_TARGET || 'http://157.66.255.189:32003'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/prometheus': {
        target: prometheusTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/prometheus/, ''),
      },
    },
  },
})
