// Custom edge that routes between stored border-attachment points (side + t).
// Ignores React Flow's handle positions and computes its own geometry.
import { EdgeLabelRenderer, useNodes, type EdgeProps, type Node } from '@xyflow/react'
import type { Side } from '../types'

const CTRL_DIST = 80

function getBorderPoint(node: Node, side: Side, t: number): { x: number; y: number } {
  const x = node.position.x
  const y = node.position.y
  const w = node.measured?.width ?? 180
  const h = node.measured?.height ?? 60
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
  const nodes = useNodes()
  const srcNode = nodes.find((n) => n.id === source)
  const tgtNode = nodes.find((n) => n.id === target)

  if (!srcNode || !tgtNode) return null

  const srcSide = ((data?.sourceHandle) as Side | undefined) ?? 'right'
  const tgtSide = ((data?.targetHandle) as Side | undefined) ?? 'left'
  const srcT    = typeof data?.sourceT === 'number' ? (data.sourceT as number) : 0.5
  const tgtT    = typeof data?.targetT === 'number' ? (data.targetT as number) : 0.5

  const sp = getBorderPoint(srcNode, srcSide, srcT)
  const tp = getBorderPoint(tgtNode, tgtSide, tgtT)
  const sc = ctrlOffset(srcSide)
  const tc = ctrlOffset(tgtSide)

  const d = `M ${sp.x} ${sp.y} C ${sp.x + sc.dx} ${sp.y + sc.dy}, ${tp.x + tc.dx} ${tp.y + tc.dy}, ${tp.x} ${tp.y}`

  const midX = (sp.x + tp.x) / 2
  const midY = (sp.y + tp.y) / 2

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
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <span className="edge-label">{label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
