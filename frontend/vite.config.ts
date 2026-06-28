import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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
// Drop Vite's own "VITE vX ready in …" startup line -- we print a foolsboard
// banner instead (see brandBanner). Everything else still logs.
const baseInfo = quietLogger.info.bind(quietLogger)
quietLogger.info = (msg, options) => {
  if (typeof msg === 'string' && /vite/i.test(msg) && /ready in/.test(msg)) return
  baseInfo(msg, options)
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

// __APP_VERSION__/__CHANGELOG__ are injected via `define` when the dev server
// starts, so editing CHANGELOG.md or package.json afterwards wouldn't reach the
// "What's New" dialog until a manual restart. In dev, watch those files and restart
// the server (which re-reads them) so What's New stays current. No effect on builds.
const norm = (p: string) => p.replace(/\\/g, '/')
const watchMeta: Plugin = {
  name: 'watch-meta-restart',
  apply: 'serve',
  configureServer(server) {
    const watched = [
      fileURLToPath(new URL('../CHANGELOG.md', import.meta.url)),
      fileURLToPath(new URL('./package.json', import.meta.url)),
    ].map(norm)
    server.watcher.add(watched)
    server.watcher.on('change', (file) => {
      if (watched.includes(norm(file))) void server.restart()
    })
  },
}

// Replace Vite's startup banner with a branded foolsboard one (then its usual URL
// list). Dev only -- production serves static files, no terminal.
const brandBanner: Plugin = {
  name: 'foolsboard-banner',
  apply: 'serve',
  configureServer(server) {
    const printUrls = server.printUrls.bind(server)
    server.printUrls = () => {
      const V = '\x1b[38;5;99m' // violet, ~ the logo's #863bff
      const W = '\x1b[38;5;253m'
      const BOLD = '\x1b[1m'
      const D = '\x1b[2m'
      const R = '\x1b[0m'
      const FONT: Record<string, string[]> = {
        f: ['▄██', '██▄', '█  ', '█  '],
        o: ['███', '█ █', '█ █', '███'],
        l: ['█  ', '█  ', '█  ', '███'],
        s: ['▄██', '██▄', '▄▄█', '██▀'],
        b: ['█  ', '██▄', '█ █', '███'],
        a: ['▄█▄', '█ █', '███', '█ █'],
        r: ['██▄', '█ █', '█  ', '█  '],
        d: ['  █', '▄██', '█ █', '███'],
      }
      const row = (w: string, i: number) =>
        w
          .split('')
          .map((c) => FONT[c][i])
          .join(' ')
      const lines = ['']
      for (let i = 0; i < 4; i++) {
        lines.push(`  ${BOLD}${V}${row('fools', i)}${R} ${BOLD}${W}${row('board', i)}${R}`)
      }
      lines.push(`  ${D}branching storyboards  ·  v${pkg.version}${R}`, '')
      console.log(lines.join('\n'))
      printUrls()
    }
  },
}

// Dev server proxies API + media calls to the FastAPI backend so the browser
// talks to a single origin (no CORS juggling during development).
export default defineConfig({
  customLogger: quietLogger,
  clearScreen: false, // keep our banner from being wiped on (re)start
  plugins: [react(), emitVersion, watchMeta, brandBanner],
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
