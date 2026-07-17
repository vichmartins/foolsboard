// Share a board or folder with another user (by username or email). Shows who
// it's already shared with and lets the owner revoke.
import { useEffect, useState } from 'react'
import * as api from '../api'
import { realtime } from '../realtime'
import type { Share } from '../types'

// The owner's view of each recipient's response. "pending" = invite still live
// and unanswered; "lapsed" = they let the countdown run out without deciding.
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  lapsed: 'No response',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

interface Props {
  resourceType: 'board' | 'folder'
  resourceId: string
  resourceName: string
  isTemplate?: boolean
  onClose: () => void
}

export default function ShareDialog({
  resourceType,
  resourceId,
  resourceName,
  isTemplate,
  onClose,
}: Props) {
  const [recipient, setRecipient] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shares, setShares] = useState<Share[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    api
      .listOutgoingShares()
      .then((all) => {
        if (!alive) return
        setShares(
          all.filter((s) =>
            resourceType === 'board' ? s.board_id === resourceId : s.folder_id === resourceId,
          ),
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [resourceId, resourceType, tick])

  // Refresh the moment a recipient accepts/rejects (or a share is removed), so
  // the owner sees the new status live without reopening the dialog.
  useEffect(() => realtime.subscribeShare(() => setTick((t) => t + 1)), [])

  async function share() {
    const r = recipient.trim()
    if (!r || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.createShare(
        resourceType === 'board'
          ? { recipient: r, board_id: resourceId }
          : { recipient: r, folder_id: resourceId },
      )
      setRecipient('')
      setTick((t) => t + 1)
    } catch (e) {
      setError(api.apiError(e, 'Could not share. Check the username or email.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    await api.removeShare(id).catch(() => {})
    setTick((t) => t + 1)
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">
          Share {isTemplate ? 'Template' : resourceType === 'board' ? 'Board' : 'Folder'}
        </h2>
        <p className="dialog__message">
          Share <strong>{resourceName}</strong> with another user by username or email. They can
          accept or reject; once accepted you can collaborate on it.
        </p>
        {error && <div className="auth-error">{error}</div>}

        <div className="share-add">
          <input
            className="dialog__input share-add__input"
            value={recipient}
            autoFocus
            placeholder="Username or email"
            onChange={(e) => setRecipient(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') share()
            }}
          />
          <button className="btn btn--primary" disabled={!recipient.trim() || busy} onClick={share}>
            {busy ? 'Sharing…' : 'Share'}
          </button>
        </div>

        {shares.length > 0 && (
          <ul className="share-list">
            {shares.map((s) => (
              <li className="share-row" key={s.id}>
                <span className="share-row__name">{s.shared_with?.username ?? '—'}</span>
                <span className={'share-row__status share-row__status--' + s.status}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  title="Remove Access"
                  aria-label="Remove access"
                  onClick={() => remove(s.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <button className="btn share-done" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}
