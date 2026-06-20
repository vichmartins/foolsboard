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
    // Open dev on the same port as production (where uvicorn serves on 9534),
    // so the URL is identical across environments. The backend runs on an
    // internal port (8000) that Vite proxies to.
    port: 9534,
    strictPort: true,
    proxy: {
      // ws: true so the /api/ws WebSocket upgrade is proxied to the backend too.
      '/api': { target: 'http://127.0.0.1:8000', ws: true },
      '/media': 'http://127.0.0.1:8000',
    },
  },
})
