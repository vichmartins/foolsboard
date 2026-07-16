// Shown when an admin has reset a user's password: the user has signed in (with
// an admin-set or temporary password) but is flagged must_change_password, so
// the whole workspace is gated behind this "choose a new password" card until
// they set one. Reuses the auth-screen aesthetic for a seamless hand-off.
import { useState } from 'react'
import { apiError } from '../api'
import { useAuth } from '../auth'
import ThemeToggle from './ThemeToggle'

export default function ForceResetScreen() {
  const { user, completeReset, logout } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (password.length < 8) {
      setError('Choose a password of at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Those passwords don’t match.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await completeReset(password)
    } catch (err) {
      setError(apiError(err, 'Couldn’t set your new password. Please try again.'))
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen is-ready">
      <div className="auth-themetoggle">
        <ThemeToggle />
      </div>
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="auth-brand">
          fools<span>board</span>
        </div>
        <p className="auth-sub">Choose a new password</p>
        <div className="auth-setup-note">
          {user ? <>Signed in as <strong>{user.username}</strong>. </> : null}
          Your password was reset by an administrator — set a new one to continue.
        </div>

        <div className="auth-body-inner">
          <label className="auth-field">
            <span>New password</span>
            <input
              type="password"
              value={password}
              autoFocus
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="auth-field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        </div>

        <div className={'auth-error-collapse' + (error ? ' is-open' : '')}>
          <div className="auth-error">{error}</div>
        </div>

        <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : 'Set Password & Continue'}
        </button>

        <button type="button" className="auth-toggle" onClick={() => logout()}>
          Sign in as someone else
        </button>
      </form>
    </div>
  )
}
