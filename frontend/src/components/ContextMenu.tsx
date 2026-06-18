// A small floating context menu anchored at a screen position.
// Closes on outside click, another right-click, or Escape.
import { useEffect } from 'react'

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  useEffect(() => {
    function close() {
      onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <ul
      className="ctx-menu"
      style={{ top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => (
        <li key={i}>
          <button
            className={'ctx-menu__item' + (it.danger ? ' ctx-menu__item--danger' : '')}
            onClick={() => {
              it.onClick()
              onClose()
            }}
          >
            {it.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
