// Account settings modal: update username/email, profile photo, and password.
import { useRef, useState } from 'react'
import { apiError } from '../api'
import * as api from '../api'
import { useAuth } from '../auth'

export default function AccountDialog({ onClose }: { onClose: () => void }) {
  const { user, setUser } = useAuth()
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  if (!user) return null
  const initials = (user.username || user.email).slice(0, 2).toUpperCase()

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileBusy(true)
    setProfileMsg(null)
    try {
      setUser(await api.updateProfile({ username: username.trim(), email: email.trim() }))
      setProfileMsg('Saved ✓')
    } catch (err) {
      setProfileMsg(apiError(err, 'Could not save changes'))
    } finally {
      setProfileBusy(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwBusy(true)
    setPwMsg(null)
    try {
      await api.updatePassword(curPw, newPw)
      setCurPw('')
      setNewPw('')
      setPwMsg('Password updated ✓')
    } catch (err) {
      setPwMsg(apiError(err, 'Could not update password'))
    } finally {
      setPwBusy(false)
    }
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUser(await api.uploadAvatar(file))
    } catch (err) {
      setProfileMsg(apiError(err, 'Could not upload photo'))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removeAvatar() {
    try {
      setUser(await api.deleteAvatar())
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Account Settings</h2>

        <div className="account-avatar">
          {user.avatar_url ? (
            <img className="account-avatar__img" src={user.avatar_url} alt="" />
          ) : (
            <span className="account-avatar__ph">{initials}</span>
          )}
          <div className="account-avatar__actions">
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Upload photo
            </button>
            {user.avatar_url && (
              <button type="button" className="btn" onClick={removeAvatar}>
                Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
          </div>
        </div>

        <form className="account-section" onSubmit={saveProfile}>
          <label className="field">
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {profileMsg && <p className="account-msg">{profileMsg}</p>}
          <button className="btn btn--primary" type="submit" disabled={profileBusy}>
            Save profile
          </button>
        </form>

        <form className="account-section" onSubmit={changePassword}>
          <h3 className="account-h3">Change password</h3>
          <label className="field">
            <span>Current password</span>
            <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
          </label>
          <label className="field">
            <span>New password</span>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </label>
          {pwMsg && <p className="account-msg">{pwMsg}</p>}
          <button
            className="btn btn--primary"
            type="submit"
            disabled={pwBusy || !curPw || newPw.length < 8}
          >
            Update password
          </button>
        </form>

        <div className="dialog__actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
