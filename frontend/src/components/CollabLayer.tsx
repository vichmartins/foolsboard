// Overlay rendered inside the React Flow pane: other collaborators' live cursors
// and their selection outlines, positioned in flow coordinates and transformed
// by the current viewport so they track pan/zoom. Pointer-events are off so it
// never intercepts canvas interaction.
import { useEffect, useMemo, useRef } from 'react'
import { useViewport, type Node } from '@xyflow/react'
import { realtime, useCollab } from '../realtime'

// Cursors are smoothed the same way as nodes: each frame, ease toward the latest
// received position. This keeps a collaborator's cursor glued to the node they're
// dragging (matching latency) and naturally absorbs jitter -- bursty/late packets
// just update the target, they don't replay as a jerky path.
const CURSOR_EASE = 0.4

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

  // --- smoothed cursor playback ---------------------------------------------
  // Each frame, ease each cursor element toward its latest received position
  // (read live from realtime). Driving it via refs avoids re-rendering React on
  // every sample.
  const cursorEls = useRef(new Map<string, HTMLDivElement>())
  const curPos = useRef(new Map<string, { x: number; y: number }>())
  const vp = useRef({ tx, ty, zoom })
  vp.current = { tx, ty, zoom }
  const latest = (uid: string) => {
    const s = realtime.cursorSamples(boardId, uid)
    return s.length ? s[s.length - 1] : null
  }
  const draw = (el: HTMLDivElement, x: number, y: number) => {
    const { tx, ty, zoom } = vp.current
    el.style.transform = `translate(${x * zoom + tx}px, ${y * zoom + ty}px)`
  }
  // Snap a freshly-mounted cursor to its current spot (no glide in from 0,0).
  const placeCursor = (el: HTMLDivElement, uid: string) => {
    const t = latest(uid)
    if (t) {
      curPos.current.set(uid, { x: t.x, y: t.y })
      draw(el, t.x, t.y)
    }
  }
  useEffect(() => {
    let raf = 0
    const tick = () => {
      cursorEls.current.forEach((el, uid) => {
        const t = latest(uid)
        if (!t) return
        let cur = curPos.current.get(uid)
        if (!cur) {
          cur = { x: t.x, y: t.y }
          curPos.current.set(uid, cur)
        }
        cur.x += (t.x - cur.x) * CURSOR_EASE
        cur.y += (t.y - cur.y) * CURSOR_EASE
        draw(el, cur.x, cur.y)
      })
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
              curPos.current.delete(c.userId)
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
