// Slides a notification in from the right when someone shares a board/folder.
// Clicking it (or Accept) accepts; Reject declines; letting the countdown run
// out just dismisses it (the share stays pending). One banner shows at a time.
import { useEffect, useRef, useState } from 'react'
import * as api from '../api'
import { realtime } from '../realtime'
import type { Share } from '../types'

const COUNTDOWN_MS = 12000
// A WebSocket push delivers invites instantly; this poll is just a fallback for
// invites that arrived while the tab was disconnected, so it can be slow.
const POLL_MS = 30000

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
    // Instant delivery: enqueue the moment the server pushes a new invite.
    const unsub = realtime.subscribeShare((msg) => {
      if (msg.action !== 'incoming' || !msg.share) return
      const s = msg.share as Share
      if (s.status !== 'pending' || seen.current.has(s.id)) return
      seen.current.add(s.id)
      setQueue((q) => [...q, s])
    })
    return () => {
      alive = false
      window.clearInterval(id)
      unsub()
    }
  }, [])

  // Pull the next queued share into view.
  useEffect(() => {
    if (current || queue.length === 0) return
    setCurrent(queue[0])
    setQueue((q) => q.slice(1))
  }, [current, queue])

  // Letting the countdown run out is a "no response" (distinct from a reject);
  // the owner's Share view updates from pending to "No response".
  useEffect(() => {
    if (!current) return
    timer.current = window.setTimeout(() => lapse(), COUNTDOWN_MS)
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

  function lapse() {
    if (!current) return
    const id = current.id
    close()
    api.lapseShare(id).catch(() => {})
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
