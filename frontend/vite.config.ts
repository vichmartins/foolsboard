import { readFileSync } from 'node:fs'
import { createLogger, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Quiet the benign dev-only WebSocket proxy churn: React StrictMode mounts twice
// on load, so the realtime socket opens then immediately closes, aborting one
// proxied connection ("ws proxy error: write ECONNABORTED"). It doesn't happen in
// production (no StrictMode, no Vite) and breaks nothing. Every other error -- a
// backend that's down, a real /api proxy failure -- still logs normally.
const quietLogger = createLogger()
const baseError = quietLogger.error.bind(quietLogger)
quietLogger.error = (msg, options) => {
  if (typeof msg === 'string' && msg.includes('ws proxy')) return
  baseError(msg, options)
}

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// The repo CHANGELOG, baked into the bundle so the in-app "What's New" dialog can
// render it (read here at build time -- avoids importing a file outside the root).
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')

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
  customLogger: quietLogger,
  plugins: [react(), emitVersion],
  // Bake the build version into the bundle for the update check.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __CHANGELOG__: JSON.stringify(changelog),
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
