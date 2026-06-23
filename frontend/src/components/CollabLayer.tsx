// Overlay rendered inside the React Flow pane: other collaborators' live cursors
// and their selection outlines, positioned in flow coordinates and transformed
// by the current viewport so they track pan/zoom. Pointer-events are off so it
// never intercepts canvas interaction.
import { useEffect, useMemo, useRef } from 'react'
import { useViewport, type Node } from '@xyflow/react'
import { realtime, useCollab } from '../realtime'

// Jitter buffer: render remote cursors this far in the past, so we always have
// samples on both sides to interpolate between even when packets arrive raggedly
// (the cost is a fixed, smooth ~100ms of cursor lag).
const INTERP_DELAY = 100

type Pt = { t: number; x: number; y: number }
// Position at time t by linear interpolation between the two bracketing samples
// (clamped to the ends; holds the last spot when the cursor goes idle).
function sampleAt(s: Pt[], t: number): { x: number; y: number } | null {
  const n = s.length
  if (n === 0) return null
  if (t <= s[0].t) return s[0]
  if (t >= s[n - 1].t) return s[n - 1]
  for (let i = 1; i < n; i++) {
    if (t <= s[i].t) {
      const a = s[i - 1]
      const b = s[i]
      const f = (t - a.t) / (b.t - a.t || 1)
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
    }
  }
  return s[n - 1]
}

export default function CollabLayer({
  boardId,
  nodes,
  editLocks = {},
}: {
  boardId: string
  nodes: Node[]
  editLocks?: Record<string, { userId: string; username: string; color: string }>
}) {
  const { cursors, selections } = useCollab(boardId)
  const { x: tx, y: ty, zoom } = useViewport()
  const lockEntries = Object.entries(editLocks)

  // --- jitter-buffered cursor playback --------------------------------------
  // Position each cursor element on every animation frame from its sample buffer
  // (read live from realtime), so motion stays smooth regardless of when packets
  // land. Driving it here via refs avoids re-rendering React on every sample.
  const cursorEls = useRef(new Map<string, HTMLDivElement>())
  const vp = useRef({ tx, ty, zoom })
  vp.current = { tx, ty, zoom }
  const placeCursor = (el: HTMLDivElement, uid: string) => {
    const p = sampleAt(realtime.cursorSamples(boardId, uid), performance.now() - INTERP_DELAY)
    if (p) {
      const { tx, ty, zoom } = vp.current
      el.style.transform = `translate(${p.x * zoom + tx}px, ${p.y * zoom + ty}px)`
    }
  }
  useEffect(() => {
    let raf = 0
    const tick = () => {
      cursorEls.current.forEach((el, uid) => placeCursor(el, uid))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId])

  // Resolve each node's box once per render so selection outlines can be drawn.
  const boxes = useMemo(() => {
    const m = new Map<string, { x: number; y: number; w: number; h: number }>()
    for (const n of nodes) {
      const w = n.measured?.width ?? (n.width as number | undefined) ?? 0
      const h = n.measured?.height ?? (n.height as number | undefined) ?? 0
      m.set(n.id, { x: n.position.x, y: n.position.y, w, h })
    }
    return m
  }, [nodes])

  if (cursors.length === 0 && selections.length === 0 && lockEntries.length === 0) return null

  return (
    <div className="collab-layer">
      {/* Outlines live in a single viewport-transformed layer: panning/zooming
          moves this container in one shot (no per-element recompute), so the
          per-outline transition only animates a node actually being dragged --
          no lag while you pan, and outlines stay glued to their node. Sizes are
          in flow units; the container's scale handles zoom. */}
      <div
        className="collab-flow"
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        {selections.flatMap((sel) =>
          sel.nodeIds.map((id) => {
            const b = boxes.get(id)
            if (!b) return null
            return (
              <div
                key={sel.userId + ':' + id}
                className="collab-select"
                style={{
                  transform: `translate(${b.x}px, ${b.y}px)`,
                  width: b.w,
                  height: b.h,
                  borderColor: sel.color,
                  boxShadow: `0 0 0 2px ${sel.color}55`,
                }}
              />
            )
          }),
        )}

        {/* Drawn after selections so the badge is never covered by a selection
            highlight on the same node. */}
        {lockEntries.map(([id, lock]) => {
          const b = boxes.get(id)
          if (!b) return null
          return (
            <div
              key={'lock:' + id}
              className="collab-edit"
              style={{
                transform: `translate(${b.x}px, ${b.y}px)`,
                width: b.w,
                height: b.h,
                borderColor: lock.color,
                boxShadow: `0 0 0 2px ${lock.color}`,
              }}
            >
              <span className="collab-edit__label" style={{ background: lock.color }}>
                ✎ {lock.username}
              </span>
            </div>
          )
        })}
      </div>

      {cursors.map((c) => (
        <div
          key={c.userId}
          className="collab-cursor"
          ref={(el) => {
            if (el) {
              cursorEls.current.set(c.userId, el)
              placeCursor(el, c.userId) // position immediately so it doesn't flash at 0,0
            } else {
              cursorEls.current.delete(c.userId)
            }
          }}
        >
          <svg
            className="collab-cursor__arrow"
            viewBox="0 0 16 16"
            width="18"
            height="18"
            style={{ color: c.color }}
          >
            <path
              fill="currentColor"
              stroke="#fff"
              strokeWidth="1"
              d="M2 1.5 L2 13 L5.4 9.6 L7.6 14.2 L9.8 13.2 L7.6 8.8 L12.2 8.8 Z"
            />
          </svg>
          <span className="collab-cursor__label" style={{ background: c.color }}>
            {c.username}
          </span>
        </div>
      ))}
    </div>
  )
}
