// A small floating context menu anchored at a screen position.
// Closes on outside click, another right-click, or Escape — with a brief
// exit animation before it actually unmounts.
import { useCallback, useEffect, useRef, useState } from 'react'

const CLOSE_MS = 120

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  // Single character that triggers this item while the menu is open. The first
  // matching letter in the label is underlined.
  mnemonic?: string
  // Keyboard shortcut hint shown right-aligned (e.g. "Ctrl+C", "Del").
  shortcut?: string
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

// Render the label with its mnemonic letter underlined (first match).
function renderLabel(label: string, mnemonic?: string) {
  if (!mnemonic) return label
  const idx = label.toLowerCase().indexOf(mnemonic.toLowerCase())
  if (idx === -1) return label
  return (
    <>
      {label.slice(0, idx)}
      <u>{label.slice(idx, idx + 1)}</u>
      {label.slice(idx + 1)}
    </>
  )
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLUListElement>(null)
  const [closing, setClosing] = useState(false)
  const timer = useRef<number | null>(null)
  // Latest props for the stable, mount-once handlers below.
  const itemsRef = useRef(items)
  itemsRef.current = items
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Play the exit animation, then actually close after it finishes. Stable
  // (no deps) so re-renders never re-run the listener effect and clear the timer.
  const requestClose = useCallback(() => {
    if (timer.current !== null) return
    setClosing(true)
    timer.current = window.setTimeout(() => onCloseRef.current(), CLOSE_MS)
  }, [])

  // Attach the outside-close / keyboard listeners once, on mount.
  useEffect(() => {
    function onOutside(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) requestClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        requestClose()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const item = itemsRef.current.find(
        (it) => it.mnemonic && it.mnemonic.toLowerCase() === e.key.toLowerCase(),
      )
      if (item) {
        e.preventDefault()
        item.onClick()
        requestClose()
      }
    }
    // Defer attaching by a frame: the very contextmenu event that opened this
    // menu is still bubbling to window, and we must not let it self-close us.
    const raf = requestAnimationFrame(() => {
      window.addEventListener('pointerdown', onOutside)
      window.addEventListener('contextmenu', onOutside)
    })
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onOutside)
      window.removeEventListener('contextmenu', onOutside)
      window.removeEventListener('keydown', onKey)
    }
  }, [requestClose])

  // Clear a pending close timer only when the menu actually unmounts.
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  return (
    <ul
      ref={ref}
      className={'ctx-menu' + (closing ? ' ctx-menu--closing' : '')}
      style={{ top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => (
        <li key={i}>
          <button
            className={'ctx-menu__item' + (it.danger ? ' ctx-menu__item--danger' : '')}
            onClick={() => {
              it.onClick()
              requestClose()
            }}
          >
            <span>{renderLabel(it.label, it.mnemonic)}</span>
            {it.shortcut && <span className="ctx-menu__sc">{it.shortcut}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
