// Admin > Invites: generate and manage single-use invite codes that new users
// redeem to register.
import { useEffect, useState } from 'react'
import * as api from '../api'
import type { Invite } from '../types'

export default function AdminInvites() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    api.listInvites().then(setInvites).catch(() => {})
  }, [])

  async function generate() {
    setBusy(true)
    try {
      const inv = await api.createInvite()
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
          Share a code so someone can register. Each code can be used once.
        </p>
        <button className="btn btn--primary" onClick={generate} disabled={busy}>
          {busy ? 'Generating…' : 'Generate code'}
        </button>
      </div>

      <ul className="invites">
        {invites.length === 0 && <li className="invites__empty">No codes yet.</li>}
        {invites.map((inv) => (
          <li className={'invite' + (inv.used_by_id ? ' invite--used' : '')} key={inv.id}>
            <code className="invite__code">{inv.code}</code>
            {inv.used_by_id ? (
              <span className="invite__used">used</span>
            ) : (
              <span className="invite__actions">
                <button type="button" className="btn invite__copy" onClick={() => copy(inv.code)}>
                  {copied === inv.code ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  title="Revoke"
                  aria-label="Revoke"
                  onClick={() => revoke(inv.id)}
                >
                  ✕
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
