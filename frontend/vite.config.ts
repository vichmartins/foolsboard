import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server proxies API + media calls to the FastAPI backend so the browser
// talks to a single origin (no CORS juggling during development).
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind the IPv4 loopback so both 127.0.0.1 and localhost reach the app
    // (Vite's default binds IPv6 ::1 only, which 127.0.0.1 can't reach).
    // Use `host: true` instead if you also want LAN/other-device access.
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
    },
  },
})
