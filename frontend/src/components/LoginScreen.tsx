// Romm-inspired auth screen: a centered card on the themed background with a
// login / register toggle. Registration needs an invite code unless this is the
// very first account.
import { useState } from 'react'
import { apiError } from '../api'
import { useAuth } from '../auth'
import ThemeToggle from './ThemeToggle'

export default function LoginScreen() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') {
        await login(identifier.trim(), password)
      } else {
        await register({
          email: email.trim(),
          username: username.trim(),
          password,
          invite_code: invite.trim() || undefined,
        })
      }
    } catch (err) {
      setError(apiError(err, 'Something went wrong. Please try again.'))
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-themetoggle">
        <ThemeToggle />
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          fools<span>board</span>
        </div>
        <p className="auth-sub">
          {mode === 'login' ? 'Sign in to your storyboards' : 'Create your account'}
        </p>

        {mode === 'login' ? (
          <label className="auth-field">
            <span>Email or username</span>
            <input
              value={identifier}
              autoFocus
              autoComplete="username"
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                autoFocus
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="auth-field">
              <span>Username</span>
              <input
                value={username}
                autoComplete="nickname"
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
          </>
        )}

        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {mode === 'register' && (
          <label className="auth-field">
            <span>Invite code</span>
            <input
              value={invite}
              placeholder="Required (blank only for the first account)"
              onChange={(e) => setInvite(e.target.value)}
            />
          </label>
        )}

        {error && <div className="auth-error">{error}</div>}

        <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          className="auth-toggle"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'))
            setError(null)
          }}
        >
          {mode === 'login' ? "Need an account? Register" : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
