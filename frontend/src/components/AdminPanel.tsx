// Admin panel (admins only): manage users, invite codes, and view the logs.
import { useState } from 'react'
import AdminInvites from './AdminInvites'
import AdminLogs from './AdminLogs'
import AdminUsers from './AdminUsers'

type Tab = 'users' | 'invites' | 'logs'
const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'invites', label: 'Invites' },
  { id: 'logs', label: 'Logs' },
]

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('users')

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog admin-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="admin-panel__head">
          <h2 className="dialog__title">Admin panel</h2>
          <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={'admin-tab' + (tab === t.id ? ' admin-tab--active' : '')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="admin-panel__body">
          {tab === 'users' && <AdminUsers />}
          {tab === 'invites' && <AdminInvites />}
          {tab === 'logs' && <AdminLogs />}
        </div>
      </div>
    </div>
  )
}
