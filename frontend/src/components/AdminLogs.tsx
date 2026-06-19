// Admin > Logs: the curated activity log and the raw request log, each with a
// quick text filter (over loaded rows) and "load more" paging.
import { useEffect, useState } from 'react'
import * as api from '../api'
import type { ActivityLog, RequestLog } from '../types'

const PAGE = 50

function fmt(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function AdminLogs() {
  const [tab, setTab] = useState<'events' | 'requests'>('events')
  const [events, setEvents] = useState<ActivityLog[]>([])
  const [requests, setRequests] = useState<RequestLog[]>([])
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  async function load(reset: boolean) {
    setLoading(true)
    try {
      if (tab === 'events') {
        const offset = reset ? 0 : events.length
        const batch = await api.listActivityLogs({ limit: PAGE, offset })
        setEvents((cur) => (reset ? batch : [...cur, ...batch]))
        setDone(batch.length < PAGE)
      } else {
        const offset = reset ? 0 : requests.length
        const batch = await api.listRequestLogs({ limit: PAGE, offset })
        setRequests((cur) => (reset ? batch : [...cur, ...batch]))
        setDone(batch.length < PAGE)
      }
    } finally {
      setLoading(false)
    }
  }

  // Reset and load whenever the sub-tab changes.
  useEffect(() => {
    setQuery('')
    void load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const q = query.trim().toLowerCase()
  const shownEvents = q
    ? events.filter((e) =>
        `${e.username ?? ''} ${e.action} ${e.summary}`.toLowerCase().includes(q),
      )
    : events
  const shownRequests = q
    ? requests.filter((r) =>
        `${r.method} ${r.path} ${r.status_code}`.toLowerCase().includes(q),
      )
    : requests

  return (
    <div className="admin-logs">
      <div className="admin-logs__bar">
        <div className="admin-subtabs">
          <button
            className={'admin-subtab' + (tab === 'events' ? ' admin-subtab--active' : '')}
            onClick={() => setTab('events')}
          >
            Activity
          </button>
          <button
            className={'admin-subtab' + (tab === 'requests' ? ' admin-subtab--active' : '')}
            onClick={() => setTab('requests')}
          >
            Requests
          </button>
        </div>
        <input
          className="admin-logs__search"
          type="search"
          placeholder="Filter loaded rows…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="admin-logs__table">
        {tab === 'events'
          ? shownEvents.map((e) => (
              <div className="log-row" key={e.id}>
                <span className="log-time">{fmt(e.created_at)}</span>
                <span className="log-actor">{e.username ?? '—'}</span>
                <span className="log-action">{e.action}</span>
                <span className="log-summary">{e.summary}</span>
              </div>
            ))
          : shownRequests.map((r) => (
              <div className="log-row" key={r.id}>
                <span className="log-time">{fmt(r.created_at)}</span>
                <span className={'log-method log-method--' + r.method.toLowerCase()}>{r.method}</span>
                <span className="log-path" title={r.path}>{r.path}</span>
                <span className={'log-status log-status--' + Math.floor(r.status_code / 100)}>
                  {r.status_code}
                </span>
                <span className="log-dur">{r.duration_ms}ms</span>
              </div>
            ))}
        {(tab === 'events' ? shownEvents : shownRequests).length === 0 && !loading && (
          <p className="admin-logs__empty">Nothing to show.</p>
        )}
      </div>

      {!done && (
        <button className="btn admin-logs__more" onClick={() => load(false)} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
