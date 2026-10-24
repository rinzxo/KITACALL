import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // Allow local network mobile access (e.g. http://192.168.163.86:3000)
    allowedHosts: true, // Allow cloudflare tunnels, ngrok, and external hosts
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:4001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:4001',
        ws: true,
        changeOrigin: true,
      },
    },
  }
})
