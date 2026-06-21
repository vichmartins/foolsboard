// Detects when a newer build has been deployed than the one this tab is running,
// so the app can gently prompt the user to reload (it never force-reloads).
//
// The running bundle knows its own version (__APP_VERSION__, baked in at build
// time). The deployed build also ships a version.json. We compare the two: when
// they differ, a new version is live. Checks happen when the collaboration
// socket reconnects (which occurs on every deploy, since the server restarts),
// on a slow interval, and on window focus. Production only -- dev uses HMR.
import { useEffect, useState } from 'react'
import { realtime } from './realtime'

async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: string }
    return typeof data.version === 'string' ? data.version : null
  } catch {
    return null // e.g. in dev, where version.json isn't emitted
  }
}

export function useUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    if (!import.meta.env.PROD || available) return
    let alive = true
    const check = async () => {
      if (!alive) return
      const deployed = await fetchDeployedVersion()
      if (alive && deployed && deployed !== __APP_VERSION__) setAvailable(true)
    }
    check()
    const interval = window.setInterval(check, 4 * 60 * 1000) // every 4 min
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    const offConnect = realtime.subscribeConnect(check) // on socket (re)connect
    return () => {
      alive = false
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      offConnect()
    }
  }, [available])
  return available
}
