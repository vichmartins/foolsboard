import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server proxies API + media calls to the FastAPI backend so the browser
// talks to a single origin (no CORS juggling during development).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
    },
  },
})
