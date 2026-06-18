// Custom edge that routes between stored border-attachment points (side + t),
// ignoring React Flow's handle positions. It also renders the two draggable
// endpoint "pins": grab one to slide it along a border, drag it onto another
// node to reassign that end, or drop it on empty space to delete the link.
// The pins live on the edge (not the nodes) so they stay grabbable while the
// drag crosses node boundaries.
import { useRef, useState } from 'react'
import {
  EdgeLabelRenderer,
  useNodes,
  useReactFlow,
  type EdgeProps,
  type Node,
} from '@xyflow/react'
import type { Side } from '../types'
import { findNodeAt, nodeSize, snapToBorder } from '../edgeGeometry'
import { toRFEdge } from '../rfMappers'
import { useBoardId } from '../boardContext'
import * as api from '../api'

const CTRL_DIST = 80
type Endpoint = 'source' | 'target'
type Pt = { x: number; y: number }

function getBorderPoint(node: Node, side: Side, t: number): Pt {
  const x = node.position.x
  const y = node.position.y
  const { w, h } = nodeSize(node)
  switch (side) {
    case 'top':    return { x: x + t * w, y }
    case 'right':  return { x: x + w,     y: y + t * h }
    case 'bottom': return { x: x + t * w, y: y + h }
    case 'left':   return { x,            y: y + t * h }
  }
}

function ctrlOffset(side: Side): { dx: number; dy: number } {
  switch (side) {
    case 'top':    return { dx: 0,          dy: -CTRL_DIST }
    case 'right':  return { dx: CTRL_DIST,  dy: 0 }
    case 'bottom': return { dx: 0,          dy: CTRL_DIST }
    case 'left':   return { dx: -CTRL_DIST, dy: 0 }
  }
}

export default function FloatingEdge({
  id,
  source,
  target,
  data,
  selected,
  label,
}: EdgeProps) {
  const boardId = useBoardId()
  const nodes = useNodes()
  const { getNodes, screenToFlowPosition, setEdges, getEdges } = useReactFlow()

  // The endpoint currently being dragged, and (when it's over empty space) the
  // free-floating cursor point it follows.
  const dragging = useRef<Endpoint | null>(null)
  // The persisted endpoint nodes captured at drag start, to detect reassignment.
  const origNodes = useRef<{ source: string; target: string }>({ source, target })
  const [floatPt, setFloatPt] = useState<Pt | null>(null)

  const srcNode = nodes.find((n) => n.id === source)
  const tgtNode = nodes.find((n) => n.id === target)
  if (!srcNode || !tgtNode) return null

  const srcSide = (data?.sourceHandle as Side | undefined) ?? 'right'
  const tgtSide = (data?.targetHandle as Side | undefined) ?? 'left'
  const srcT = typeof data?.sourceT === 'number' ? (data.sourceT as number) : 0.5
  const tgtT = typeof data?.targetT === 'number' ? (data.targetT as number) : 0.5

  const srcFloating = dragging.current === 'source' && floatPt !== null
  const tgtFloating = dragging.current === 'target' && floatPt !== null

  const sp: Pt = srcFloating ? floatPt! : getBorderPoint(srcNode, srcSide, srcT)
  const tp: Pt = tgtFloating ? floatPt! : getBorderPoint(tgtNode, tgtSide, tgtT)
  const sc = srcFloating ? { dx: 0, dy: 0 } : ctrlOffset(srcSide)
  const tc = tgtFloating ? { dx: 0, dy: 0 } : ctrlOffset(tgtSide)

  const d = `M ${sp.x} ${sp.y} C ${sp.x + sc.dx} ${sp.y + sc.dy}, ${tp.x + tc.dx} ${tp.y + tc.dy}, ${tp.x} ${tp.y}`
  const midX = (sp.x + tp.x) / 2
  const midY = (sp.y + tp.y) / 2

  // --- Endpoint dragging ---------------------------------------------------
  const onDown = (e: React.PointerEvent<HTMLDivElement>, endpoint: Endpoint) => {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = endpoint
    origNodes.current = { source, target }
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const endpoint = dragging.current
    if (!endpoint) return
    const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    // Never allow an end to land on the node the other end already occupies.
    const oppositeId = endpoint === 'source' ? target : source
    const over = findNodeAt(getNodes(), flow, oppositeId)
    if (!over) {
      setFloatPt(flow)
      return
    }
    setFloatPt(null)
    const { w, h } = nodeSize(over)
    const snap = snapToBorder(flow.x, flow.y, over.position.x, over.position.y, w, h)
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id !== id) return edge
        if (endpoint === 'source') {
          return {
            ...edge,
            source: over.id,
            sourceHandle: snap.side,
            data: { ...edge.data, sourceHandle: snap.side, sourceT: snap.t },
          }
        }
        return {
          ...edge,
          target: over.id,
          targetHandle: snap.side,
          data: { ...edge.data, targetHandle: snap.side, targetT: snap.t },
        }
      }),
    )
  }

  const onUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    const endpoint = dragging.current
    if (!endpoint) return
    dragging.current = null
    setFloatPt(null)

    const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const oppositeId = endpoint === 'source' ? target : source
    const over = findNodeAt(getNodes(), flow, oppositeId)
    const edge = getEdges().find((ed) => ed.id === id)
    if (!edge) return

    // Dropped on empty space -> delete the link.
    if (!over) {
      setEdges((eds) => eds.filter((ed) => ed.id !== id))
      api.deleteEdge(boardId, id).catch(() => {})
      return
    }

    const orig = origNodes.current
    const movedToAnotherNode =
      endpoint === 'source' ? edge.source !== orig.source : edge.target !== orig.target

    if (!movedToAnotherNode) {
      // Same node, just repositioned along the border -> patch the geometry.
      api
        .updateEdge(boardId, id, { data: edge.data as Record<string, unknown> })
        .catch(() => {})
      return
    }

    // Reassigned to a different node. The backend can't move an edge's
    // endpoints, so replace it: delete the old row and create a new one.
    const edgeLabel = typeof edge.label === 'string' ? edge.label : undefined
    const ed = edge.data ?? {}
    await api.deleteEdge(boardId, id).catch(() => {})
    const created = await api.createEdge(
      boardId,
      edge.source,
      edge.target,
      edgeLabel,
      ed.sourceHandle as string | undefined,
      ed.targetHandle as string | undefined,
      typeof ed.sourceT === 'number' ? ed.sourceT : 0.5,
      typeof ed.targetT === 'number' ? ed.targetT : 0.5,
    )
    setEdges((eds) => eds.map((e2) => (e2.id === id ? toRFEdge(created) : e2)))
  }

  const onCancel = () => {
    dragging.current = null
    setFloatPt(null)
  }

  const pins: { key: Endpoint; pt: Pt }[] = [
    { key: 'source', pt: sp },
    { key: 'target', pt: tp },
  ]

  return (
    <>
      {/* Wider transparent hitbox for hover / selection */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      {/* Visible line */}
      <path
        id={id}
        d={d}
        fill="none"
        strokeWidth={selected ? 2.5 : 1.5}
        stroke={selected ? 'var(--accent)' : 'var(--text-dim)'}
        className="react-flow__edge-path"
      />

      <EdgeLabelRenderer>
        {pins.map((p) => (
          <div
            key={p.key}
            className="story-pin-anchor nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${p.pt.x}px, ${p.pt.y}px)` }}
            onPointerDown={(e) => onDown(e, p.key)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
          >
            <div className="story-pin" />
          </div>
        ))}

        {label && (
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)`,
              pointerEvents: 'all',
            }}
          >
            <span className="edge-label">{label}</span>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
