import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// Emit a tiny version.json into the build so a running tab can detect when a
// newer version has been deployed (see useUpdateAvailable).
const emitVersion: Plugin = {
  name: 'emit-version-json',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: pkg.version }),
    })
  },
}

// Dev server proxies API + media calls to the FastAPI backend so the browser
// talks to a single origin (no CORS juggling during development).
export default defineConfig({
  plugins: [react(), emitVersion],
  // Bake the build version into the bundle for the update check.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    // Bind the IPv4 loopback so both 127.0.0.1 and localhost reach the app
    // (Vite's default binds IPv6 ::1 only, which 127.0.0.1 can't reach).
    // Use `host: true` instead if you also want LAN/other-device access.
    host: '127.0.0.1',
    proxy: {
      // ws: true so the /api/ws WebSocket upgrade is proxied to the backend too.
      '/api': { target: 'http://127.0.0.1:8000', ws: true },
      '/media': 'http://127.0.0.1:8000',
    },
  },
})
