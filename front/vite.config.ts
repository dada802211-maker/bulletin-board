import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/php': {
        target: 'http://127.0.0.1',
        changeOrigin: true,
        rewrite: (path) => `/bulletin-board${path}`,
      },
    },
  },
})