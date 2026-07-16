// Admin action: reset another user's password. Two paths —
//  • Set a password: the admin types one; the user signs in with it directly
//    (optionally forced to change it on first sign-in).
//  • Temporary password: the server mints a random, single-use password that
//    expires; it's shown here once for the admin to hand over, and the user is
//    forced to choose a new password on next sign-in.
// Reuses the gradient overlay + dialog styling.
import { useEffect, useRef, useState } from 'react'
import { apiError } from '../api'
import * as api from '../api'
import type { AdminUser } from '../types'

interface Props {
  user: AdminUser
  onClose: () => void
  // Report the resulting must_change_password state so the list badge updates.
  onReset: (mustChange: boolean) => void
}

type Mode = 'temp' | 'set'

async function copyText(text: string): Promise<boolean> {
  // navigator.clipboard only exists in secure contexts (HTTPS/localhost); on a
  // plain-HTTP LAN tester it's undefined, so fall back to execCommand.
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function ResetPasswordDialog({ user, onClose, onReset }: Props) {
  const [mode, setMode] = useState<Mode>('temp')
  const [password, setPassword] = useState('')
  const [requireChange, setRequireChange] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // After a temp reset: the plaintext to reveal once, plus its expiry.
  const [temp, setTemp] = useState<{ password: string; expires: string | null } | null>(null)
  const [copied, setCopied] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit() {
    if (busy) return
    if (mode === 'set' && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res =
        mode === 'set'
          ? await api.adminResetPassword(user.id, {
              mode: 'set',
              password,
              require_change: requireChange,
            })
          : await api.adminResetPassword(user.id, { mode: 'temp' })
      onReset(res.must_change_password)
      if (res.mode === 'temp' && res.temp_password) {
        setTemp({ password: res.temp_password, expires: res.temp_password_expires_at })
      } else {
        onClose()
      }
    } catch (e) {
      setError(apiError(e, 'Could not reset the password'))
      setBusy(false)
    }
  }

  // --- Result view: reveal the temporary password once -----------------------
  if (temp) {
    const expires = temp.expires ? new Date(temp.expires).toLocaleString() : null
    return (
      <div className="overlay" onMouseDown={onClose}>
        <div
          className="dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Temporary password"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 className="dialog__title">Temporary Password</h2>
          <p className="dialog__message">
            Share this with <strong>{user.username}</strong> now — it won’t be shown
            again. They’ll sign in with it and be prompted to choose a new password.
          </p>
          <div className="reset-temp">
            <code className="reset-temp__code">{temp.password}</code>
            <button
              type="button"
              className="btn reset-temp__copy"
              onClick={async () => {
                if (await copyText(temp.password)) {
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2000)
                }
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {expires && <p className="reset-temp__expiry">Expires {expires}</p>}
          <div className="dialog__actions">
            <button className="btn btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Form view -------------------------------------------------------------
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Reset password"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="dialog__title">Reset Password</h2>
        <p className="dialog__message">
          Reset the password for <strong>{user.username}</strong>.
        </p>

        <div className="reset-modes">
          <label className={'reset-mode' + (mode === 'temp' ? ' reset-mode--on' : '')}>
            <input
              type="radio"
              name="reset-mode"
              checked={mode === 'temp'}
              onChange={() => setMode('temp')}
            />
            <span className="reset-mode__title">Generate a temporary password</span>
            <span className="reset-mode__desc">
              A single-use password that expires in 24 hours. They’ll set their own
              password on next sign-in.
            </span>
          </label>
          <label className={'reset-mode' + (mode === 'set' ? ' reset-mode--on' : '')}>
            <input
              type="radio"
              name="reset-mode"
              checked={mode === 'set'}
              onChange={() => setMode('set')}
            />
            <span className="reset-mode__title">Set a password for them</span>
            <span className="reset-mode__desc">
              Choose a password and give it to them directly.
            </span>
          </label>
        </div>

        {mode === 'set' && (
          <div className="reset-set">
            <label className="dialog__label" htmlFor="reset-pw">
              New password
            </label>
            <input
              id="reset-pw"
              ref={inputRef}
              className="dialog__input"
              type="text"
              value={password}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
            <label className="reset-check">
              <input
                type="checkbox"
                checked={requireChange}
                onChange={(e) => setRequireChange(e.target.checked)}
              />
              <span>Require them to change it on next sign-in</span>
            </label>
          </div>
        )}

        <div className={'auth-error-collapse' + (error ? ' is-open' : '')}>
          <div className="auth-error">{error}</div>
        </div>

        <div className="dialog__actions">
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'temp'
                ? 'Generate Password'
                : 'Set Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
