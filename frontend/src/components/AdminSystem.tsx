// Admin > System: live server vitals (CPU, memory, disk, media storage, DB size,
// uptime) plus workspace counts. Polls every few seconds while the tab is open.
// Fields the host can't provide (e.g. CPU/memory on a non-Linux box) show "—".
import { useEffect, useState } from 'react'
import { apiError } from '../api'
import * as api from '../api'
import type { SystemStats } from '../api'

function humanBytes(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`
}

function humanDuration(s: number | null | undefined): string {
  if (s == null) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function Bar({ percent }: { percent: number | null }) {
  const p = percent == null ? 0 : Math.min(100, Math.max(0, percent))
  const hot = percent != null && percent >= 90
  return (
    <div className="sys-bar">
      <div
        className={'sys-bar__fill' + (hot ? ' sys-bar__fill--hot' : '')}
        style={{ width: `${p}%` }}
      />
    </div>
  )
}

export default function AdminSystem() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const s = await api.getSystemStats()
        if (alive) {
          setStats(s)
          setError(null)
        }
      } catch (e) {
        if (alive) setError(apiError(e, 'Could not load server stats'))
      }
    }
    load()
    const id = window.setInterval(load, 4000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  if (error && !stats) return <div className="auth-error">{error}</div>
  if (!stats) return <div className="sys-loading">Loading…</div>

  const { cpu, memory, disk, storage, db_bytes, uptime, app, host } = stats
  return (
    <div className="admin-system">
      <div className="sys-grid">
        <div className="sys-card">
          <div className="sys-card__label">CPU</div>
          <div className="sys-card__big">{cpu.percent != null ? `${cpu.percent}%` : '—'}</div>
          <Bar percent={cpu.percent} />
          <div className="sys-card__sub">
            {cpu.count != null ? `${cpu.count} cores` : ''}
            {cpu.load ? ` · load ${cpu.load['1']} / ${cpu.load['5']} / ${cpu.load['15']}` : ''}
          </div>
        </div>

        <div className="sys-card">
          <div className="sys-card__label">Memory</div>
          {memory ? (
            <>
              <div className="sys-card__big">{memory.percent}%</div>
              <Bar percent={memory.percent} />
              <div className="sys-card__sub">
                {humanBytes(memory.used)} / {humanBytes(memory.total)} used
              </div>
            </>
          ) : (
            <div className="sys-card__na">Unavailable on this host</div>
          )}
        </div>

        <div className="sys-card">
          <div className="sys-card__label">Disk</div>
          {disk ? (
            <>
              <div className="sys-card__big">{disk.percent}%</div>
              <Bar percent={disk.percent} />
              <div className="sys-card__sub">
                {humanBytes(disk.used)} / {humanBytes(disk.total)} · {humanBytes(disk.free)} free
              </div>
            </>
          ) : (
            <div className="sys-card__na">Unavailable</div>
          )}
        </div>

        <div className="sys-card">
          <div className="sys-card__label">Media storage</div>
          <div className="sys-card__big">{humanBytes(storage?.bytes)}</div>
          <div className="sys-card__sub">{storage ? `${storage.files} files` : 'Unavailable'}</div>
        </div>

        <div className="sys-card">
          <div className="sys-card__label">Database</div>
          <div className="sys-card__big">{humanBytes(db_bytes)}</div>
        </div>

        <div className="sys-card">
          <div className="sys-card__label">Uptime</div>
          <div className="sys-card__big">{humanDuration(uptime.system)}</div>
          <div className="sys-card__sub">process {humanDuration(uptime.process)}</div>
        </div>
      </div>

      <div className="sys-counts">
        <span>
          <strong>{app.users}</strong> users
        </span>
        <span>
          <strong>{app.boards}</strong> boards
        </span>
        <span>
          <strong>{app.nodes}</strong> objects
        </span>
        <span>
          <strong>{app.assets}</strong> media
        </span>
      </div>

      {host && (
        <div className="sys-host">
          {host.hostname} · {host.platform} · Python {host.python}
        </div>
      )}
    </div>
  )
}
