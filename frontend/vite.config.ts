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
    // Bind all interfaces (0.0.0.0 + ::) so the dev app is reachable from other
    // devices on the LAN (e.g. http://<this-machine-ip>:5173) for multi-user /
    // multi-device testing -- not just localhost. The backend can stay on
    // 127.0.0.1 since the proxy below reaches it on this same machine.
    host: true,
    proxy: {
      // ws: true so the /api/ws WebSocket upgrade is proxied to the backend too.
      '/api': { target: 'http://127.0.0.1:8000', ws: true },
      '/media': 'http://127.0.0.1:8000',
    },
  },
})
