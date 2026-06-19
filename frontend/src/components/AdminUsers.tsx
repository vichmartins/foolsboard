// Admin > Users: list accounts and manage their role, active status, and
// deletion. Account creation is invite-only (see the Invites tab).
import { useEffect, useState } from 'react'
import { apiError } from '../api'
import * as api from '../api'
import { useAuth } from '../auth'
import type { AdminUser } from '../types'
import ConfirmDialog from './ConfirmDialog'

function when(ts: string): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function AdminUsers() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null)

  useEffect(() => {
    api.listUsers().then(setUsers).catch((e) => setError(apiError(e, 'Could not load users')))
  }, [])

  async function patch(u: AdminUser, change: { is_admin?: boolean; is_active?: boolean }) {
    setBusyId(u.id)
    setError(null)
    try {
      const updated = await api.updateUser(u.id, change)
      setUsers((list) => list.map((x) => (x.id === updated.id ? updated : x)))
    } catch (e) {
      setError(apiError(e, 'Could not update the account'))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(u: AdminUser) {
    setConfirmDelete(null)
    setBusyId(u.id)
    setError(null)
    try {
      await api.deleteUser(u.id)
      setUsers((list) => list.filter((x) => x.id !== u.id))
    } catch (e) {
      setError(apiError(e, 'Could not delete the account'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-users">
      {error && <div className="auth-error">{error}</div>}
      <ul className="admin-list">
        {users.map((u) => {
          const self = u.id === me?.id
          const busy = busyId === u.id
          return (
            <li className={'admin-user' + (u.is_active ? '' : ' admin-user--suspended')} key={u.id}>
              <div className="admin-user__main">
                <span className="admin-user__name">
                  {u.username}
                  {self && <span className="admin-user__you">you</span>}
                </span>
                <span className="admin-user__email">{u.email}</span>
              </div>
              <div className="admin-user__badges">
                {u.is_admin && <span className="admin-badge admin-badge--admin">Admin</span>}
                {!u.is_active && <span className="admin-badge admin-badge--suspended">Suspended</span>}
                <span className="admin-user__since">{when(u.created_at)}</span>
              </div>
              <div className="admin-user__actions">
                <button
                  className="btn admin-action admin-action--admin"
                  disabled={self || busy}
                  title={u.is_admin ? 'Remove admin' : 'Make admin'}
                  onClick={() => patch(u, { is_admin: !u.is_admin })}
                >
                  {u.is_admin ? 'Remove admin' : 'Make admin'}
                </button>
                <button
                  className={
                    'btn admin-action ' +
                    (u.is_active ? 'admin-action--suspend' : 'admin-action--activate')
                  }
                  disabled={self || busy}
                  onClick={() => patch(u, { is_active: !u.is_active })}
                >
                  {u.is_active ? 'Suspend' : 'Activate'}
                </button>
                <button
                  className="btn admin-action admin-action--delete"
                  disabled={self || busy}
                  onClick={() => setConfirmDelete(u)}
                >
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete account?"
          message={`"${confirmDelete.username}" and all of their boards, objects, links, and media will be permanently deleted.`}
          confirmLabel="Delete account"
          danger
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
