// A small floating context menu anchored at a screen position.
// Closes on outside click, another right-click, or Escape — with a brief
// exit animation before it actually unmounts.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const CLOSE_MS = 120

export interface MenuItem {
  label: string
  // A leaf item has onClick; a parent item has submenu (opens a flyout on hover).
  onClick?: () => void
  submenu?: MenuItem[]
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

// Render the label, underlining its mnemonic letter (first match) only while Alt
// is held — like classic Windows menus, where mnemonics reveal + activate on Alt.
function renderLabel(label: string, mnemonic: string | undefined, showMnemonic: boolean) {
  if (!mnemonic || !showMnemonic) return label
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
  // Mnemonics (underline + single-key activation) are only live while Alt is held.
  const [altHeld, setAltHeld] = useState(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltHeld(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltHeld(false)
    }
    const clear = () => setAltHeld(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])
  // Which parent item's submenu (flyout) is open, and a small close delay so the
  // pointer can travel from the parent into the submenu without it collapsing.
  const [openSub, setOpenSub] = useState<number | null>(null)
  const subTimer = useRef<number | null>(null)
  // The open submenu's measured placement: which side, and a vertical offset that
  // shifts it up so it never runs past the bottom of the viewport.
  const subRef = useRef<HTMLUListElement>(null)
  const [subPos, setSubPos] = useState<{ top: number; side: 'left' | 'right' }>({
    top: -5,
    side: 'right',
  })
  useLayoutEffect(() => {
    if (openSub === null) return
    const el = subRef.current
    const li = el?.parentElement
    if (!el || !li) return
    const m = 6
    const liRect = li.getBoundingClientRect()
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    // Prefer opening to the right of the item; flip left if it would overflow.
    let side: 'left' | 'right' = 'right'
    if (liRect.right + w > vw - m && liRect.left - w >= m) side = 'left'
    // Default the top edge just above the item; shift up if the bottom overflows.
    let top = -5
    if (liRect.top + top + h > vh - m) top = Math.max(m - liRect.top, vh - m - h - liRect.top)
    setSubPos({ top, side })
  }, [openSub])
  const openSubmenu = (i: number) => {
    if (subTimer.current !== null) {
      window.clearTimeout(subTimer.current)
      subTimer.current = null
    }
    setOpenSub(i)
  }
  const scheduleCloseSubmenu = () => {
    if (subTimer.current !== null) window.clearTimeout(subTimer.current)
    subTimer.current = window.setTimeout(() => setOpenSub(null), 140)
  }
  useEffect(
    () => () => {
      if (subTimer.current !== null) clearTimeout(subTimer.current)
    },
    [],
  )
  // Adaptive placement: default down-right from the cursor, but flip up and/or
  // left when the menu would overflow the viewport, then clamp to a small margin.
  // Measured in a layout effect so the corrected position paints without a flash.
  const [pos, setPos] = useState<{ top: number; left: number; origin: string }>({
    top: y,
    left: x,
    origin: 'top left',
  })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const m = 6 // keep a small gap from the edge
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = x
    let flipX = false
    if (x + w > vw - m && x - w >= m) {
      left = x - w // not enough room to the right -> open leftward
      flipX = true
    }
    left = Math.max(m, Math.min(left, vw - w - m))
    let top = y
    let flipY = false
    if (y + h > vh - m && y - h >= m) {
      top = y - h // not enough room below -> open upward
      flipY = true
    }
    top = Math.max(m, Math.min(top, vh - h - m))
    setPos({ top, left, origin: `${flipY ? 'bottom' : 'top'} ${flipX ? 'right' : 'left'}` })
  }, [x, y, items])
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
      // Mnemonics require Alt to be held (Alt+letter), so bare typing never fires them.
      if (e.ctrlKey || e.metaKey || !e.altKey) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : ''
      const codeLetter = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : ''
      const item = itemsRef.current.find(
        (it) =>
          it.onClick &&
          it.mnemonic &&
          (it.mnemonic.toLowerCase() === key || it.mnemonic.toLowerCase() === codeLetter),
      )
      if (item?.onClick) {
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
      style={{ top: pos.top, left: pos.left, transformOrigin: pos.origin }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => {
        if (it.submenu) {
          return (
            <li
              key={i}
              className="ctx-menu__sub-wrap"
              onMouseEnter={() => openSubmenu(i)}
              onMouseLeave={scheduleCloseSubmenu}
            >
              <button
                className={
                  'ctx-menu__item ctx-menu__item--parent' +
                  (openSub === i ? ' ctx-menu__item--open' : '')
                }
                onClick={() => setOpenSub(openSub === i ? null : i)}
              >
                <span>{renderLabel(it.label, it.mnemonic, altHeld)}</span>
                <span className="ctx-menu__caret" aria-hidden="true">
                  ›
                </span>
              </button>
              {openSub === i && (
                <ul
                  ref={subRef}
                  className={'ctx-menu ctx-submenu ctx-submenu--' + subPos.side}
                  style={{ top: subPos.top }}
                >
                  {it.submenu.map((sub, j) => (
                    <li key={j}>
                      <button
                        className={'ctx-menu__item' + (sub.danger ? ' ctx-menu__item--danger' : '')}
                        onClick={() => {
                          sub.onClick?.()
                          requestClose()
                        }}
                      >
                        <span>{renderLabel(sub.label, sub.mnemonic, altHeld)}</span>
                        {sub.shortcut && <span className="ctx-menu__sc">{sub.shortcut}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        }
        return (
          <li key={i}>
            <button
              className={'ctx-menu__item' + (it.danger ? ' ctx-menu__item--danger' : '')}
              onClick={() => {
                it.onClick?.()
                requestClose()
              }}
            >
              <span>{renderLabel(it.label, it.mnemonic, altHeld)}</span>
              {it.shortcut && <span className="ctx-menu__sc">{it.shortcut}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
