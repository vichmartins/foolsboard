// Custom React Flow node: a story object card with connection handles on every
// side. Each side has both a source and a target handle (same id) so, combined
// with ConnectionMode.Loose, a link can start or end on any side.
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
