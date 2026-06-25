// Admin > Logs: the curated activity log, the raw request log, and captured
// server errors (with expandable stack traces). Filter by user (all tabs), by
// action (Activity) or status class (Requests), plus a quick text filter over
// loaded rows and "load more" paging.
import { useEffect, useState } from 'react'
import * as api from '../api'
import type { ActivityLog, AdminUser, ErrorLog, RequestLog } from '../types'
import { makeMatcher } from '../search'

type Tab = 'events' | 'requests' | 'errors'
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
  const [tab, setTab] = useState<Tab>('events')
  const [events, setEvents] = useState<ActivityLog[]>([])
  const [requests, setRequests] = useState<RequestLog[]>([])
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [openError, setOpenError] = useState<string | null>(null)

  // Server-side filters.
  const [userId, setUserId] = useState('') // '' = all users
  const [action, setAction] = useState('') // Activity tab
  const [statusClass, setStatusClass] = useState('') // Requests tab (2/3/4/5)

  // Filter option sources.
  const [users, setUsers] = useState<AdminUser[]>([])
  const [actions, setActions] = useState<string[]>([])
  useEffect(() => {
    api.listUsers().then(setUsers).catch(() => {})
    api.listLogActions().then(setActions).catch(() => {})
  }, [])

  async function load(reset: boolean) {
    setLoading(true)
    const uid = userId || undefined
    try {
      if (tab === 'events') {
        const batch = await api.listActivityLogs({
          limit: PAGE,
          offset: reset ? 0 : events.length,
          action: action || undefined,
          user_id: uid,
        })
        setEvents((cur) => (reset ? batch : [...cur, ...batch]))
        setDone(batch.length < PAGE)
      } else if (tab === 'requests') {
        const batch = await api.listRequestLogs({
          limit: PAGE,
          offset: reset ? 0 : requests.length,
          status_class: statusClass ? Number(statusClass) : undefined,
          user_id: uid,
        })
        setRequests((cur) => (reset ? batch : [...cur, ...batch]))
        setDone(batch.length < PAGE)
      } else {
        const batch = await api.listErrorLogs({
          limit: PAGE,
          offset: reset ? 0 : errors.length,
          user_id: uid,
        })
        setErrors((cur) => (reset ? batch : [...cur, ...batch]))
        setDone(batch.length < PAGE)
      }
    } finally {
      setLoading(false)
    }
  }

  // Reload from the top whenever the tab or any server-side filter changes.
  useEffect(() => {
    setOpenError(null)
    void load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId, action, statusClass])

  const trimmed = query.trim()
  const match = makeMatcher(trimmed)
  const shownEvents = trimmed
    ? events.filter((e) => match(`${e.username ?? ''} ${e.action} ${e.summary}`))
    : events
  const shownRequests = trimmed
    ? requests.filter((r) => match(`${r.method} ${r.path} ${r.status_code}`))
    : requests
  const shownErrors = trimmed
    ? errors.filter((e) => match(`${e.method} ${e.path} ${e.message}`))
    : errors

  const count =
    tab === 'events' ? shownEvents.length : tab === 'requests' ? shownRequests.length : shownErrors.length

  return (
    <div className="admin-logs">
      <div className="admin-logs__bar">
        <div className="admin-subtabs">
          {(['events', 'requests', 'errors'] as Tab[]).map((t) => (
            <button
              key={t}
              className={'admin-subtab' + (tab === t ? ' admin-subtab--active' : '')}
              onClick={() => setTab(t)}
            >
              {t === 'events' ? 'Activity' : t === 'requests' ? 'Requests' : 'Errors'}
            </button>
          ))}
        </div>

        <select
          className="admin-logs__select"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          title="Filter by user"
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username}
            </option>
          ))}
        </select>

        {tab === 'events' && (
          <select
            className="admin-logs__select"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            title="Filter by action"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}

        {tab === 'requests' && (
          <select
            className="admin-logs__select"
            value={statusClass}
            onChange={(e) => setStatusClass(e.target.value)}
            title="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="2">2xx — success</option>
            <option value="3">3xx — redirect</option>
            <option value="4">4xx — client error</option>
            <option value="5">5xx — server error</option>
          </select>
        )}

        <input
          className="admin-logs__search"
          type="search"
          placeholder="Filter loaded rows…"
          title="Supports regular expressions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* key replays the enter animation when the tab or a filter changes. */}
      <div className="admin-logs__table admin-tab-panel" key={`${tab}:${userId}:${action}:${statusClass}`}>
        {tab === 'events' &&
          shownEvents.map((e) => (
            <div className="log-row" key={e.id}>
              <span className="log-time">{fmt(e.created_at)}</span>
              <span className="log-actor">{e.username ?? '—'}</span>
              <span className="log-action">{e.action}</span>
              <span className="log-summary">{e.summary}</span>
            </div>
          ))}

        {tab === 'requests' &&
          shownRequests.map((r) => (
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

        {tab === 'errors' &&
          shownErrors.map((e) => (
            <div className="log-error" key={e.id}>
              <button
                type="button"
                className="log-row log-row--error"
                onClick={() => setOpenError((o) => (o === e.id ? null : e.id))}
              >
                <span className="log-time">{fmt(e.created_at)}</span>
                <span className="log-method log-method--err">{e.method}</span>
                <span className="log-path" title={e.path}>{e.path}</span>
                <span className="log-errmsg" title={e.message}>{e.message}</span>
                <span className="log-caret">{openError === e.id ? '▾' : '▸'}</span>
              </button>
              {openError === e.id && <pre className="log-trace">{e.traceback}</pre>}
            </div>
          ))}

        {count === 0 && !loading && <p className="admin-logs__empty">Nothing to show.</p>}
      </div>

      {!done && (
        <button className="btn admin-logs__more" onClick={() => load(false)} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
