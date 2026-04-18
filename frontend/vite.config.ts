import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3005,
    proxy: {
      '/api': {
        target: process.env.REACT_APP_API_URL || 'http://backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  define: {
    'process.env.REACT_APP_API_URL': JSON.stringify(
      process.env.REACT_APP_API_URL || 'http://localhost:8000'
    ),
  },
})
