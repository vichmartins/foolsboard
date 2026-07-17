// A VS Code-style docked panel for the bottom of the explorer: a header that
// collapses to just a strip, and — when expanded — a body at a fixed height you
// can drag (via the divider on its top edge) to resize. The collapsed state and
// height are both remembered per panel, so re-opening returns to the set height.
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ChevronIcon } from './icons'

interface Props {
  title: string
  icon: ReactNode
  count?: number
  storageKey: string // namespace for the persisted collapsed flag + height
  accent?: boolean
  children: ReactNode
}

const MIN_H = 72
const MAX_H = 460
const DEFAULT_H = 168

function loadNum(key: string, fallback: number): number {
  const v = Number(localStorage.getItem(key))
  return Number.isFinite(v) && v >= MIN_H ? Math.min(MAX_H, v) : fallback
}

export default function DockPanel({ title, icon, count, storageKey, accent, children }: Props) {
  const cKey = storageKey + ':collapsed'
  const hKey = storageKey + ':h'
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(cKey) === '1')
  const [height, setHeight] = useState(() => loadNum(hKey, DEFAULT_H))
  const bodyRef = useRef<HTMLDivElement>(null)

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(cKey, next ? '1' : '0')
      return next
    })

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startY = e.clientY
      const startH = bodyRef.current?.offsetHeight ?? height
      const onMove = (ev: PointerEvent) => {
        // The handle is on the top edge, so dragging up (smaller clientY) grows it.
        setHeight(Math.min(MAX_H, Math.max(MIN_H, startH + (startY - ev.clientY))))
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        setHeight((h) => {
          localStorage.setItem(hKey, String(Math.round(h)))
          return h
        })
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [height, hKey],
  )

  return (
    <div className={'dock-panel' + (collapsed ? ' dock-panel--collapsed' : '')}>
      {!collapsed && (
        <div
          className="dock-panel__resize nodrag"
          title="Drag to resize"
          onPointerDown={startResize}
        />
      )}
      <button className="dock-panel__head" onClick={toggle} aria-expanded={!collapsed}>
        <span className={'tree-chevron' + (collapsed ? '' : ' tree-chevron--open')}>
          <ChevronIcon />
        </span>
        <span className={'dock-panel__icon' + (accent ? ' dock-panel__icon--accent' : '')}>
          {icon}
        </span>
        <span className="dock-panel__label">{title}</span>
        {count != null && <span className="dock-panel__count">{count}</span>}
      </button>
      {!collapsed && (
        <div className="dock-panel__body" ref={bodyRef} style={{ height }}>
          {children}
        </div>
      )}
    </div>
  )
}
