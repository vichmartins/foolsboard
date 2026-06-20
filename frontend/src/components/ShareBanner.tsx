// Slides a notification in from the right when someone shares a board/folder.
// Clicking it (or Accept) accepts; Reject declines; letting the countdown run
// out just dismisses it (the share stays pending). One banner shows at a time.
import { useEffect, useRef, useState } from 'react'
import * as api from '../api'
import type { Share } from '../types'

const COUNTDOWN_MS = 12000
const POLL_MS = 15000

export default function ShareBanner({ onChanged }: { onChanged: () => void }) {
  const [queue, setQueue] = useState<Share[]>([])
  const [current, setCurrent] = useState<Share | null>(null)
  const [leaving, setLeaving] = useState(false)
  const seen = useRef<Set<string>>(new Set())
  const timer = useRef<number | null>(null)

  // Poll for new pending shares.
  useEffect(() => {
    let alive = true
    async function poll() {
      try {
        const pending = await api.listIncomingShares('pending')
        if (!alive) return
        const fresh = pending.filter((s) => !seen.current.has(s.id))
        if (fresh.length) {
          fresh.forEach((s) => seen.current.add(s.id))
          setQueue((q) => [...q, ...fresh])
        }
      } catch {
        /* ignore */
      }
    }
    poll()
    const id = window.setInterval(poll, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  // Pull the next queued share into view.
  useEffect(() => {
    if (current || queue.length === 0) return
    setCurrent(queue[0])
    setQueue((q) => q.slice(1))
  }, [current, queue])

  // Auto-dismiss after the countdown.
  useEffect(() => {
    if (!current) return
    timer.current = window.setTimeout(() => close(), COUNTDOWN_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  function close() {
    setLeaving(true)
    window.setTimeout(() => {
      setCurrent(null)
      setLeaving(false)
    }, 260)
  }

  async function accept() {
    if (!current) return
    const id = current.id
    close()
    await api.acceptShare(id).catch(() => {})
    onChanged()
  }
  async function reject() {
    if (!current) return
    const id = current.id
    close()
    await api.rejectShare(id).catch(() => {})
  }

  if (!current) return null
  const who = current.owner?.username ?? 'Someone'
  return (
    <div
      className={'share-banner' + (leaving ? ' share-banner--leaving' : '')}
      onClick={accept}
      role="alert"
    >
      <div className="share-banner__body">
        <div className="share-banner__text">
          <strong>{who}</strong> shared a {current.resource_type} with you
          <span className="share-banner__res">“{current.resource_name ?? 'Untitled'}”</span>
        </div>
        <div className="share-banner__actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn--primary share-banner__btn" onClick={accept}>
            Accept
          </button>
          <button className="btn share-banner__btn" onClick={reject}>
            Reject
          </button>
        </div>
      </div>
      <div className="share-banner__bar">
        <div
          className="share-banner__fill"
          key={current.id}
          style={{ animationDuration: `${COUNTDOWN_MS}ms` }}
        />
      </div>
    </div>
  )
}
