// Top-right profile avatar with a dropdown: account settings, invite codes
// (admin only), and sign out.
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth'

interface Props {
  onOpenAccount: () => void
  onOpenPreferences: () => void
  onOpenAdmin: () => void
}

export default function ProfileMenu({ onOpenAccount, onOpenPreferences, onOpenAdmin }: Props) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOutside = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    const raf = requestAnimationFrame(() => {
      window.addEventListener('pointerdown', onOutside)
      window.addEventListener('keydown', onKey, true)
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onOutside)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  if (!user) return null
  const initials = (user.username || user.email).slice(0, 2).toUpperCase()

  return (
    <div className="profile" ref={ref}>
      <button
        className="profile__avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.username}
        onClick={() => setOpen((o) => !o)}
      >
        {user.avatar_url ? <img src={user.avatar_url} alt="" /> : <span>{initials}</span>}
      </button>

      <div className={'profile__menu' + (open ? ' profile__menu--open' : '')} role="menu">
        <div className="profile__head">
          <span className="profile__name">{user.username}</span>
          <span className="profile__email">{user.email}</span>
        </div>
        <button
          className="profile__item"
          role="menuitem"
          onClick={() => {
            setOpen(false)
            onOpenAccount()
          }}
        >
          Account Settings
        </button>
        <button
          className="profile__item"
          role="menuitem"
          onClick={() => {
            setOpen(false)
            onOpenPreferences()
          }}
        >
          Preferences
        </button>
        {user.is_admin && (
          <button
            className="profile__item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenAdmin()
            }}
          >
            Admin Panel
          </button>
        )}
        <button
          className="profile__item profile__item--danger"
          role="menuitem"
          onClick={() => {
            setOpen(false)
            logout()
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
