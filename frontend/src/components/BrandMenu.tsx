// Clickable logo that opens a dropdown: app actions (shortcuts reference) with
// the current app version pinned to the bottom.
import { useEffect, useRef, useState } from 'react'
import { APP_VERSION } from '../version'
import ShortcutsDialog from './ShortcutsDialog'

export default function BrandMenu() {
  const [open, setOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOutside = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Defer a frame so the click that opened the menu doesn't close it.
    const raf = requestAnimationFrame(() => {
      window.addEventListener('pointerdown', onOutside)
      window.addEventListener('keydown', onKey)
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onOutside)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="brand-menu" ref={ref}>
      <button
        className="brand--button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="brand__name">fools<span className="brand__accent">board</span></span>
        <span className={'brand__chevron' + (open ? ' brand__chevron--open' : '')}>▾</span>
      </button>

      <div
        className={'brand-dropdown' + (open ? ' brand-dropdown--open' : '')}
        role="menu"
      >
        <button
          className="brand-dropdown__item"
          role="menuitem"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            setShowShortcuts(true)
            setOpen(false)
          }}
        >
          Keyboard Shortcuts
        </button>
        <div className="brand-dropdown__footer">v{APP_VERSION}</div>
      </div>

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}
