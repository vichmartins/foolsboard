// Themed, animated board picker — a custom dropdown replacing the native
// <select> (which can't be styled or animated to match the app).
import { useEffect, useRef, useState } from 'react'
import type { Board } from '../types'

interface Props {
  boards: Board[]
  activeId: string | null
  onSelect: (id: string) => void
}

export default function BoardSelect({ boards, activeId, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = boards.find((b) => b.id === activeId)

  useEffect(() => {
    if (!open) return
    const onOutside = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Defer a frame so the opening click doesn't immediately close it.
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
    <div className="board-select" ref={ref}>
      <button
        className="board-select__button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="board-select__current">{active?.name ?? 'Select board'}</span>
        <span className={'board-select__chevron' + (open ? ' board-select__chevron--open' : '')}>
          ▾
        </span>
      </button>

      <ul className={'board-select__menu' + (open ? ' board-select__menu--open' : '')} role="listbox">
        {boards.map((b) => (
          <li key={b.id}>
            <button
              className={
                'board-select__option' +
                (b.id === activeId ? ' board-select__option--active' : '')
              }
              role="option"
              aria-selected={b.id === activeId}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                onSelect(b.id)
                setOpen(false)
              }}
            >
              {b.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
