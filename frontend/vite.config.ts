import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/wallets': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/transactions': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/categories': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/subscriptions': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/investments': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    }
  }
})
