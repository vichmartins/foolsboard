// Custom React Flow node: a story card with ghost handles on every side. The
// handles are invisible until you hover the node, and exist only to start a new
// connection. The draggable connection points themselves live on the edges
// (see FloatingEdge), so a link can be repositioned, reassigned, or deleted by
// grabbing its endpoint.
import { Fragment } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { KIND_COLORS } from '../types'

export interface StoryNodeData extends Record<string, unknown> {
  title: string
  kind: string
  preview?: string
}

const SIDES: Position[] = [Position.Top, Position.Right, Position.Bottom, Position.Left]

export default function StoryNodeCard({ data, selected }: NodeProps) {
  const d = data as StoryNodeData
  const accent = KIND_COLORS[d.kind] ?? KIND_COLORS.note
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

      <span className="story-node__kind" style={{ background: accent }}>
        {d.kind}
      </span>
      <span className="story-node__title">{d.title || 'Untitled'}</span>
      {d.preview && <span className="story-node__preview">{d.preview}</span>}
    </div>
  )
}
