// Custom React Flow node: story card with ghost handles (new-connection affordance)
// and draggable pin circles that appear only where edges actually attach.
import { Fragment, useRef } from 'react'
import { Handle, Position, useEdges, useReactFlow, type NodeProps } from '@xyflow/react'
import { KIND_COLORS, type Side } from '../types'
import { nodeSize, snapToBorder } from '../edgeGeometry'
import * as api from '../api'

export interface StoryNodeData extends Record<string, unknown> {
  title: string
  kind: string
  preview?: string
  boardId: string
}

const SIDES: Position[] = [Position.Top, Position.Right, Position.Bottom, Position.Left]
const PIN_SIZE = 10

type Pin = {
  edgeId: string
  endpoint: 'source' | 'target'
  side: Side
  t: number
}

function pinStyle(side: Side, t: number): React.CSSProperties {
  const half = PIN_SIZE / 2
  switch (side) {
    case 'top':    return { top: -half,    left:  `calc(${t * 100}% - ${half}px)` }
    case 'right':  return { right: -half,  top:   `calc(${t * 100}% - ${half}px)` }
    case 'bottom': return { bottom: -half, left:  `calc(${t * 100}% - ${half}px)` }
    case 'left':   return { left: -half,   top:   `calc(${t * 100}% - ${half}px)` }
  }
}

export default function StoryNodeCard({ id, data, selected }: NodeProps) {
  const d = data as StoryNodeData
  const accent = KIND_COLORS[d.kind] ?? KIND_COLORS.note

  const edges = useEdges()
  const { screenToFlowPosition, setEdges, getEdges, getNode } = useReactFlow()

  const dragging = useRef<{ edgeId: string; endpoint: 'source' | 'target' } | null>(null)

  const pins: Pin[] = edges.flatMap((e) => {
    const result: Pin[] = []
    if (e.source === id) {
      result.push({
        edgeId: e.id,
        endpoint: 'source',
        side: (e.data?.sourceHandle as Side | undefined) ?? 'right',
        t: typeof e.data?.sourceT === 'number' ? (e.data.sourceT as number) : 0.5,
      })
    }
    if (e.target === id) {
      result.push({
        edgeId: e.id,
        endpoint: 'target',
        side: (e.data?.targetHandle as Side | undefined) ?? 'left',
        t: typeof e.data?.targetT === 'number' ? (e.data.targetT as number) : 0.5,
      })
    }
    return result
  })

  const onPinPointerDown = (e: React.PointerEvent<HTMLDivElement>, pin: Pin) => {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = { edgeId: pin.edgeId, endpoint: pin.endpoint }
  }

  const onPinPointerMove = (e: React.PointerEvent<HTMLDivElement>, pin: Pin) => {
    if (!dragging.current || dragging.current.edgeId !== pin.edgeId) return
    const node = getNode(id)
    if (!node) return
    const fp  = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const { w: nw, h: nh } = nodeSize(node)
    const snap = snapToBorder(fp.x, fp.y, node.position.x, node.position.y, nw, nh)
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id !== pin.edgeId) return edge
        if (pin.endpoint === 'source') {
          return {
            ...edge,
            sourceHandle: snap.side,
            data: { ...edge.data, sourceHandle: snap.side, sourceT: snap.t },
          }
        }
        return {
          ...edge,
          targetHandle: snap.side,
          data: { ...edge.data, targetHandle: snap.side, targetT: snap.t },
        }
      }),
    )
  }

  const onPinPointerUp = (e: React.PointerEvent<HTMLDivElement>, pin: Pin) => {
    if (!dragging.current || dragging.current.edgeId !== pin.edgeId) return
    dragging.current = null
    const node = getNode(id)
    if (!node) return
    const fp   = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const { w: nw, h: nh } = nodeSize(node)
    const snap = snapToBorder(fp.x, fp.y, node.position.x, node.position.y, nw, nh)
    const currentEdge = getEdges().find((edge) => edge.id === pin.edgeId)
    if (!currentEdge || !d.boardId) return
    const newData =
      pin.endpoint === 'source'
        ? { ...currentEdge.data, sourceHandle: snap.side, sourceT: snap.t }
        : { ...currentEdge.data, targetHandle: snap.side, targetT: snap.t }
    api.updateEdge(d.boardId, pin.edgeId, { data: newData as Record<string, unknown> }).catch(() => {})
  }

  const onPinPointerCancel = (_e: React.PointerEvent<HTMLDivElement>, pin: Pin) => {
    if (dragging.current?.edgeId === pin.edgeId) dragging.current = null
  }

  return (
    <div
      className="story-node"
      style={{
        borderColor: selected ? accent : 'transparent',
        boxShadow: selected ? `0 0 0 2px ${accent}55` : undefined,
      }}
    >
      {/* Ghost handles — invisible by default, appear on hover for new connections */}
      {SIDES.map((pos) => (
        <Fragment key={pos}>
          <Handle id={pos} type="target" position={pos} className="story-handle" />
          <Handle id={pos} type="source" position={pos} className="story-handle" />
        </Fragment>
      ))}

      {/* Pin circles — one per connected edge endpoint, draggable along border */}
      {pins.map((pin) => (
        <div
          key={`${pin.edgeId}-${pin.endpoint}`}
          className="story-pin"
          style={pinStyle(pin.side, pin.t)}
          onPointerDown={(e) => onPinPointerDown(e, pin)}
          onPointerMove={(e) => onPinPointerMove(e, pin)}
          onPointerUp={(e) => onPinPointerUp(e, pin)}
          onPointerCancel={(e) => onPinPointerCancel(e, pin)}
        />
      ))}

      <span className="story-node__kind" style={{ background: accent }}>
        {d.kind}
      </span>
      <span className="story-node__title">{d.title || 'Untitled'}</span>
      {d.preview && <span className="story-node__preview">{d.preview}</span>}
    </div>
  )
}
