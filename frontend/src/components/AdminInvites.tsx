// Admin > Invites: generate single-use invite codes with a chosen lifetime.
// Active codes show a live countdown; once expired (or used) the row shows when
// it was created and when it expired.
import { useEffect, useState } from 'react'
import * as api from '../api'
import type { Invite } from '../types'
import Select from './Select'

const DURATIONS = [
  { minutes: 5, label: '5 minutes' },
  { minutes: 10, label: '10 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 1440, label: '1 day' },
  { minutes: 10080, label: '7 days' },
  { minutes: 43200, label: '30 days' },
]

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Compact "time left" string, e.g. "6d 23h", "59m 04s", "42s".
function fmtRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

export default function AdminInvites() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [duration, setDuration] = useState('60')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    api.listInvites().then(setInvites).catch(() => {})
  }, [])

  // Tick once a second so countdowns update.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  async function generate() {
    setBusy(true)
    try {
      const inv = await api.createInvite(Number(duration))
      setInvites((v) => [inv, ...v])
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    await api.deleteInvite(id)
    setInvites((v) => v.filter((i) => i.id !== id))
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code)
    setCopied(code)
    window.setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500)
  }

  return (
    <div className="admin-invites">
      <div className="admin-invites__head">
        <p className="dialog__text">
          Share a code so someone can register. Each code can be used once and expires after
          the chosen time.
        </p>
        <div className="admin-invites__gen">
          <Select
            value={duration}
            onChange={setDuration}
            ariaLabel="Code lifetime"
            options={DURATIONS.map((d) => ({ value: String(d.minutes), label: d.label }))}
          />
          <button className="btn btn--primary" onClick={generate} disabled={busy}>
            {busy ? 'Generating…' : 'Generate Code'}
          </button>
        </div>
      </div>

      <ul className="invites">
        {invites.length === 0 && <li className="invites__empty">No codes yet.</li>}
        {invites.map((inv) => {
          const used = !!inv.used_by_id
          const expMs = inv.expires_at ? new Date(inv.expires_at).getTime() : null
          const expired = !used && expMs !== null && now >= expMs
          const active = !used && !expired
          return (
            <li
              className={
                'invite' + (used ? ' invite--used' : expired ? ' invite--expired' : '')
              }
              key={inv.id}
            >
              <code className="invite__code">{inv.code}</code>

              <span className="invite__status">
                {used ? (
                  inv.used_by ? (
                    <>
                      Used by <strong>{inv.used_by.username}</strong>
                      <span className="invite__email"> · {inv.used_by.email}</span>
                      {inv.used_at ? ` · ${fmtWhen(inv.used_at)}` : ''}
                    </>
                  ) : (
                    <>Used{inv.used_at ? ` · ${fmtWhen(inv.used_at)}` : ''}</>
                  )
                ) : expired ? (
                  <>
                    Created {fmtWhen(inv.created_at)} · Expired{' '}
                    {inv.expires_at ? fmtWhen(inv.expires_at) : ''}
                  </>
                ) : expMs !== null ? (
                  <>
                    Expires in <strong className="invite__timer">{fmtRemaining(expMs - now)}</strong>
                  </>
                ) : (
                  <>No expiry</>
                )}
              </span>

              <span className="invite__actions">
                {active && (
                  <button type="button" className="btn invite__copy" onClick={() => copy(inv.code)}>
                    {copied === inv.code ? 'Copied' : 'Copy'}
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  title="Delete Code"
                  aria-label="Delete code"
                  onClick={() => revoke(inv.id)}
                >
                  ✕
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
