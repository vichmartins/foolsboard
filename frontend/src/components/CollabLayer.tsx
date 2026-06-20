// Overlay rendered inside the React Flow pane: other collaborators' live cursors
// and their selection outlines, positioned in flow coordinates and transformed
// by the current viewport so they track pan/zoom. Pointer-events are off so it
// never intercepts canvas interaction.
import { useMemo } from 'react'
import { useViewport, type Node } from '@xyflow/react'
import { useCollab } from '../realtime'

export default function CollabLayer({ boardId, nodes }: { boardId: string; nodes: Node[] }) {
  const { cursors, selections } = useCollab(boardId)
  const { x: tx, y: ty, zoom } = useViewport()

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

  if (cursors.length === 0 && selections.length === 0) return null

  return (
    <div className="collab-layer">
      {selections.flatMap((sel) =>
        sel.nodeIds.map((id) => {
          const b = boxes.get(id)
          if (!b) return null
          return (
            <div
              key={sel.userId + ':' + id}
              className="collab-select"
              style={{
                transform: `translate(${b.x * zoom + tx}px, ${b.y * zoom + ty}px)`,
                width: b.w * zoom,
                height: b.h * zoom,
                borderColor: sel.color,
                boxShadow: `0 0 0 1px ${sel.color}`,
              }}
            />
          )
        }),
      )}

      {cursors.map((c) => (
        <div
          key={c.userId}
          className="collab-cursor"
          style={{ transform: `translate(${c.x * zoom + tx}px, ${c.y * zoom + ty}px)` }}
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
