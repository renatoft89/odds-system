import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['renatoft89.duckdns.org'],
    port: 5176,
    proxy: {
      '/api': {
        target: 'http://192.168.0.64:3000',
        changeOrigin: true,
      },
    },
  },
})
