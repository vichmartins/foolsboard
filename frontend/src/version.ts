// App version, read straight from package.json so it stays in sync with the
// project version through the normal module graph (hot-reloads on change) —
// no dev-server restart needed.
import pkg from '../package.json'

export const APP_VERSION: string = pkg.version
