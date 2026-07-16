// Admin > Users: list accounts and manage their role, active status, and
// deletion. Account creation is invite-only (see the Invites tab).
import { useEffect, useState } from 'react'
import { apiError } from '../api'
import * as api from '../api'
import { useAuth } from '../auth'
import type { AdminUser } from '../types'
import ConfirmDialog from './ConfirmDialog'
import ResetPasswordDialog from './ResetPasswordDialog'

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
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)
  // Explains why a self-row action is blocked (these guards are by design).
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    api.listUsers().then(setUsers).catch((e) => setError(apiError(e, 'Could not load users')))
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 7000)
    return () => window.clearTimeout(t)
  }, [notice])

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
      {notice && <div className="admin-notice">{notice}</div>}
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
                {u.must_change_password && (
                  <span className="admin-badge admin-badge--reset" title="This user must set a new password on next sign-in">
                    Reset pending
                  </span>
                )}
                <span className="admin-user__since">{when(u.created_at)}</span>
              </div>
              <div className="admin-user__actions">
                <button
                  className={'btn admin-action admin-action--admin' + (self ? ' admin-action--self' : '')}
                  disabled={busy}
                  title={u.is_admin ? 'Remove admin' : 'Make admin'}
                  onClick={() =>
                    self
                      ? setNotice(
                          'You can’t change your own admin role — by design. It stops you locking yourself out, and the workspace must always keep at least one admin.',
                        )
                      : patch(u, { is_admin: !u.is_admin })
                  }
                >
                  {u.is_admin ? 'Remove admin' : 'Make admin'}
                </button>
                <button
                  className={
                    'btn admin-action ' +
                    (u.is_active ? 'admin-action--suspend' : 'admin-action--activate') +
                    (self ? ' admin-action--self' : '')
                  }
                  disabled={busy}
                  onClick={() =>
                    self
                      ? setNotice('You can’t suspend your own account — by design, it would lock you out instantly.')
                      : patch(u, { is_active: !u.is_active })
                  }
                >
                  {u.is_active ? 'Suspend' : 'Activate'}
                </button>
                <button
                  className={'btn admin-action admin-action--reset' + (self ? ' admin-action--self' : '')}
                  disabled={busy}
                  title="Set a new password or issue a temporary one"
                  onClick={() =>
                    self
                      ? setNotice('To change your own password, use your profile settings.')
                      : setResetUser(u)
                  }
                >
                  Reset password
                </button>
                <button
                  className={'btn admin-action admin-action--delete' + (self ? ' admin-action--self' : '')}
                  disabled={busy}
                  onClick={() =>
                    self
                      ? setNotice('You can’t delete your own account from the admin panel — by design.')
                      : setConfirmDelete(u)
                  }
                >
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {resetUser && (
        <ResetPasswordDialog
          user={resetUser}
          onClose={() => setResetUser(null)}
          onReset={(mustChange) =>
            setUsers((list) =>
              list.map((x) =>
                x.id === resetUser.id ? { ...x, must_change_password: mustChange } : x,
              ),
            )
          }
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Account?"
          message={`"${confirmDelete.username}" and all of their boards, objects, links, and media will be permanently deleted.`}
          confirmLabel="Delete Account"
          danger
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
