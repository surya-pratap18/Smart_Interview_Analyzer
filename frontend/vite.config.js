import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api requests to Flask backend
      // So React calls /api/analyze → Flask at localhost:5000/api/analyze
      '/api': {
        target:      'http://localhost:5000',
        changeOrigin: true,
      },
      // Proxy WebSocket for real-time alerts
      '/socket.io': {
        target:  'http://localhost:5000',
        ws:      true,
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
  }
})
